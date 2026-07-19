import { app } from '@azure/functions';
import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ClientSecretCredential } from '@azure/identity';
import { getJobConfigStore, getRuntimeStateStore, getResultStore } from '../storage/stores.js';
import { getSecret, setSecret, deleteSecret, kvSecretName } from '../storage/KeyVaultCredentialStore.js';
import type { JobConfig } from '../types/JobConfig.js';

// ── Request body type shared by POST and PUT ──────────────────────────────────

interface TenantUpsertBody {
  tenantId:            string;
  tenantDisplayName:   string;
  authMode:            string;
  clientId?:           string;
  credentialValue?:    string;   // client secret value → stored in KV, never persisted elsewhere
  schedule?: {
    intervalDays?: number;
    runAtUtc?:     string;
  };
  teamsWebhooks?: {
    status?:  string | null;
    alerts?:  string | null;
    errors?:  string | null;
  };
  notificationTemplates?: {
    expiring?:  string | null;
    critical?:  string | null;
    summary?:   string | null;
    error?:     string | null;
  };
  notificationThresholds?: {
    expiringWithinDays?: number;
    criticalWithinDays?: number;
  };
  mailTargets?: {
    to: string[];
    sendOnExpiring?: boolean;
    sendOnCritical?: boolean;
    sendOnStatus?:   boolean;
    sendOnError?:    boolean;
  } | null;
  logAnalytics?: {
    workspaceId?: string | null;
    enabled?:     boolean;
  };
}

// ── POST /api/tenants ─────────────────────────────────────────────────────────

app.http('addTenant', {
  methods: ['POST'],
  route: 'tenants',
  authLevel: 'function',
  handler: addTenantHandler,
});

async function addTenantHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const body = await req.json() as TenantUpsertBody;

  if (!body.tenantId || !body.tenantDisplayName || !body.authMode) {
    return json({ error: 'tenantId, tenantDisplayName and authMode are required' }, 400);
  }

  try {
    const store = getJobConfigStore();
    const config = await store.readJobs();

    if (config.jobs.some((j) => j.tenantId === body.tenantId)) {
      return json({ error: `Tenant ${body.tenantId} already configured. Use PUT to update.` }, 409);
    }

    const jobId = slugify(body.tenantDisplayName);
    let credentialRef: string | undefined;

    if (body.authMode === 'client-secret') {
      if (!body.credentialValue) return json({ error: 'credentialValue required for client-secret mode' }, 400);
      if (!body.clientId) return json({ error: 'clientId required for client-secret mode' }, 400);

      // Validate credentials before persisting — fail fast with a clear error.
      const authError = await testClientSecretCredential(body.tenantId, body.clientId, body.credentialValue);
      if (authError) {
        return json({
          error: `Authentication failed — credentials are invalid or insufficient. Check Tenant ID, Client ID and Secret value.`,
          detail: authError,
        }, 422);
      }

      credentialRef = kvSecretName(jobId);
      await setSecret(credentialRef, body.credentialValue);
      context.log(`KV secret '${credentialRef}' stored for job '${jobId}'`);
    }

    const job: JobConfig = buildJobConfig(jobId, body, credentialRef);
    config.jobs.push(job);
    await store.writeJobs(config);

    return json(jobToProfile(job, null), 201);
  } catch (err) {
    context.error(`Add tenant failed: ${err}`);
    return json({ error: String(err) }, 500);
  }
}

// ── PUT /api/tenants/{tenantId} ───────────────────────────────────────────────

app.http('updateTenant', {
  methods: ['PUT'],
  route: 'tenants/{tenantId}',
  authLevel: 'function',
  handler: updateTenantHandler,
});

async function updateTenantHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const tenantId = req.params['tenantId'];
  const body = await req.json() as TenantUpsertBody;

  try {
    const store = getJobConfigStore();
    const config = await store.readJobs();
    const idx = config.jobs.findIndex((j) => j.tenantId === tenantId);

    if (idx === -1) return json({ error: `Tenant ${tenantId} not found` }, 404);

    const existing = config.jobs[idx];

    // Rotate credential if a new value is provided
    if (body.authMode === 'client-secret' && body.credentialValue) {
      const secretName = existing.credentialRef ?? kvSecretName(existing.id);
      await setSecret(secretName, body.credentialValue);
      context.log(`KV secret '${secretName}' rotated for job '${existing.id}'`);
    }

    const updated = buildJobConfig(
      existing.id,
      { ...body, tenantId },
      existing.credentialRef,
    );
    config.jobs[idx] = updated;
    await store.writeJobs(config);

    const runtimeStore = getRuntimeStateStore();
    const state = await runtimeStore.read(existing.id);
    return json(jobToProfile(updated, state.lastRunAt));
  } catch (err) {
    context.error(`Update tenant failed: ${err}`);
    return json({ error: String(err) }, 500);
  }
}

// ── DELETE /api/tenants/{tenantId} ────────────────────────────────────────────

app.http('deleteTenant', {
  methods: ['DELETE'],
  route: 'tenants/{tenantId}',
  authLevel: 'function',
  handler: deleteTenantHandler,
});

async function deleteTenantHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const tenantId = req.params['tenantId'];

  try {
    const store = getJobConfigStore();
    const config = await store.readJobs();
    const idx = config.jobs.findIndex((j) => j.tenantId === tenantId);

    if (idx === -1) return json({ error: `Tenant ${tenantId} not found` }, 404);

    const [removed] = config.jobs.splice(idx, 1);
    await store.writeJobs(config);

    // Clean up KV secret and runtime state blob.
    // Scan results (latest/ + history/) are intentionally kept so re-adding the tenant
    // with the same Tenant ID restores historical data.
    await Promise.allSettled([
      removed.credentialRef ? deleteSecret(removed.credentialRef) : Promise.resolve(),
      deleteRuntimeState(removed.id),
    ]);

    context.log(`Tenant ${tenantId} (job '${removed.id}') deleted`);
    return { status: 204 };
  } catch (err) {
    context.error(`Delete tenant failed: ${err}`);
    return json({ error: String(err) }, 500);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildJobConfig(
  jobId: string,
  body: TenantUpsertBody,
  credentialRef: string | undefined,
): JobConfig {
  return {
    id:               jobId,
    enabled:          true,
    tenantId:         body.tenantId,
    tenantDisplayName: body.tenantDisplayName,
    authMode:         body.authMode as JobConfig['authMode'],
    clientId:         body.clientId ?? '',
    credentialRef,
    schedule: {
      intervalDays: body.schedule?.intervalDays ?? 1,
      runAtUtc:     body.schedule?.runAtUtc ?? '06:00',
    },
    teamsWebhooks:            body.teamsWebhooks,
    notificationTemplates:    body.notificationTemplates,
    notificationThresholds:   body.notificationThresholds,
    mailTargets:              body.mailTargets ?? undefined,
    logAnalytics:             body.logAnalytics,
  };
}

function jobToProfile(job: JobConfig, lastRunAt: string | null) {
  const now = new Date().toISOString();
  const mail = job.mailTargets;
  return {
    tenantId:                job.tenantId,
    displayName:             job.tenantDisplayName,
    authMode:                job.authMode,
    clientId:                job.clientId,
    username:                null,
    logAnalyticsWorkspaceId: job.logAnalytics?.workspaceId ?? null,
    createdAt:               now,
    updatedAt:               now,
    lastPreflightAt:         lastRunAt,
    lastSuccessfulScanAt:    lastRunAt,
    notifications: {
      teamsStatus: !!(job.teamsWebhooks?.status),
      teamsAlerts: !!(job.teamsWebhooks?.alerts),
      teamsErrors: !!(job.teamsWebhooks?.errors),
      mailCount:   mail?.to?.length ?? 0,
      mailTo:      mail?.to ?? [],
      mailCritical: mail ? (mail.sendOnCritical ?? true) : false,
      mailExpiring: mail ? (mail.sendOnExpiring ?? true) : false,
      mailStatus:   mail ? (mail.sendOnStatus   ?? true) : false,
      mailError:    mail ? (mail.sendOnError     ?? true) : false,
    },
  };
}

/** Deletes the runtime state blob for a job (called on tenant delete). */
async function deleteRuntimeState(jobId: string): Promise<void> {
  try { await getRuntimeStateStore().delete(jobId); } catch { /* ignore */ }
}

/**
 * Tries to acquire a Graph token using the provided client-secret credential.
 * Returns null on success, or an error message string on failure.
 */
async function testClientSecretCredential(
  tenantId: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  try {
    const cred = new ClientSecretCredential(tenantId, clientId, clientSecret);
    await cred.getToken('https://graph.microsoft.com/.default');
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function json(body: unknown, status = 200): HttpResponseInit {
  return {
    status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body, null, 2),
  };
}

import { app } from '@azure/functions';
import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getJobConfigStore, getResultStore, getRuntimeStateStore } from '../storage/stores.js';
import { executeJob } from '../scan/JobExecutor.js';
import { evaluateThresholds, sendSuccessNotifications, sendErrorNotification } from '../notifications/notifyJob.js';
import type { JobConfig } from '../types/JobConfig.js';

// ── GET /api/tenants ──────────────────────────────────────────────────────────

app.http('tenants', {
  methods: ['GET'],
  route: 'tenants',
  authLevel: 'function',
  handler: async (_req, context) => tenantsHandler(context),
});

/**
 * Returns a TenantProfile array compatible with the MAUI TenantProfile record.
 * One entry per unique tenantId. MAUI has no environment selector — the
 * environmentName is an internal routing detail stored in Blob Storage paths.
 */
async function tenantsHandler(context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const { jobs } = await getJobConfigStore().readJobs();

    // One entry per unique tenantId, using the first matching job.
    const byTenant = new Map<string, {
      displayName: string; authMode: string; clientId: string | null;
      logAnalyticsWorkspaceId: string | null;
      notifications: NotificationChannelSummary;
    }>();
    for (const job of jobs) {
      if (!byTenant.has(job.tenantId)) {
        byTenant.set(job.tenantId, {
          displayName:             job.tenantDisplayName,
          authMode:                job.authMode,
          clientId:                job.clientId ?? null,
          logAnalyticsWorkspaceId: job.logAnalytics?.workspaceId ?? null,
          notifications:           buildNotificationSummary(job),
        });
      }
    }

    const runtimeStore = getRuntimeStateStore();

    const profiles = await Promise.all(
      [...byTenant.entries()].map(async ([tenantId, meta]) => {
        const jobsForTenant = jobs.filter((j) => j.tenantId === tenantId);
        const states = await Promise.all(jobsForTenant.map((j) => runtimeStore.read(j.id)));
        const timestamps = states.map((s) => s.lastRunAt).filter(Boolean) as string[];
        const lastRunAt = timestamps.sort().at(-1) ?? null;

        const now = new Date().toISOString();
        return {
          tenantId,
          displayName:             meta.displayName,
          authMode:                meta.authMode,
          clientId:                meta.clientId,
          username:                null,
          logAnalyticsWorkspaceId: meta.logAnalyticsWorkspaceId,
          createdAt:               now,
          updatedAt:               lastRunAt ?? now,
          lastPreflightAt:         lastRunAt,
          lastSuccessfulScanAt:    lastRunAt,
          notifications:           meta.notifications,
        };
      }),
    );

    return json(profiles);
  } catch (err) {
    context.error(`Tenants list failed: ${err}`);
    return json({ error: String(err) }, 500);
  }
}

// ── GET /api/tenants/{tenantId}/secrets ───────────────────────────────────────

app.http('secrets', {
  methods: ['GET'],
  route: 'tenants/{tenantId}/secrets',
  authLevel: 'function',
  handler: secretsHandler,
});

async function secretsHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const tenantId = req.params['tenantId'];
  try {
    const job = await findPrimaryJob(tenantId);
    if (!job) return json({ error: `No job configured for tenant ${tenantId}` }, 404);
    const data = await getResultStore().getLatestSecrets(tenantId);
    if (!data) return json({ error: 'No scan data available — run a scan first' }, 404);
    return json(data);
  } catch (err) {
    context.error(`Secrets fetch failed: ${err}`);
    return json({ error: String(err) }, 500);
  }
}

// ── GET /api/tenants/{tenantId}/preflight ─────────────────────────────────────

app.http('preflight', {
  methods: ['GET'],
  route: 'tenants/{tenantId}/preflight',
  authLevel: 'function',
  handler: preflightHandler,
});

async function preflightHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const tenantId = req.params['tenantId'];
  try {
    const job = await findPrimaryJob(tenantId);
    if (!job) return json({ error: `No job configured for tenant ${tenantId}` }, 404);
    const data = await getResultStore().getLatestPreflight(tenantId);
    if (!data) return json({ error: 'No preflight data available — run a scan first' }, 404);
    return json(data);
  } catch (err) {
    context.error(`Preflight fetch failed: ${err}`);
    return json({ error: String(err) }, 500);
  }
}

// ── POST /api/tenants/{tenantId}/scan ─────────────────────────────────────────
// Triggers an immediate scan for this tenant and sends Teams notifications
// according to the job configuration, just like the scheduled timer trigger.

app.http('manualScan', {
  methods: ['POST'],
  route: 'tenants/{tenantId}/scan',
  authLevel: 'function',
  handler: manualScanHandler,
});

async function manualScanHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const tenantId = req.params['tenantId'];

  const jobs = await findAllJobs(tenantId);
  if (jobs.length === 0) {
    return json({ error: `No job configured for tenant ${tenantId}` }, 404);
  }

  const started = new Date().toISOString();
  const resultStore = getResultStore();
  const runtimeStore = getRuntimeStateStore();

  // Fire-and-forget: run all jobs for this tenant, send notifications per job.
  Promise.allSettled(
    jobs.map(async (job) => {
      try {
        const result = await executeJob(job);
        const thresholds = evaluateThresholds(result.secretsEnvelope.data, job);

        await Promise.all([
          resultStore.saveSecrets(job.tenantId, result.secretsEnvelope),
          resultStore.savePreflight(job.tenantId, result.preflightEnvelope),
          runtimeStore.write({ jobId: job.id, lastRunAt: started, lastRunStatus: 'success', lastRunSecretsFound: thresholds.secretCount }),
        ]);

        context.log(`Manual scan ${job.id} completed — ${thresholds.secretCount} secrets`);
        await sendSuccessNotifications(job, thresholds, started, context);

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        context.error(`Manual scan ${job.id} failed: ${msg}`);
        await runtimeStore.write({ jobId: job.id, lastRunAt: started, lastRunStatus: 'failed', lastRunSecretsFound: null })
          .catch(() => {});
        await sendErrorNotification(job, msg, started, context);
      }
    }),
  );

  return { status: 202, headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ accepted: true, startedAt: started, jobCount: jobs.length }) };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the first job configured for this tenantId, or null. */
async function findPrimaryJob(tenantId: string): Promise<JobConfig | null> {
  const { jobs } = await getJobConfigStore().readJobs();
  return jobs.find((j) => j.tenantId === tenantId) ?? null;
}

/** Returns all jobs configured for this tenantId. */
async function findAllJobs(tenantId: string): Promise<JobConfig[]> {
  const { jobs } = await getJobConfigStore().readJobs();
  return jobs.filter((j) => j.tenantId === tenantId);
}

interface NotificationChannelSummary {
  teamsStatus: boolean;
  teamsAlerts: boolean;
  teamsErrors: boolean;
  mailCount: number;
  mailCritical: boolean;
  mailExpiring: boolean;
  mailStatus: boolean;
  mailError: boolean;
}

function buildNotificationSummary(job: JobConfig): NotificationChannelSummary {
  const mail = job.mailTargets;
  return {
    teamsStatus: !!(job.teamsWebhooks?.status),
    teamsAlerts: !!(job.teamsWebhooks?.alerts),
    teamsErrors: !!(job.teamsWebhooks?.errors),
    mailCount:   mail?.to?.length ?? 0,
    mailCritical: mail ? (mail.sendOnCritical ?? true) : false,
    mailExpiring: mail ? (mail.sendOnExpiring ?? true) : false,
    mailStatus:   mail ? (mail.sendOnStatus   ?? false) : false,
    mailError:    mail ? (mail.sendOnError     ?? true) : false,
  };
}

function json(body: unknown, status = 200): HttpResponseInit {
  return {
    status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body, null, 2),
  };
}

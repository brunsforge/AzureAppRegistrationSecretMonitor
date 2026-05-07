import { app } from '@azure/functions';
import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getJobConfigStore, getResultStore, getRuntimeStateStore } from '../storage/stores.js';
import { executeJob } from '../scan/JobExecutor.js';

// ── GET /api/tenants ──────────────────────────────────────────────────────────

app.http('tenants', {
  methods: ['GET'],
  route: 'tenants',
  authLevel: 'function',
  handler: async (_req, context) => tenantsHandler(context),
});

async function tenantsHandler(context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const tenantEnvs = await getResultStore().listTenantEnvironments();
    const grouped = new Map<string, string[]>();
    for (const { tenantId, envName } of tenantEnvs) {
      const envs = grouped.get(tenantId) ?? [];
      envs.push(envName);
      grouped.set(tenantId, envs);
    }
    return json([...grouped.entries()].map(([tenantId, environments]) => ({ tenantId, environments })));
  } catch (err) {
    context.error(`Tenants list failed: ${err}`);
    return json({ error: String(err) }, 500);
  }
}

// ── GET /api/tenants/{tenantId}/environments/{envName}/secrets ────────────────

app.http('secrets', {
  methods: ['GET'],
  route: 'tenants/{tenantId}/environments/{envName}/secrets',
  authLevel: 'function',
  handler: secretsHandler,
});

async function secretsHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const tenantId = req.params['tenantId'];
  const envName = req.params['envName'];
  try {
    const data = await getResultStore().getLatestSecrets(tenantId, envName);
    if (!data) return json({ error: 'No scan data available' }, 404);
    return json(data);
  } catch (err) {
    context.error(`Secrets fetch failed: ${err}`);
    return json({ error: String(err) }, 500);
  }
}

// ── GET /api/tenants/{tenantId}/environments/{envName}/preflight ──────────────

app.http('preflight', {
  methods: ['GET'],
  route: 'tenants/{tenantId}/environments/{envName}/preflight',
  authLevel: 'function',
  handler: preflightHandler,
});

async function preflightHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const tenantId = req.params['tenantId'];
  const envName = req.params['envName'];
  try {
    const data = await getResultStore().getLatestPreflight(tenantId, envName);
    if (!data) return json({ error: 'No preflight data available' }, 404);
    return json(data);
  } catch (err) {
    context.error(`Preflight fetch failed: ${err}`);
    return json({ error: String(err) }, 500);
  }
}

// ── POST /api/tenants/{tenantId}/environments/{envName}/scan ──────────────────

app.http('manualScan', {
  methods: ['POST'],
  route: 'tenants/{tenantId}/environments/{envName}/scan',
  authLevel: 'function',
  handler: manualScanHandler,
});

async function manualScanHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const tenantId = req.params['tenantId'];
  const envName = req.params['envName'];

  const { jobs } = await getJobConfigStore().readJobs();
  const job = jobs.find((j) => j.tenantId === tenantId && j.environmentName === envName);
  if (!job) {
    return json({ error: `No job configured for tenant ${tenantId} / env ${envName}` }, 404);
  }

  const started = new Date().toISOString();
  const resultStore = getResultStore();
  const runtimeStore = getRuntimeStateStore();

  // Fire-and-forget; return 202 immediately
  executeJob(job)
    .then(async (result) => {
      await Promise.all([
        resultStore.saveSecrets(tenantId, envName, result.secretsEnvelope),
        resultStore.savePreflight(tenantId, envName, result.preflightEnvelope),
        runtimeStore.write({ jobId: job.id, lastRunAt: started, lastRunStatus: 'success', lastRunSecretsFound: result.secretCount }),
      ]);
      context.log(`Manual scan ${job.id} completed`);
    })
    .catch((err) => {
      context.error(`Manual scan ${job.id} failed: ${err}`);
      runtimeStore.write({ jobId: job.id, lastRunAt: started, lastRunStatus: 'failed', lastRunSecretsFound: null }).catch(() => {});
    });

  return { status: 202, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accepted: true, startedAt: started }) };
}

function json(body: unknown, status = 200): HttpResponseInit {
  return {
    status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body, null, 2),
  };
}

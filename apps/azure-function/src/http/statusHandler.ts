import { app } from '@azure/functions';
import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getJobConfigStore, getRuntimeStateStore } from '../storage/stores.js';

app.http('status', {
  methods: ['GET'],
  route: 'status',
  authLevel: 'function',
  handler: statusHandler,
});

async function statusHandler(_req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const [{ jobs }, ] = await Promise.all([getJobConfigStore().readJobs()]);
    const runtimeStore = getRuntimeStateStore();
    const states = await Promise.all(jobs.map((j) => runtimeStore.read(j.id)));
    const lastRunAt = states
      .map((s) => s.lastRunAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

    return json({
      healthy: true,
      version: '0.1.0',
      jobCount: jobs.length,
      enabledJobCount: jobs.filter((j) => j.enabled).length,
      lastScanAt: lastRunAt,
      storageConnected: true,
    });
  } catch (err) {
    context.error(`Status check failed: ${err}`);
    return json({ healthy: false, error: String(err) }, 500);
  }
}

function json(body: unknown, status = 200): HttpResponseInit {
  return {
    status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body, null, 2),
  };
}

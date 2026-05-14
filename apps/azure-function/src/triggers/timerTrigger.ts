import { app } from '@azure/functions';
import type { InvocationContext, Timer } from '@azure/functions';
import { getJobConfigStore, getResultStore, getRuntimeStateStore } from '../storage/stores.js';
import { selectQualifyingJobs } from '../scan/JobScheduler.js';
import { executeJob } from '../scan/JobExecutor.js';
import { evaluateThresholds, sendSuccessNotifications, sendErrorNotification } from '../notifications/notifyJob.js';
import type { JobRuntimeState } from '../types/RuntimeState.js';

app.timer('aarmScheduleTrigger', {
  schedule: '0 */5 * * * *',
  handler: scheduleTriggerHandler,
});

async function scheduleTriggerHandler(_timer: Timer, context: InvocationContext): Promise<void> {
  const jobStore = getJobConfigStore();
  const resultStore = getResultStore();
  const runtimeStore = getRuntimeStateStore();

  const { jobs } = await jobStore.readJobs();
  context.log(`Timer tick: ${jobs.length} job(s) configured`);

  const states = new Map<string, JobRuntimeState>(
    await Promise.all(
      jobs.map(async (job) => [job.id, await runtimeStore.read(job.id)] as const),
    ),
  );

  const qualifying = selectQualifyingJobs(jobs, states);
  context.log(`${qualifying.length} job(s) qualify for this tick`);
  if (qualifying.length === 0) return;

  await Promise.allSettled(
    qualifying.map(async ({ job }) => {
      context.log(`Starting job: ${job.id} (${job.tenantDisplayName} / ${job.environmentName})`);
      const started = new Date().toISOString();

      try {
        const result = await executeJob(job);
        const thresholds = evaluateThresholds(result.secretsEnvelope.data, job);

        await Promise.all([
          resultStore.saveSecrets(job.tenantId, result.secretsEnvelope),
          resultStore.savePreflight(job.tenantId, result.preflightEnvelope),
          runtimeStore.write({
            jobId: job.id,
            lastRunAt: started,
            lastRunStatus: 'success',
            lastRunSecretsFound: thresholds.secretCount,
          }),
        ]);

        context.log(`Job ${job.id} OK — ${thresholds.secretCount} secrets, ${thresholds.criticalCount} critical`);
        await sendSuccessNotifications(job, thresholds, started, context);

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        context.error(`Job ${job.id} failed: ${msg}`);
        await runtimeStore.write({
          jobId: job.id,
          lastRunAt: started,
          lastRunStatus: 'failed',
          lastRunSecretsFound: null,
        });
        await sendErrorNotification(job, msg, started, context);
      }
    }),
  );
}

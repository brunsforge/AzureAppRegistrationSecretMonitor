import { app } from '@azure/functions';
import type { InvocationContext, Timer } from '@azure/functions';
import { getJobConfigStore, getResultStore, getRuntimeStateStore } from '../storage/stores.js';
import { selectQualifyingJobs } from '../scan/JobScheduler.js';
import { executeJob } from '../scan/JobExecutor.js';
import { TemplateLoader } from '../notifications/TemplateLoader.js';
import { renderTemplate } from '../notifications/NotificationRenderer.js';
import { postToTeams } from '../notifications/TeamsNotifier.js';
import { evaluateThresholds } from '../notifications/ThresholdEvaluator.js';
import type { JobRuntimeState } from '../types/RuntimeState.js';
import type { JobConfig } from '../types/JobConfig.js';

app.timer('aarmScheduleTrigger', {
  schedule: '0 */5 * * * *',
  handler: scheduleTriggerHandler,
});

async function scheduleTriggerHandler(_timer: Timer, context: InvocationContext): Promise<void> {
  const jobStore = getJobConfigStore();
  const resultStore = getResultStore();
  const runtimeStore = getRuntimeStateStore();
  const templateLoader = new TemplateLoader(jobStore);

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
          resultStore.saveSecrets(job.tenantId, job.environmentName, result.secretsEnvelope),
          resultStore.savePreflight(job.tenantId, job.environmentName, result.preflightEnvelope),
          runtimeStore.write({
            jobId: job.id,
            lastRunAt: started,
            lastRunStatus: 'success',
            lastRunSecretsFound: thresholds.secretCount,
          }),
        ]);

        context.log(`Job ${job.id} OK — ${thresholds.secretCount} secrets, ${thresholds.criticalCount} critical`);
        await sendSuccessNotifications(job, thresholds, started, templateLoader, context);

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        context.error(`Job ${job.id} failed: ${msg}`);
        await runtimeStore.write({
          jobId: job.id,
          lastRunAt: started,
          lastRunStatus: 'failed',
          lastRunSecretsFound: null,
        });
        await sendErrorNotification(job, msg, started, templateLoader, context);
      }
    }),
  );
}

async function sendSuccessNotifications(
  job: JobConfig,
  thresholds: ReturnType<typeof evaluateThresholds>,
  scanTimestamp: string,
  loader: TemplateLoader,
  context: InvocationContext,
): Promise<void> {
  const dashboardUrl = process.env['AARM_DASHBOARD_URL'] ?? '';
  const base = {
    tenantDisplayName: job.tenantDisplayName,
    environmentName: job.environmentName,
    scanTimestamp,
    secretCount: String(thresholds.secretCount),
    expiringCount: String(thresholds.expiringCount),
    criticalCount: String(thresholds.criticalCount),
    dashboardUrl,
  };

  const tasks: Promise<void>[] = [];

  if (job.teamsWebhooks?.alerts) {
    const webhook = job.teamsWebhooks.alerts;
    if (thresholds.hasCritical) {
      tasks.push(notify(loader, 'critical', job.notificationTemplates?.critical, base, webhook, context));
    } else if (thresholds.hasExpiring) {
      tasks.push(notify(loader, 'expiring', job.notificationTemplates?.expiring, base, webhook, context));
    }
  }

  if (job.teamsWebhooks?.status) {
    tasks.push(notify(loader, 'summary', job.notificationTemplates?.summary, base, job.teamsWebhooks.status, context));
  }

  await Promise.allSettled(tasks);
}

async function sendErrorNotification(
  job: JobConfig,
  errorMessage: string,
  timestamp: string,
  loader: TemplateLoader,
  context: InvocationContext,
): Promise<void> {
  if (!job.teamsWebhooks?.errors) return;
  const dashboardUrl = process.env['AARM_DASHBOARD_URL'] ?? '';
  await notify(
    loader,
    'error',
    job.notificationTemplates?.error,
    { tenantDisplayName: job.tenantDisplayName, environmentName: job.environmentName, errorMessage, timestamp, dashboardUrl },
    job.teamsWebhooks.errors,
    context,
  );
}

async function notify(
  loader: TemplateLoader,
  key: Parameters<typeof loader.load>[0],
  customBlob: string | null | undefined,
  context: Record<string, string>,
  webhookUrl: string,
  invCtx: InvocationContext,
): Promise<void> {
  try {
    const template = await loader.load(key, customBlob);
    const payload = renderTemplate(template, context as never);
    await postToTeams(webhookUrl, payload);
  } catch (err) {
    invCtx.warn(`Teams notification (${key}) failed: ${err}`);
  }
}

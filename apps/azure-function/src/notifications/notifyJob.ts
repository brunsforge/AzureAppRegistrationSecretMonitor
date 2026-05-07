import type { InvocationContext } from '@azure/functions';
import { TemplateLoader } from './TemplateLoader.js';
import { renderTemplate } from './NotificationRenderer.js';
import { postToTeams } from './TeamsNotifier.js';
import { evaluateThresholds } from './ThresholdEvaluator.js';
import type { AppRegistrationSummary } from '@brunsforge/azure-app-registration-monitor';
import type { JobConfig } from '../types/JobConfig.js';
import { getJobConfigStore } from '../storage/stores.js';

export type ThresholdSummary = ReturnType<typeof evaluateThresholds>;

export async function sendSuccessNotifications(
  job: JobConfig,
  thresholds: ThresholdSummary,
  scanTimestamp: string,
  context: InvocationContext,
): Promise<void> {
  const loader = new TemplateLoader(getJobConfigStore());
  const dashboardUrl = process.env['AARM_DASHBOARD_URL'] ?? '';
  const base = {
    tenantDisplayName: job.tenantDisplayName,
    environmentName:   job.environmentName,
    scanTimestamp,
    secretCount:   String(thresholds.secretCount),
    expiringCount: String(thresholds.expiringCount),
    criticalCount: String(thresholds.criticalCount),
    dashboardUrl,
  };

  const tasks: Promise<void>[] = [];

  if (job.teamsWebhooks?.alerts) {
    const webhook = job.teamsWebhooks.alerts;
    if (thresholds.hasCritical) {
      tasks.push(notifyOne(loader, 'critical', job.notificationTemplates?.critical, base, webhook, context));
    } else if (thresholds.hasExpiring) {
      tasks.push(notifyOne(loader, 'expiring', job.notificationTemplates?.expiring, base, webhook, context));
    }
  }

  if (job.teamsWebhooks?.status) {
    tasks.push(notifyOne(loader, 'summary', job.notificationTemplates?.summary, base, job.teamsWebhooks.status, context));
  }

  await Promise.allSettled(tasks);
}

export async function sendErrorNotification(
  job: JobConfig,
  errorMessage: string,
  timestamp: string,
  context: InvocationContext,
): Promise<void> {
  if (!job.teamsWebhooks?.errors) return;
  const loader = new TemplateLoader(getJobConfigStore());
  const dashboardUrl = process.env['AARM_DASHBOARD_URL'] ?? '';
  await notifyOne(
    loader,
    'error',
    job.notificationTemplates?.error,
    { tenantDisplayName: job.tenantDisplayName, environmentName: job.environmentName, errorMessage, timestamp, dashboardUrl },
    job.teamsWebhooks.errors,
    context,
  );
}

/** Builds thresholds from an AppRegistrationSummary[] result. */
export { evaluateThresholds };

async function notifyOne(
  loader: TemplateLoader,
  key: Parameters<typeof loader.load>[0],
  customBlob: string | null | undefined,
  ctx: Record<string, string>,
  webhookUrl: string,
  invCtx: InvocationContext,
): Promise<void> {
  try {
    const template = await loader.load(key, customBlob);
    const payload = renderTemplate(template, ctx as never);
    await postToTeams(webhookUrl, payload);
  } catch (err) {
    invCtx.warn(`Teams notification (${key}) failed: ${err}`);
  }
}

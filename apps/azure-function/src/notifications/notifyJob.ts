import type { InvocationContext } from '@azure/functions';
import { TemplateLoader } from './TemplateLoader.js';
import { renderTemplate } from './NotificationRenderer.js';
import { postToTeams } from './TeamsNotifier.js';
import { sendMail, isAcsConfigured } from './AcsMailSender.js';
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
    scanTimestamp,
    secretCount:   String(thresholds.secretCount),
    expiringCount: String(thresholds.expiringCount),
    criticalCount: String(thresholds.criticalCount),
    dashboardUrl,
  };

  const tasks: Promise<void>[] = [];

  // ── Teams notifications ────────────────────────────────────────────────────
  if (job.teamsWebhooks?.alerts) {
    const webhook = job.teamsWebhooks.alerts;
    if (thresholds.hasCritical) {
      tasks.push(notifyTeams(loader, 'critical', job.notificationTemplates?.critical, base, webhook, context));
    } else if (thresholds.hasExpiring) {
      tasks.push(notifyTeams(loader, 'expiring', job.notificationTemplates?.expiring, base, webhook, context));
    }
  }
  if (job.teamsWebhooks?.status) {
    tasks.push(notifyTeams(loader, 'summary', job.notificationTemplates?.summary, base, job.teamsWebhooks.status, context));
  }

  // ── Mail notifications ─────────────────────────────────────────────────────
  if (job.mailTargets?.to.length && isAcsConfigured()) {
    const mt = job.mailTargets;
    if (mt.sendOnCritical !== false && thresholds.hasCritical) {
      tasks.push(notifyMail(loader, 'emailCritical', job.notificationTemplates?.emailCritical,
        `🚨 CRITICAL: Secrets expiring — ${job.tenantDisplayName}`, base, mt.to, context));
    } else if (mt.sendOnExpiring !== false && thresholds.hasExpiring) {
      tasks.push(notifyMail(loader, 'emailExpiring', job.notificationTemplates?.emailExpiring,
        `⚠️ Secrets expiring soon — ${job.tenantDisplayName}`, base, mt.to, context));
    }
    if (mt.sendOnStatus !== false) {
      tasks.push(notifyMail(loader, 'emailSummary', job.notificationTemplates?.emailSummary,
        `✅ Scan completed — ${job.tenantDisplayName}`, base, mt.to, context));
    }
  }

  await Promise.allSettled(tasks);
}

export async function sendErrorNotification(
  job: JobConfig,
  errorMessage: string,
  timestamp: string,
  context: InvocationContext,
): Promise<void> {
  const loader = new TemplateLoader(getJobConfigStore());
  const dashboardUrl = process.env['AARM_DASHBOARD_URL'] ?? '';
  const errCtx = { tenantDisplayName: job.tenantDisplayName, errorMessage, timestamp, dashboardUrl };

  const tasks: Promise<void>[] = [];

  if (job.teamsWebhooks?.errors) {
    tasks.push(notifyTeams(loader, 'error', job.notificationTemplates?.error, errCtx, job.teamsWebhooks.errors, context));
  }

  if (job.mailTargets?.to.length && isAcsConfigured() && job.mailTargets.sendOnError !== false) {
    tasks.push(notifyMail(loader, 'emailError', job.notificationTemplates?.emailError,
      `❌ Scan failed — ${job.tenantDisplayName}`, errCtx, job.mailTargets.to, context));
  }

  await Promise.allSettled(tasks);
}

export { evaluateThresholds };

// ── Helpers ───────────────────────────────────────────────────────────────────

async function notifyTeams(
  loader: TemplateLoader,
  key: Parameters<typeof loader.load>[0],
  customBlob: string | null | undefined,
  ctx: Record<string, string>,
  webhookUrl: string,
  invCtx: InvocationContext,
): Promise<void> {
  try {
    const template = await loader.load(key, customBlob);
    const payload  = renderTemplate(template, ctx as never);
    await postToTeams(webhookUrl, payload);
  } catch (err) {
    invCtx.warn(`Teams notification (${key}) failed: ${err}`);
  }
}

async function notifyMail(
  loader: TemplateLoader,
  key: Parameters<typeof loader.loadMail>[0],
  customBlob: string | null | undefined,
  subject: string,
  ctx: Record<string, string>,
  to: string[],
  invCtx: InvocationContext,
): Promise<void> {
  try {
    const template = await loader.loadMail(key, customBlob);
    const html     = renderTemplate(template, ctx as never) as string;
    await sendMail(to, subject, html);
  } catch (err) {
    invCtx.warn(`Mail notification (${key}) failed: ${err}`);
  }
}

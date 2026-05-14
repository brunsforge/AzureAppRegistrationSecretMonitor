import { app } from '@azure/functions';
import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { sendMail, isAcsConfigured } from '../notifications/AcsMailSender.js';
import {
  DEFAULT_MAIL_CRITICAL, DEFAULT_MAIL_EXPIRING,
  DEFAULT_MAIL_SUMMARY, DEFAULT_MAIL_ERROR,
} from '../notifications/defaultMailTemplates.js';

interface TestNotificationBody {
  channel: 'mail';
  templateKey: 'emailCritical' | 'emailExpiring' | 'emailSummary' | 'emailError';
  to: string[];
  demoData?: {
    tenantDisplayName?: string;
    scanTimestamp?: string;
    secretCount?: string;
    expiringCount?: string;
    criticalCount?: string;
    dashboardUrl?: string;
    errorMessage?: string;
    timestamp?: string;
  };
}

app.http('testNotification', {
  methods: ['POST'],
  route: 'notifications/test',
  authLevel: 'function',
  handler: testNotificationHandler,
});

const MAIL_TEMPLATES: Record<string, string> = {
  emailCritical: DEFAULT_MAIL_CRITICAL,
  emailExpiring: DEFAULT_MAIL_EXPIRING,
  emailSummary:  DEFAULT_MAIL_SUMMARY,
  emailError:    DEFAULT_MAIL_ERROR,
};

const SUBJECTS: Record<string, string> = {
  emailCritical: '🚨 [TEST] CRITICAL: Secrets Expiring',
  emailExpiring: '⚠️ [TEST] Secrets Expiring Soon',
  emailSummary:  '✅ [TEST] Scan Completed',
  emailError:    '❌ [TEST] Scan Failed',
};

async function testNotificationHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const body = await req.json() as TestNotificationBody;

  if (body.channel !== 'mail') {
    return json({ error: 'Only channel "mail" is supported via this endpoint. Teams webhooks are called directly from the client.' }, 400);
  }

  if (!body.to?.length) {
    return json({ error: '"to" array with at least one email address is required.' }, 400);
  }

  if (!isAcsConfigured()) {
    return json({ error: 'ACS is not configured on this Function App (AARM_ACS_CONNECTION_STRING or AARM_ACS_SENDER_EMAIL missing).' }, 503);
  }

  const template = MAIL_TEMPLATES[body.templateKey];
  if (!template) {
    return json({ error: `Unknown templateKey "${body.templateKey}".` }, 400);
  }

  const demo = body.demoData ?? {};
  const ctx: Record<string, string> = {
    tenantDisplayName: demo.tenantDisplayName ?? 'Test Tenant',
    scanTimestamp:     demo.scanTimestamp     ?? new Date().toISOString(),
    secretCount:       demo.secretCount       ?? '42',
    expiringCount:     demo.expiringCount     ?? '8',
    criticalCount:     demo.criticalCount     ?? '3',
    dashboardUrl:      demo.dashboardUrl      ?? (process.env['AARM_DASHBOARD_URL'] ?? '#'),
    errorMessage:      demo.errorMessage      ?? 'Test error message.',
    timestamp:         demo.timestamp         ?? new Date().toISOString(),
  };

  const html = applyContext(template, ctx);
  const subject = `${SUBJECTS[body.templateKey]} — ${ctx.tenantDisplayName}`;

  try {
    await sendMail(body.to, subject, html);
    context.log(`Test mail sent to ${body.to.join(', ')} (template: ${body.templateKey})`);
    return json({ sent: true, to: body.to, subject });
  } catch (err) {
    context.error(`Test mail failed: ${err}`);
    return json({ error: String(err) }, 500);
  }
}

function applyContext(template: string, ctx: Record<string, string>): string {
  return Object.entries(ctx).reduce(
    (t, [k, v]) => t.replaceAll(`{{${k}}}`, v),
    template,
  );
}

function json(body: unknown, status = 200): HttpResponseInit {
  return { status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

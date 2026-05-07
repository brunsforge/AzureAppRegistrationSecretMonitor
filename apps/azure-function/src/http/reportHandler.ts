import { app } from '@azure/functions';
import type { HttpRequest, HttpResponseInit } from '@azure/functions';
import { getResultStore } from '../storage/stores.js';
import type { AppRegistrationSummary } from '@brunsforge/azure-app-registration-monitor';

app.http('report', {
  methods: ['GET'],
  route: 'report',
  authLevel: 'function',
  handler: reportHandler,
});

async function reportHandler(req: HttpRequest): Promise<HttpResponseInit> {
  const tenantId = req.query.get('tenant') ?? '';
  const envName = req.query.get('env') ?? '';

  if (!tenantId || !envName) {
    return { status: 400, body: 'Query params tenant and env are required' };
  }

  const raw = await getResultStore().getLatestSecrets(tenantId, envName);
  if (!raw) {
    return { status: 404, body: `No scan data for ${tenantId} / ${envName}` };
  }

  const envelope = raw as { data: AppRegistrationSummary[]; metadata: { generatedAt: string } };
  return {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: buildReportHtml(tenantId, envName, envelope.data, envelope.metadata.generatedAt),
  };
}

function buildReportHtml(
  tenantId: string,
  envName: string,
  apps: AppRegistrationSummary[],
  generatedAt: string,
): string {
  const secrets = apps.flatMap((a) => a.secrets);
  const critical = secrets.filter((s) => s.riskLevel === 'Critical').length;
  const expiring = secrets.filter((s) => s.riskLevel === 'High').length;

  const rows = secrets
    .sort((a, b) => (a.daysUntilExpiry ?? 999) - (b.daysUntilExpiry ?? 999))
    .map(
      (s) =>
        `<tr>
          <td>${esc(s.riskLevel)}</td>
          <td>${esc(s.appDisplayName)}</td>
          <td>${esc(s.displayName ?? s.keyId)}</td>
          <td>${(s.endDateTime ?? '—').slice(0, 10)}</td>
          <td>${s.daysUntilExpiry ?? '—'}</td>
          <td>${esc(s.status)}</td>
        </tr>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>AARM Report — ${esc(tenantId)} / ${esc(envName)}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:2rem;color:#111;background:#fff}
  h1{font-size:1.4rem;margin-bottom:.25rem}
  .meta{font-size:.8rem;color:#666;margin-bottom:1.5rem}
  .summary{display:flex;gap:2rem;margin-bottom:1.5rem}
  .stat{font-size:1.8rem;font-weight:700} .slabel{font-size:.75rem;color:#666}
  .critical .stat{color:#dc2626} .warning .stat{color:#d97706} .ok .stat{color:#16a34a}
  table{width:100%;border-collapse:collapse;font-size:.8rem}
  th{text-align:left;padding:.5rem .75rem;background:#f1f5f9;border-bottom:2px solid #e2e8f0}
  td{padding:.5rem .75rem;border-bottom:1px solid #e2e8f0}
  .Critical{color:#dc2626;font-weight:600} .High{color:#d97706;font-weight:600}
  .Medium{color:#ca8a04} .Low{color:#16a34a} .None{color:#2563eb}
</style>
</head>
<body>
<h1>App Registration Secret Report</h1>
<div class="meta">Tenant: ${esc(tenantId)} &nbsp;|&nbsp; Environment: ${esc(envName)} &nbsp;|&nbsp; Generated: ${esc(generatedAt)}</div>
<div class="summary">
  <div><div class="stat">${secrets.length}</div><div class="slabel">Total Secrets</div></div>
  <div class="critical"><div class="stat">${critical}</div><div class="slabel">Critical</div></div>
  <div class="warning"><div class="stat">${expiring}</div><div class="slabel">High Risk</div></div>
  <div class="ok"><div class="stat">${secrets.length - critical - expiring}</div><div class="slabel">Healthy</div></div>
</div>
<table>
<thead><tr><th>Risk</th><th>App</th><th>Secret</th><th>Expires</th><th>Days Left</th><th>Status</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</body>
</html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

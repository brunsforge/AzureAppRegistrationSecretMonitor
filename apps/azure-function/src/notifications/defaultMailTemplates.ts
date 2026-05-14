/** Built-in HTML email templates. Handlebars {{placeholders}} are identical to Teams templates. */

const HEAD = `<head><meta charset="utf-8">
<style>
  body{font-family:system-ui,sans-serif;background:#f8fafc;margin:0;padding:0}
  .wrap{max-width:600px;margin:2rem auto;background:#fff;border-radius:.5rem;
        border:1px solid #e2e8f0;overflow:hidden}
  .header{padding:1.5rem 2rem;background:#1e293b;color:#fff}
  .header h1{margin:0;font-size:1.25rem}
  .header p{margin:.25rem 0 0;font-size:.85rem;color:#94a3b8}
  .body{padding:1.5rem 2rem}
  table{width:100%;border-collapse:collapse;font-size:.9rem}
  td{padding:.4rem .75rem;border-bottom:1px solid #f1f5f9}
  td:first-child{color:#64748b;width:200px}
  .badge{display:inline-block;padding:.2rem .6rem;border-radius:.25rem;font-size:.8rem;font-weight:600}
  .badge-critical{background:#fef2f2;color:#dc2626}
  .badge-warning{background:#fffbeb;color:#d97706}
  .badge-ok{background:#f0fdf4;color:#16a34a}
  .btn{display:inline-block;margin-top:1.5rem;padding:.6rem 1.4rem;background:#3b82f6;
       color:#fff;text-decoration:none;border-radius:.375rem;font-size:.9rem;font-weight:600}
  .footer{padding:.75rem 2rem;background:#f8fafc;font-size:.75rem;color:#94a3b8;
          border-top:1px solid #e2e8f0}
</style></head>`;

export const DEFAULT_MAIL_CRITICAL = `<!DOCTYPE html><html lang="en">${HEAD}<body>
<div class="wrap">
  <div class="header">
    <h1>🚨 CRITICAL — Secrets Expiring</h1>
    <p>{{tenantDisplayName}}</p>
  </div>
  <div class="body">
    <p>Immediate action required. One or more secrets will expire very soon.</p>
    <table>
      <tr><td>Critical (expire very soon)</td><td><span class="badge badge-critical">{{criticalCount}}</span></td></tr>
      <tr><td>Expiring (within threshold)</td><td><span class="badge badge-warning">{{expiringCount}}</span></td></tr>
      <tr><td>Total secrets monitored</td><td>{{secretCount}}</td></tr>
      <tr><td>Scanned at (UTC)</td><td>{{scanTimestamp}}</td></tr>
    </table>
    <a href="{{dashboardUrl}}" class="btn">Open Dashboard</a>
  </div>
  <div class="footer">Azure App Registration Monitor · Cloud Mode</div>
</div></body></html>`;

export const DEFAULT_MAIL_EXPIRING = `<!DOCTYPE html><html lang="en">${HEAD}<body>
<div class="wrap">
  <div class="header">
    <h1>⚠️ Secrets Expiring Soon</h1>
    <p>{{tenantDisplayName}}</p>
  </div>
  <div class="body">
    <p>Some secrets are approaching their expiry date. Plan rotation soon.</p>
    <table>
      <tr><td>Expiring within threshold</td><td><span class="badge badge-warning">{{expiringCount}}</span></td></tr>
      <tr><td>Total secrets monitored</td><td>{{secretCount}}</td></tr>
      <tr><td>Scanned at (UTC)</td><td>{{scanTimestamp}}</td></tr>
    </table>
    <a href="{{dashboardUrl}}" class="btn">Open Dashboard</a>
  </div>
  <div class="footer">Azure App Registration Monitor · Cloud Mode</div>
</div></body></html>`;

export const DEFAULT_MAIL_SUMMARY = `<!DOCTYPE html><html lang="en">${HEAD}<body>
<div class="wrap">
  <div class="header">
    <h1>✅ Scan Completed</h1>
    <p>{{tenantDisplayName}}</p>
  </div>
  <div class="body">
    <table>
      <tr><td>Total secrets monitored</td><td>{{secretCount}}</td></tr>
      <tr><td>Expiring</td><td>{{expiringCount}}</td></tr>
      <tr><td>Critical</td><td>{{criticalCount}}</td></tr>
      <tr><td>Scanned at (UTC)</td><td>{{scanTimestamp}}</td></tr>
    </table>
    <a href="{{dashboardUrl}}" class="btn">Open Dashboard</a>
  </div>
  <div class="footer">Azure App Registration Monitor · Cloud Mode</div>
</div></body></html>`;

export const DEFAULT_MAIL_ERROR = `<!DOCTYPE html><html lang="en">${HEAD}<body>
<div class="wrap">
  <div class="header" style="background:#7f1d1d">
    <h1>❌ Scan Failed</h1>
    <p>{{tenantDisplayName}}</p>
  </div>
  <div class="body">
    <p><strong>Error:</strong></p>
    <pre style="background:#fef2f2;border:1px solid #fecaca;padding:.75rem;border-radius:.375rem;
                font-size:.85rem;white-space:pre-wrap">{{errorMessage}}</pre>
    <table>
      <tr><td>Failed at (UTC)</td><td>{{timestamp}}</td></tr>
    </table>
    <a href="{{dashboardUrl}}" class="btn" style="background:#dc2626">Open Dashboard</a>
  </div>
  <div class="footer">Azure App Registration Monitor · Cloud Mode</div>
</div></body></html>`;

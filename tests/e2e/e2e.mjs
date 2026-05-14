/**
 * AARM Azure Function — End-to-End Test Suite
 *
 * Ablauf:
 *   1. Health-Check (GET /api/status)
 *   2. Tenant anlegen (POST /api/tenants)
 *   3. Tenant in Liste prüfen (GET /api/tenants)
 *   4. Scan auslösen (POST /api/tenants/{id}/scan)
 *   5. Auf Scan-Ergebnis warten
 *   6. Secrets-Ergebnis verifizieren (GET /api/tenants/{id}/secrets)
 *   7. Preflight-Ergebnis verifizieren (GET /api/tenants/{id}/preflight)
 *   8. Dashboard erreichbar prüfen (GET /api/dashboard)
 *   9. Report erreichbar prüfen (GET /api/report)
 *  10. Tenant löschen (DELETE /api/tenants/{id}) — Cleanup
 *
 * Verwendung:
 *   cp .env.template .env   # Werte eintragen
 *   npm test
 */

// ── Konfiguration ──────────────────────────────────────────────────────────────

const cfg = {
  baseUrl:       requireEnv('AARM_BASE_URL').replace(/\/$/, ''),
  functionKey:   requireEnv('AARM_FUNCTION_KEY'),
  tenantId:      requireEnv('AARM_TEST_TENANT_ID'),
  tenantName:    process.env.AARM_TEST_TENANT_NAME ?? 'AARM E2E Test Tenant',
  clientId:      requireEnv('AARM_TEST_CLIENT_ID'),
  clientSecret:  requireEnv('AARM_TEST_CLIENT_SECRET'),
  scanTimeoutMs: parseInt(process.env.AARM_SCAN_TIMEOUT_SEC ?? '60') * 1000,
  verbose:       process.env.AARM_VERBOSE === '1',
};

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Env var ${name} is required. Copy .env.template to .env and fill it in.`);
  return v;
}

// ── Test-Runner ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  process.stdout.write(`  ${name} … `);
  try {
    await fn();
    console.log('\x1b[32m✓\x1b[0m');
    passed++;
  } catch (err) {
    console.log('\x1b[31m✗\x1b[0m');
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`    \x1b[31m${msg}\x1b[0m`);
    failures.push({ name, msg });
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function section(title) {
  console.log(`\n\x1b[36m${title}\x1b[0m`);
}

// ── HTTP-Helfer ────────────────────────────────────────────────────────────────

async function api(method, path, body) {
  const url = `${cfg.baseUrl}${path}`;
  const headers = { 'x-functions-key': cfg.functionKey };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (cfg.verbose) console.log(`    → ${method} ${url}`);

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }

  if (cfg.verbose) console.log(`    ← ${res.status}`, typeof json === 'object' ? JSON.stringify(json).slice(0, 200) : text.slice(0, 200));

  return { status: res.status, body: json, headers: res.headers };
}

async function waitForScanResult(tenantId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const interval = 5000;
  process.stdout.write(`    Warte auf Scan-Ergebnis (max ${timeoutMs / 1000}s)`);

  while (Date.now() < deadline) {
    await sleep(interval);
    process.stdout.write('.');
    const res = await api('GET', `/api/tenants/${tenantId}/secrets`);
    if (res.status === 200 && res.body?.data !== undefined) {
      console.log(' erhalten');
      return res.body;
    }
  }
  console.log(' Timeout!');
  throw new Error(`Kein Scan-Ergebnis nach ${timeoutMs / 1000}s`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Tests ──────────────────────────────────────────────────────────────────────

console.log('\n\x1b[1mAARM Azure Function — E2E Test Suite\x1b[0m');
console.log(`Base URL   : ${cfg.baseUrl}`);
console.log(`Tenant     : ${cfg.tenantName} (${cfg.tenantId})`);
console.log(`Client ID  : ${cfg.clientId}`);
console.log('');

let secretsResult = null;
let preflightResult = null;

// ── 1. Health ──────────────────────────────────────────────────────────────────
section('1 · Health-Check');

await test('GET /api/status → 200', async () => {
  const res = await api('GET', '/api/status');
  assert(res.status === 200, `Erwartet 200, erhalten ${res.status}`);
  assert(res.body.healthy === true, `healthy ist nicht true: ${JSON.stringify(res.body)}`);
  assert(typeof res.body.version === 'string', 'version fehlt');
  assert(typeof res.body.jobCount === 'number', 'jobCount fehlt');
});

// ── 2. Tenant anlegen ──────────────────────────────────────────────────────────
section('2 · Tenant anlegen (POST /api/tenants)');

await test('POST /api/tenants → 201', async () => {
  const res = await api('POST', '/api/tenants', {
    tenantId:          cfg.tenantId,
    tenantDisplayName: cfg.tenantName,
    authMode:          'client-secret',
    clientId:          cfg.clientId,
    credentialValue:   cfg.clientSecret,
    schedule:          { intervalDays: 1, runAtUtc: '06:00' },
    notificationThresholds: { expiringWithinDays: 30, criticalWithinDays: 7 },
    teamsWebhooks:     { status: null, alerts: null, errors: null },
    logAnalytics:      { workspaceId: null, enabled: false },
  });
  assert(res.status === 201, `Erwartet 201, erhalten ${res.status}: ${JSON.stringify(res.body)}`);
  assert(res.body.tenantId === cfg.tenantId, 'tenantId stimmt nicht überein');
});

await test('POST /api/tenants nochmal → 409 Conflict', async () => {
  const res = await api('POST', '/api/tenants', {
    tenantId:          cfg.tenantId,
    tenantDisplayName: cfg.tenantName,
    authMode:          'client-secret',
    clientId:          cfg.clientId,
    credentialValue:   'dummy',
    environmentName:   cfg.envName,
  });
  assert(res.status === 409, `Erwartet 409, erhalten ${res.status}`);
});

// ── 3. Tenant in Liste prüfen ──────────────────────────────────────────────────
section('3 · Tenant-Liste (GET /api/tenants)');

await test('GET /api/tenants enthält neuen Tenant', async () => {
  const res = await api('GET', '/api/tenants');
  assert(res.status === 200, `Erwartet 200, erhalten ${res.status}`);
  assert(Array.isArray(res.body), 'Antwort ist kein Array');
  const entry = res.body.find(t => t.tenantId === cfg.tenantId);
  assert(entry, `Tenant ${cfg.tenantId} nicht in Liste gefunden`);
  assert(entry.displayName === cfg.tenantName, 'displayName stimmt nicht überein');
  assert(entry.authMode === 'client-secret', 'authMode stimmt nicht überein');
});

// ── 4. Tenant aktualisieren ────────────────────────────────────────────────────
section('4 · Tenant aktualisieren (PUT /api/tenants/{tenantId})');

await test('PUT /api/tenants → 200', async () => {
  const res = await api('PUT', `/api/tenants/${cfg.tenantId}`, {
    tenantId:          cfg.tenantId,
    tenantDisplayName: `${cfg.tenantName} (updated)`,
    authMode:          'client-secret',
    clientId:          cfg.clientId,
    environmentName:   cfg.envName,
    schedule:          { intervalDays: 1, runAtUtc: '06:00' },
    notificationThresholds: { expiringWithinDays: 30, criticalWithinDays: 7 },
  });
  assert(res.status === 200, `Erwartet 200, erhalten ${res.status}: ${JSON.stringify(res.body)}`);
  assert(res.body.tenantId === cfg.tenantId, 'tenantId fehlt');
});

await test('PUT nicht-existierender Tenant → 404', async () => {
  const res = await api('PUT', '/api/tenants/00000000-0000-0000-0000-000000000000', {
    tenantId:          '00000000-0000-0000-0000-000000000000',
    tenantDisplayName: 'Ghost',
    authMode:          'client-secret',
    clientId:          '00000000-0000-0000-0000-000000000000',
  });
  assert(res.status === 404, `Erwartet 404, erhalten ${res.status}`);
});

// ── 5. Scan auslösen ───────────────────────────────────────────────────────────
section('5 · Scan auslösen (POST /api/tenants/{tenantId}/scan)');

await test('POST /api/tenants/{tenantId}/scan → 202', async () => {
  const res = await api('POST', `/api/tenants/${cfg.tenantId}/scan`);
  assert(res.status === 202, `Erwartet 202, erhalten ${res.status}: ${JSON.stringify(res.body)}`);
  assert(res.body.accepted === true, 'accepted ist nicht true');
  assert(typeof res.body.startedAt === 'string', 'startedAt fehlt');
  assert(res.body.jobCount >= 1, 'jobCount < 1');
});

await test('POST /api/tenants/{tenantId}/scan nicht-existierend → 404', async () => {
  const res = await api('POST', '/api/tenants/00000000-0000-0000-0000-000000000000/scan');
  assert(res.status === 404, `Erwartet 404, erhalten ${res.status}`);
});

// ── 6. Scan-Ergebnis abwarten und verifizieren ─────────────────────────────────
section('6 · Secrets-Ergebnis (GET /api/tenants/{tenantId}/secrets)');

await test(`Warte auf Scan-Ergebnis (Timeout: ${cfg.scanTimeoutMs / 1000}s)`, async () => {
  secretsResult = await waitForScanResult(cfg.tenantId, cfg.scanTimeoutMs);
  assert(secretsResult !== null, 'Kein Ergebnis erhalten');
});

await test('ResultEnvelope hat korrekte Struktur', async () => {
  assert(secretsResult !== null, 'Kein secretsResult — vorheriger Test fehlgeschlagen');
  assert(secretsResult.success === true, `success ist nicht true: ${JSON.stringify(secretsResult)}`);
  assert(typeof secretsResult.metadata === 'object', 'metadata fehlt');
  assert(secretsResult.metadata.tenantId === cfg.tenantId, 'tenantId in metadata stimmt nicht');
  assert(typeof secretsResult.metadata.generatedAt === 'string', 'generatedAt fehlt');
  assert(Array.isArray(secretsResult.data), 'data ist kein Array');
  assert(Array.isArray(secretsResult.warnings), 'warnings ist kein Array');
  assert(Array.isArray(secretsResult.errors), 'errors ist kein Array');
});

await test('App-Registrierungen im Ergebnis enthalten', async () => {
  assert(secretsResult !== null, 'Kein secretsResult');
  assert(secretsResult.data.length > 0, 'Keine App-Registrierungen gefunden — hat der Zieltenant App Registrations?');
  const app = secretsResult.data[0];
  assert(typeof app.appId === 'string', 'appId fehlt');
  assert(typeof app.displayName === 'string', 'displayName fehlt');
  assert(typeof app.secretCount === 'number', 'secretCount fehlt');
  assert(Array.isArray(app.secrets), 'secrets ist kein Array');
  assert(['Critical', 'High', 'Medium', 'Low', 'None'].includes(app.riskLevel),
    `Ungültiges riskLevel: ${app.riskLevel}`);
});

await test('Secret-Einträge haben korrektes Schema', async () => {
  assert(secretsResult !== null, 'Kein secretsResult');
  const allSecrets = secretsResult.data.flatMap(a => a.secrets);
  if (allSecrets.length === 0) {
    console.log('\n    (keine Secrets im Zieltenant — Schema-Check übersprungen)');
    return;
  }
  const s = allSecrets[0];
  assert(typeof s.keyId === 'string', 'keyId fehlt');
  assert(typeof s.status === 'string', 'status fehlt');
  assert(['Active', 'ExpiringSoon', 'Expired'].includes(s.status),
    `Ungültiger status: ${s.status}`);
  assert(['Critical', 'High', 'Medium', 'Low', 'None'].includes(s.riskLevel),
    `Ungültiges riskLevel: ${s.riskLevel}`);
  assert(typeof s.endDateTime === 'string', 'endDateTime fehlt');
});

// ── 7. Preflight-Ergebnis verifizieren ────────────────────────────────────────
section('7 · Preflight-Ergebnis (GET /api/tenants/{tenantId}/preflight)');

await test('GET /api/tenants/{tenantId}/preflight → 200', async () => {
  const res = await api('GET', `/api/tenants/${cfg.tenantId}/preflight`);
  assert(res.status === 200, `Erwartet 200, erhalten ${res.status}: ${JSON.stringify(res.body)}`);
  preflightResult = res.body;
});

await test('Preflight: authValid und graphReachable sind true', async () => {
  assert(preflightResult !== null, 'Kein preflightResult');
  assert(preflightResult.data.authValid === true,
    `authValid ist false — Credential ungültig? ${JSON.stringify(preflightResult.data)}`);
  assert(preflightResult.data.graphReachable === true,
    `graphReachable ist false — kein Graph-Zugriff?`);
});

await test('Preflight: canReadApplications und canReadApplicationSecrets sind true', async () => {
  assert(preflightResult !== null, 'Kein preflightResult');
  const caps = preflightResult.data.capabilities;
  assert(caps.canReadApplications === true,
    'canReadApplications ist false — fehlt Application.Read.All?');
  assert(caps.canReadApplicationSecrets === true,
    'canReadApplicationSecrets ist false');
});

await test('GET /api/tenants/{tenantId}/preflight nicht-existierend → 404', async () => {
  const res = await api('GET', '/api/tenants/00000000-0000-0000-0000-000000000000/preflight');
  assert(res.status === 404, `Erwartet 404, erhalten ${res.status}`);
});

// ── 8. Dashboard ───────────────────────────────────────────────────────────────
section('8 · Dashboard (GET /api/dashboard)');

await test('GET /api/dashboard → 200 HTML', async () => {
  const url = `${cfg.baseUrl}/api/dashboard?tenant=${cfg.tenantId}`;
  const res = await fetch(url);
  const text = await res.text();
  assert(res.status === 200, `Erwartet 200, erhalten ${res.status}`);
  assert(res.headers.get('content-type')?.includes('text/html'),
    `Content-Type ist kein HTML: ${res.headers.get('content-type')}`);
  assert(text.includes('Azure App Registration Monitor'), 'Dashboard-Titel nicht gefunden');
});

// ── 9. Report ──────────────────────────────────────────────────────────────────
section('9 · Report (GET /api/report)');

await test('GET /api/report → 200 HTML', async () => {
  const res = await api('GET', `/api/report?tenant=${cfg.tenantId}`);
  assert(res.status === 200, `Erwartet 200, erhalten ${res.status}`);
  assert(typeof res.body === 'string' && res.body.includes('App Registration Secret Report'),
    'Report-HTML enthält nicht den erwarteten Titel');
});

await test('GET /api/report ohne Parameter → 400', async () => {
  const res = await api('GET', '/api/report');
  assert(res.status === 400, `Erwartet 400, erhalten ${res.status}`);
});

await test('GET /api/report unbekannter Tenant → 404', async () => {
  const res = await api('GET', '/api/report?tenant=00000000-0000-0000-0000-000000000000&env=PROD');
  assert(res.status === 404, `Erwartet 404, erhalten ${res.status}`);
});

// ── 10. Cleanup ────────────────────────────────────────────────────────────────
section('10 · Cleanup (DELETE /api/tenants/{tenantId})');

await test('DELETE /api/tenants/{tenantId} → 204', async () => {
  const res = await api('DELETE', `/api/tenants/${cfg.tenantId}`);
  assert(res.status === 204, `Erwartet 204, erhalten ${res.status}: ${JSON.stringify(res.body)}`);
});

await test('Tenant nach Delete nicht mehr in Liste', async () => {
  const res = await api('GET', '/api/tenants');
  assert(res.status === 200, `Erwartet 200, erhalten ${res.status}`);
  const entry = res.body.find(t => t.tenantId === cfg.tenantId);
  assert(!entry, `Tenant ${cfg.tenantId} ist nach Delete noch in der Liste`);
});

await test('DELETE nochmal → 404', async () => {
  const res = await api('DELETE', `/api/tenants/${cfg.tenantId}`);
  assert(res.status === 404, `Erwartet 404, erhalten ${res.status}`);
});

// ── Ergebnis ───────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
const total = passed + failed;
if (failed === 0) {
  console.log(`\x1b[32m✓ Alle ${total} Tests bestanden.\x1b[0m\n`);
  process.exit(0);
} else {
  console.log(`\x1b[31m✗ ${failed} von ${total} Tests fehlgeschlagen:\x1b[0m`);
  for (const f of failures) {
    console.log(`  \x1b[31m✗\x1b[0m ${f.name}`);
    console.log(`    ${f.msg}`);
  }
  console.log('');
  process.exit(1);
}

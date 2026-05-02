#!/usr/bin/env node
/**
 * Core library check — tests @brunsforge/azure-app-registration-monitor directly.
 *
 * No CLI, no Commander, no chalk. Just the library as any Node.js consumer would use it.
 * Interactive auth modes (interactive-browser, device-code) work fine because this
 * script runs in your terminal — the browser will open normally.
 *
 * Usage:
 *   node scripts/core-check.mjs --tenant "orgf707a816"
 *   node scripts/core-check.mjs --tenant "orgf707a816" --include-owners
 */

import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import {
  createCredential,
  createGraphClient,
  GraphApplicationReader,
  SecretInventoryService,
  PreflightService,
  calculateExpiryStatus,
  classifySecretRisk,
  maxRiskLevel,
} from '@brunsforge/azure-app-registration-monitor';

// keytar lives in CLI package but is available via workspace node_modules
const require = createRequire(import.meta.url);
const keytar = require('keytar');

// ── Args ──────────────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    tenant:         { type: 'string' },
    'include-owners': { type: 'boolean', default: false },
  },
  strict: false,
});

if (!args.tenant) {
  console.error('Usage: node scripts/core-check.mjs --tenant <name-or-id>');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(label, detail = '')  { passed++; console.log(`  ✓ ${label}${detail ? `  ${detail}` : ''}`); }
function fail(label, detail = '') { failed++; console.error(`  ✗ ${label}${detail ? `  — ${detail}` : ''}`); }
function section(t) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 56 - t.length))}`); }

async function timed(label, fn) {
  const t0 = Date.now();
  const result = await fn();
  const ms = Date.now() - t0;
  console.log(`  ⏱  ${label}: ${ms}ms`);
  return result;
}

// ── Load tenant config (same file the CLI reads) ──────────────────────────────

section('Load tenant config from ~/.aarm/tenants.json');

const tenantsFile = join(homedir(), '.aarm', 'tenants.json');
if (!existsSync(tenantsFile)) {
  console.error(`  No tenants file found at ${tenantsFile}`);
  console.error('  Run: aarm tenants add');
  process.exit(1);
}

const allTenants = JSON.parse(readFileSync(tenantsFile, 'utf8'));
const tenant = allTenants.find(
  (t) => t.tenantId === args.tenant || t.displayName === args.tenant,
);

if (!tenant) {
  console.error(`  Tenant "${args.tenant}" not found in ${tenantsFile}`);
  process.exit(1);
}

ok(`Tenant found: ${tenant.displayName} (${tenant.tenantId})`);
ok(`Auth mode: ${tenant.authMode}`);
if (tenant.clientId) ok(`Client ID: ${tenant.clientId}`);
if (tenant.username) ok(`Username: ${tenant.username}`);

// ── Build auth config (mirrors context.ts in the CLI) ─────────────────────────

section('Build AuthConfig');

const SERVICE = 'aarm';
let authConfig;

switch (tenant.authMode) {
  case 'client-secret': {
    const secret = await keytar.getPassword(SERVICE, `${tenant.tenantId}:${tenant.clientId}`);
    if (!secret) { console.error('  No client secret in Windows Credential Manager. Re-run: aarm tenants add'); process.exit(1); }
    authConfig = { mode: 'client-secret', tenantId: tenant.tenantId, clientId: tenant.clientId, clientSecret: secret };
    ok('Client secret loaded from Windows Credential Manager');
    break;
  }
  case 'username-password': {
    const pwd = await keytar.getPassword(SERVICE, `${tenant.tenantId}:${tenant.clientId}:upw:${tenant.username}`);
    if (!pwd) { console.error('  No password in Windows Credential Manager. Re-run: aarm tenants add'); process.exit(1); }
    authConfig = { mode: 'username-password', tenantId: tenant.tenantId, clientId: tenant.clientId, username: tenant.username, password: pwd };
    ok('Password loaded from Windows Credential Manager');
    break;
  }
  case 'device-code':
    authConfig = { mode: 'device-code', tenantId: tenant.tenantId, clientId: tenant.clientId };
    ok('device-code — will prompt on first Graph call');
    break;
  case 'interactive-browser':
    authConfig = { mode: 'interactive-browser', tenantId: tenant.tenantId, clientId: tenant.clientId };
    ok('interactive-browser — browser will open on first Graph call');
    break;
  case 'azure-cli':
    authConfig = { mode: 'azure-cli', tenantId: tenant.tenantId };
    ok('azure-cli — delegating to az token cache');
    break;
  case 'certificate':
    console.error('  certificate mode: provide --certificate-path (not yet supported in this script)');
    process.exit(1);
  default:
    console.error(`  Unknown auth mode: ${tenant.authMode}`);
    process.exit(1);
}

// ── 1. Create credential and Graph client (core API surface) ──────────────────

section('createCredential() + createGraphClient()');

const credential = createCredential(authConfig);
ok('createCredential() returned a TokenCredential');

const graphClient = createGraphClient(credential);
ok('createGraphClient() returned a Graph Client');

// ── 2. Token acquisition ──────────────────────────────────────────────────────

section('Token acquisition');

let token;
try {
  token = await timed('getToken', () =>
    credential.getToken('https://graph.microsoft.com/.default'),
  );
  if (token?.token) {
    ok(`Token acquired (expires at ${new Date(token.expiresOnTimestamp).toISOString()})`);
  } else {
    fail('No token returned');
  }
} catch (err) {
  fail('Token acquisition failed', err.message);
  process.exit(1);
}

// ── 3. GraphApplicationReader.listApplications() ─────────────────────────────

section('GraphApplicationReader.listApplications()');

const reader = new GraphApplicationReader(graphClient);
let apps;
try {
  apps = await timed('listApplications', () => reader.listApplications());
  ok(`Returned ${apps.length} App Registrations`);

  const appsWithSecrets = apps.filter((a) => a.passwordCredentials?.length > 0);
  ok(`${appsWithSecrets.length} have at least one passwordCredential`);

  // Spot-check first app shape
  const first = apps[0];
  if (first) {
    for (const f of ['id', 'appId', 'displayName', 'createdDateTime']) {
      typeof first[f] === 'string'
        ? ok(`apps[0].${f} is string`)
        : fail(`apps[0].${f}`, `expected string, got ${typeof first[f]}`);
    }
    Array.isArray(first.passwordCredentials)
      ? ok('apps[0].passwordCredentials is array')
      : fail('apps[0].passwordCredentials', 'not an array');
  }
} catch (err) {
  fail('listApplications() threw', err.message);
  apps = [];
}

// ── 4. GraphApplicationReader.getApplicationOwners() ─────────────────────────

if (args['include-owners'] && apps.length > 0) {
  section('GraphApplicationReader.getApplicationOwners()');
  const firstApp = apps.find((a) => a.id) ?? apps[0];
  try {
    const owners = await timed(`getApplicationOwners(${firstApp.id})`, () =>
      reader.getApplicationOwners(firstApp.id),
    );
    ok(`Returned ${owners.length} owner(s) for "${firstApp.displayName}"`);
    if (owners[0]) {
      typeof owners[0].id === 'string' ? ok('owners[0].id is string') : fail('owners[0].id');
    }
  } catch (err) {
    fail('getApplicationOwners() threw', err.message);
  }
}

// ── 5. SecretInventoryService.getInventory() ──────────────────────────────────

section('SecretInventoryService.getInventory()');

const inventoryService = new SecretInventoryService(reader);
let inventory;
try {
  inventory = await timed('getInventory', () =>
    inventoryService.getInventory({ includeOwners: args['include-owners'] }),
  );
  ok(`Returned ${inventory.length} AppRegistrationSummary records`);

  const totalSecrets = inventory.reduce((n, a) => n + a.secretCount, 0);
  const expired      = inventory.reduce((n, a) => n + a.expiredSecretCount, 0);
  const expiring     = inventory.reduce((n, a) => n + a.expiringSecretCount, 0);
  ok(`Total secrets: ${totalSecrets}  expired: ${expired}  expiring ≤30d: ${expiring}`);

  // Spot-check AppRegistrationSummary shape
  const first = inventory[0];
  if (first) {
    for (const f of ['applicationObjectId','appId','displayName','createdDateTime','riskLevel']) {
      typeof first[f] === 'string'
        ? ok(`inventory[0].${f} is string`)
        : fail(`inventory[0].${f}`, `expected string, got ${typeof first[f]}`);
    }
    for (const f of ['secretCount','expiredSecretCount','expiringSecretCount']) {
      typeof first[f] === 'number'
        ? ok(`inventory[0].${f} is number`)
        : fail(`inventory[0].${f}`, `expected number, got ${typeof first[f]}`);
    }
    Array.isArray(first.secrets)  ? ok('inventory[0].secrets is array') : fail('inventory[0].secrets');
    Array.isArray(first.owners)   ? ok('inventory[0].owners is array')  : fail('inventory[0].owners');
  }

  // Show top-5 by risk
  const topRisk = [...inventory]
    .sort((a, b) => ['Critical','High','Medium','Low','Info'].indexOf(a.riskLevel)
                  - ['Critical','High','Medium','Low','Info'].indexOf(b.riskLevel))
    .slice(0, 5);
  if (topRisk.length > 0) {
    console.log('\n  Top apps by risk:');
    for (const a of topRisk) {
      console.log(`    [${a.riskLevel.padEnd(8)}] ${a.displayName}  (${a.secretCount} secret(s))`);
    }
  }
} catch (err) {
  fail('getInventory() threw', err.message);
  inventory = [];
}

// ── 6. calculateExpiryStatus() + classifySecretRisk() with real data ──────────

section('calculateExpiryStatus() + classifySecretRisk() with real secrets');

const allSecrets = inventory.flatMap((a) => a.secrets);
if (allSecrets.length === 0) {
  console.log('  ℹ No secrets found — skipping expiry/risk checks');
} else {
  const statuses = { Valid: 0, ExpiringSoon: 0, Expired: 0, Unknown: 0 };
  const risks    = { Info: 0, Low: 0, Medium: 0, High: 0, Critical: 0 };

  for (const s of allSecrets) {
    const result = calculateExpiryStatus(s.endDateTime);
    statuses[result.status] = (statuses[result.status] ?? 0) + 1;

    const risk = classifySecretRisk(result.daysUntilExpiry, result.status);
    risks[risk] = (risks[risk] ?? 0) + 1;

    // Cross-check: inventory service should have calculated the same values
    if (result.status !== s.status) {
      fail(`Status mismatch for ${s.keyId}`, `direct=${result.status} service=${s.status}`);
    }
    if (risk !== s.riskLevel) {
      fail(`Risk mismatch for ${s.keyId}`, `direct=${risk} service=${s.riskLevel}`);
    }
  }

  ok(`Status distribution: ${JSON.stringify(statuses)}`);
  ok(`Risk distribution:   ${JSON.stringify(risks)}`);

  const crossCheckOk = allSecrets.every(
    (s) => calculateExpiryStatus(s.endDateTime).status === s.status,
  );
  crossCheckOk
    ? ok('calculateExpiryStatus() matches SecretInventoryService for all secrets')
    : fail('Status mismatch between direct call and service output — check SecretStatusCalculator');

  const riskCheckOk = allSecrets.every(
    (s) => classifySecretRisk(calculateExpiryStatus(s.endDateTime).daysUntilExpiry, s.status) === s.riskLevel,
  );
  riskCheckOk
    ? ok('classifySecretRisk() matches SecretInventoryService for all secrets')
    : fail('Risk mismatch between direct call and service output — check SecretRiskClassifier');
}

// ── 7. PreflightService.run() ─────────────────────────────────────────────────

section('PreflightService.run()');

const preflightService = new PreflightService(graphClient, credential);
try {
  const result = await timed('preflight.run', () =>
    preflightService.run({
      tenantId: tenant.tenantId,
      environmentName: tenant.defaultEnvironmentName ?? 'default',
      authMode: tenant.authMode,
    }),
  );

  result.authValid    ? ok('authValid = true')    : fail('authValid = false');
  result.graphReachable ? ok('graphReachable = true') : fail('graphReachable = false');

  const enabled  = Object.entries(result.capabilities).filter(([,v]) => v).map(([k]) => k);
  const disabled = Object.entries(result.capabilities).filter(([,v]) => !v).map(([k]) => k);

  ok(`Capabilities available (${enabled.length}): ${enabled.join(', ') || 'none'}`);
  if (disabled.length > 0) console.log(`  ○ Unavailable (${disabled.length}): ${disabled.join(', ')}`);

  if (result.missingPermissions.length > 0) {
    console.log('\n  Missing permissions:');
    for (const p of result.missingPermissions) console.log(`    • ${p}`);
  }
  if (result.warnings.length > 0) {
    console.log('\n  Warnings:');
    for (const w of result.warnings) console.log(`    ! ${w}`);
  }
} catch (err) {
  fail('PreflightService.run() threw', err.message);
}

// ── maxRiskLevel() utility check ─────────────────────────────────────────────

section('maxRiskLevel() utility');
const levels = ['Info','Low','Medium','High','Critical','Info','Low'];
const max = maxRiskLevel(levels);
max === 'Critical' ? ok(`maxRiskLevel(['Info','Low','Medium','High','Critical',...]) = Critical`) : fail('maxRiskLevel', max);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`${passed} passed  ${failed} failed`);

if (failed > 0) {
  console.error('\nSome checks failed — review above before publishing the core package.');
  process.exit(1);
} else {
  console.log('\nCore library works end-to-end against the real Entra tenant.');
}

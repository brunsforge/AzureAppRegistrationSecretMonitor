#!/usr/bin/env node
/**
 * Integration check — verifies CLI JSON output is compatible with CliModels.cs.
 *
 * Note on auth modes:
 *   interactive-browser and device-code require browser/terminal interaction and
 *   cannot run unattended in a subprocess. Configure a client-secret tenant for
 *   automated integration checks, or set AARM_TEST_TOKEN to a pre-obtained
 *   Bearer token (see --help for details).
 *
 * Usage:
 *   node scripts/integration-check.mjs --tenant "Contoso"
 *   node scripts/integration-check.mjs --tenant "Contoso" --timeout 20000
 *   node scripts/integration-check.mjs --tenant "Contoso" --verbose
 */

import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const { values: args } = parseArgs({
  options: {
    tenant:  { type: 'string' },
    cli:     { type: 'string', default: './packages/cli/dist/index.js' },
    timeout: { type: 'string', default: '30000' },
    verbose: { type: 'boolean', default: false },
  },
  strict: false,
});

const TIMEOUT_MS = parseInt(args.timeout, 10);

if (!args.tenant) {
  console.error('Usage: node scripts/integration-check.mjs --tenant <name-or-id>');
  process.exit(1);
}

if (!existsSync(args.cli)) {
  console.error(`CLI not found at: ${args.cli}`);
  console.error('Run: npm run build');
  process.exit(1);
}

// ── Check auth mode before running ───────────────────────────────────────────

const INTERACTIVE_MODES = new Set(['interactive-browser', 'device-code']);

function readTenantAuthMode(nameOrId) {
  const tenantsFile = join(homedir(), '.aarm', 'tenants.json');
  if (!existsSync(tenantsFile)) return null;
  try {
    const tenants = JSON.parse(readFileSync(tenantsFile, 'utf8'));
    return tenants.find(
      (t) => t.tenantId === nameOrId || t.displayName === nameOrId,
    )?.authMode ?? null;
  } catch {
    return null;
  }
}

const authMode = readTenantAuthMode(args.tenant);

if (authMode && INTERACTIVE_MODES.has(authMode)) {
  console.error(`\n⚠  Tenant "${args.tenant}" uses auth mode: ${authMode}`);
  console.error('');
  console.error('   Interactive auth modes (interactive-browser, device-code) open a browser or');
  console.error('   terminal prompt. They cannot run unattended inside a subprocess.');
  console.error('');
  console.error('   Options:');
  console.error('   1. Add a client-secret tenant for automated tests:');
  console.error('        aarm tenants add --display-name "Test (automation)" --auth-mode client-secret ...');
  console.error('        node scripts/integration-check.mjs --tenant "Test (automation)"');
  console.error('');
  console.error('   2. Run the CLI commands manually and inspect the JSON:');
  console.error(`        node ${args.cli} --tenant "${args.tenant}" --output json preflight run`);
  console.error(`        node ${args.cli} --tenant "${args.tenant}" --output json apps list`);
  console.error(`        node ${args.cli} --tenant "${args.tenant}" --output json secrets list`);
  process.exit(2);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(label)           { passed++; console.log(`  ✓ ${label}`); }
function fail(label, detail) { failed++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
function section(title)      { console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 58 - title.length))}`); }

function runCli(extraArgs) {
  return new Promise((resolve, reject) => {
    const allArgs = [args.cli, '--tenant', args.tenant, '--output', 'json', ...extraArgs];
    const proc = spawn(process.execPath, allArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d));
    proc.stderr.on('data', (d) => (stderr += d));

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`Timed out after ${TIMEOUT_MS / 1000}s — if auth requires interaction, use a client-secret tenant`));
    }, TIMEOUT_MS);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (args.verbose && stderr.trim()) console.error(`  stderr: ${stderr.trim()}`);
      if (!stdout.trim()) {
        reject(new Error(`No output (exit ${code}).${stderr.trim() ? ' ' + stderr.trim() : ''}`));
        return;
      }
      try {
        resolve({ json: JSON.parse(stdout), exitCode: code });
      } catch {
        reject(new Error(`Invalid JSON (exit ${code}): ${stdout.slice(0, 300)}`));
      }
    });

    proc.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

// ── Schema checks ─────────────────────────────────────────────────────────────

function checkEnvelope(obj, label) {
  for (const [key, type] of [['success','boolean'],['metadata','object'],['warnings','array'],['errors','array']]) {
    if (!(key in obj)) { fail(`${label}.${key} missing`); continue; }
    if (type === 'array') Array.isArray(obj[key]) ? ok(`${label}.${key} []`) : fail(`${label}.${key}`, `not array`);
    else typeof obj[key] === type ? ok(`${label}.${key} ${type}`) : fail(`${label}.${key}`, `${typeof obj[key]}`);
  }
  if (!('data' in obj)) fail(`${label}.data missing`); else ok(`${label}.data present`);
  const m = obj.metadata ?? {};
  for (const f of ['tenantId','environmentName','generatedAt','toolVersion'])
    typeof m[f] === 'string' ? ok(`metadata.${f}`) : fail(`metadata.${f}`, typeof m[f]);
}

function checkPreflight(data) {
  for (const f of ['tenantId','environmentName','checkedAt'])
    typeof data[f] === 'string' ? ok(`PreflightResult.${f}`) : fail(`PreflightResult.${f}`, typeof data[f]);
  for (const f of ['authValid','graphReachable'])
    typeof data[f] === 'boolean' ? ok(`PreflightResult.${f}`) : fail(`PreflightResult.${f}`, typeof data[f]);
  for (const f of ['missingPermissions','warnings','errors'])
    Array.isArray(data[f]) ? ok(`PreflightResult.${f} []`) : fail(`PreflightResult.${f}`, typeof data[f]);

  const caps = data.capabilities;
  if (typeof caps !== 'object' || caps === null) { fail('CapabilitySet missing'); return; }
  for (const f of [
    'canReadApplications','canReadApplicationSecrets','canReadServicePrincipals',
    'canReadOwners','canReadDirectory','canQueryLogAnalytics',
    'canAnalyzeServicePrincipalSignIns','canCreateApplicationSecrets',
    'canDeleteApplicationSecrets','canCreateApplications',
    'canReadAzureResources','canReadKeyVaultMetadata',
  ]) typeof caps[f] === 'boolean' ? ok(`CapabilitySet.${f}`) : fail(`CapabilitySet.${f}`, typeof caps[f]);
}

function checkApp(item, i) {
  const p = `AppRegistrationSummary[${i}]`;
  for (const f of ['applicationObjectId','appId','displayName','createdDateTime','riskLevel'])
    typeof item[f] === 'string' ? ok(`${p}.${f}`) : fail(`${p}.${f}`, typeof item[f]);
  for (const f of ['secretCount','expiredSecretCount','expiringSecretCount'])
    typeof item[f] === 'number' ? ok(`${p}.${f}`) : fail(`${p}.${f}`, typeof item[f]);
  Array.isArray(item.owners) ? ok(`${p}.owners []`) : fail(`${p}.owners`, typeof item.owners);
  Array.isArray(item.secrets) ? ok(`${p}.secrets []`) : fail(`${p}.secrets`, typeof item.secrets);
  if (Array.isArray(item.secrets) && item.secrets.length > 0) checkSecret(item.secrets[0], `${p}.secrets[0]`);
}

function checkSecret(item, p) {
  for (const f of ['applicationObjectId','appId','appDisplayName','keyId','status','riskLevel'])
    typeof item[f] === 'string' ? ok(`${p}.${f}`) : fail(`${p}.${f}`, typeof item[f]);
  for (const f of ['displayName','hint','startDateTime','endDateTime'])
    (item[f] === null || typeof item[f] === 'string') ? ok(`${p}.${f} string|null`) : fail(`${p}.${f}`, typeof item[f]);
  (item.daysUntilExpiry === null || typeof item.daysUntilExpiry === 'number')
    ? ok(`${p}.daysUntilExpiry number|null`) : fail(`${p}.daysUntilExpiry`, typeof item.daysUntilExpiry);
}

// ── Run ───────────────────────────────────────────────────────────────────────

console.log(`\naarm integration check`);
console.log(`  tenant:   ${args.tenant}${authMode ? ` (${authMode})` : ''}`);
console.log(`  cli:      ${args.cli}`);
console.log(`  timeout:  ${TIMEOUT_MS / 1000}s per command`);

// tenants list (no --tenant flag)
section('tenants list');
try {
  const { json } = await new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [args.cli, 'tenants', 'list', '--output', 'json'], { stdio: ['ignore','pipe','pipe'] });
    let out = '';
    proc.stdout.on('data', (d) => (out += d));
    const t = setTimeout(() => { proc.kill(); reject(new Error('timeout')); }, TIMEOUT_MS);
    proc.on('close', () => { clearTimeout(t); try { resolve({ json: JSON.parse(out) }); } catch { reject(new Error('invalid json')); } });
  });
  checkEnvelope(json, 'tenants list');
  if (Array.isArray(json.data)) {
    ok(`data has ${json.data.length} tenant(s)`);
    const t = json.data[0];
    if (t) {
      for (const f of ['tenantId','displayName','authMode']) typeof t[f] === 'string' ? ok(`TenantProfile.${f}`) : fail(`TenantProfile.${f}`, typeof t[f]);
      if ('username' in t) ok('TenantProfile.username field present');
    }
  }
} catch (e) { fail('tenants list', e.message); }

// preflight run
section('preflight run');
try {
  const { json, exitCode } = await runCli(['preflight', 'run']);
  exitCode === 0 ? ok('exit code 0') : fail('exit code', String(exitCode));
  checkEnvelope(json, 'preflight');
  if (json.data) {
    checkPreflight(json.data);
    json.data.authValid ? ok('authValid = true') : fail('authValid false — check credentials and permissions');
    json.data.graphReachable ? ok('graphReachable = true') : fail('graphReachable false');
  }
} catch (e) { fail('preflight run', e.message); }

// apps list
section('apps list');
try {
  const { json, exitCode } = await runCli(['apps', 'list']);
  exitCode === 0 ? ok('exit code 0') : fail('exit code', String(exitCode));
  checkEnvelope(json, 'apps list');
  if (Array.isArray(json.data)) {
    ok(`data has ${json.data.length} app(s)`);
    if (json.data.length > 0) checkApp(json.data[0], 0);
    else console.log('  ℹ no apps found — field checks skipped');
  } else { fail('data is not array'); }
} catch (e) { fail('apps list', e.message); }

// secrets list
section('secrets list');
try {
  const { json, exitCode } = await runCli(['secrets', 'list']);
  exitCode === 0 ? ok('exit code 0') : fail('exit code', String(exitCode));
  checkEnvelope(json, 'secrets list');
  if (Array.isArray(json.data)) {
    ok(`data has ${json.data.length} secret(s)`);
    if (json.data.length > 0) checkSecret(json.data[0], 'SecretSummary[0]');
    else console.log('  ℹ no secrets found — field checks skipped');
  } else { fail('data is not array'); }
} catch (e) { fail('secrets list', e.message); }

// secrets expiring
section('secrets expiring --days 90');
try {
  const { json } = await runCli(['secrets', 'expiring', '--days', '90']);
  Array.isArray(json.data) ? ok(`${json.data.length} expiring secret(s)`) : fail('data is not array');
} catch (e) { fail('secrets expiring', e.message); }

// secrets expired
section('secrets expired');
try {
  const { json } = await runCli(['secrets', 'expired']);
  Array.isArray(json.data) ? ok(`${json.data.length} expired secret(s)`) : fail('data is not array');
} catch (e) { fail('secrets expired', e.message); }

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(62)}`);
console.log(`${passed} passed  ${failed} failed`);

if (failed > 0) {
  console.error('\nSome checks failed. Fix before the MAUI app can reliably consume CLI output.');
  process.exit(1);
} else {
  console.log('\nAll checks passed. CLI output is compatible with CliModels.cs.');
}

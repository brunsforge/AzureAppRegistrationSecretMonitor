/**
 * Shared credential, Graph client and services for all live tests.
 *
 * Reads tenant config from:
 *   1. AARM_TEST_TENANT_ID + AARM_TEST_CLIENT_ID environment variables
 *   2. ~/.aarm/tenants.json (same file the CLI reads — no extra config needed)
 *
 * The InteractiveBrowserCredential opens a browser the first time a Graph
 * call is made. All subsequent test calls reuse the cached in-memory token.
 */

import { readFileSync, existsSync } from 'node:fs';
import { homedir }  from 'node:os';
import { join }     from 'node:path';

import {
  createCredential,
  createGraphClient,
  GraphApplicationReader,
  SecretInventoryService,
  PreflightService,
  type AuthConfig,
} from '@brunsforge/azure-app-registration-monitor';

// ── Resolve tenant config ──────────────────────────────────────────────────

interface TenantConfig { tenantId: string; clientId: string; authMode: string }

function resolveConfig(): TenantConfig {
  const envTenant = process.env.AARM_TEST_TENANT_ID;
  const envClient = process.env.AARM_TEST_CLIENT_ID;
  if (envTenant && envClient) {
    return { tenantId: envTenant, clientId: envClient, authMode: 'interactive-browser' };
  }

  const tenantsFile = join(homedir(), '.aarm', 'tenants.json');
  if (!existsSync(tenantsFile)) {
    throw new Error(
      'No tenant configured.\n' +
      'Option A — set environment variables:\n' +
      '  AARM_TEST_TENANT_ID=<guid>  AARM_TEST_CLIENT_ID=<guid>\n' +
      'Option B — add a tenant with the CLI:\n' +
      '  aarm tenants add --auth-mode interactive-browser',
    );
  }

  const tenants: Array<{ tenantId: string; clientId?: string; authMode: string }> =
    JSON.parse(readFileSync(tenantsFile, 'utf8'));

  // Prefer a tenant with interactive-browser mode; fall back to any tenant
  const preferred =
    tenants.find((t) => t.authMode === 'interactive-browser' && t.clientId) ??
    tenants.find((t) => t.clientId);

  if (!preferred?.clientId) {
    throw new Error(
      'No tenant with a clientId found in ~/.aarm/tenants.json.\n' +
      'Run: aarm tenants add --auth-mode interactive-browser',
    );
  }

  return {
    tenantId: preferred.tenantId,
    clientId: preferred.clientId,
    authMode: preferred.authMode,
  };
}

export const config = resolveConfig();

// ── Create services (browser opens on first Graph call) ────────────────────

const authConfig: AuthConfig = {
  mode: 'interactive-browser',
  tenantId: config.tenantId,
  clientId: config.clientId,
};

export const credential       = createCredential(authConfig);
export const graphClient      = createGraphClient(credential);
export const graphReader      = new GraphApplicationReader(graphClient);
export const inventoryService = new SecretInventoryService(graphReader);
export const preflightService = new PreflightService(graphClient, credential);

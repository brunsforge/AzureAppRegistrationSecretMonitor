/**
 * Feature: Preflight capability detection
 *
 * Verifies that PreflightService correctly checks all 12 capabilities
 * against the real tenant and produces actionable permission hints
 * appropriate for the configured auth mode.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { PreflightResult } from '@brunsforge/azure-app-registration-monitor';
import { config, preflightService } from './shared.js';

describe('PreflightService.run()', () => {
  let result: PreflightResult;

  beforeAll(async () => {
    result = await preflightService.run({
      tenantId:       config.tenantId,
      environmentName: 'live-test',
      authMode:       'interactive-browser',
    });
  });

  // ── Top-level fields ───────────────────────────────────────────────────

  it('authValid is true', () => {
    expect(result.authValid).toBe(true);
  });

  it('graphReachable is true', () => {
    expect(result.graphReachable).toBe(true);
  });

  it('tenantId matches configured tenant', () => {
    expect(result.tenantId).toBe(config.tenantId);
  });

  it('checkedAt is a recent ISO 8601 timestamp', () => {
    const checkedAt = new Date(result.checkedAt);
    expect(isNaN(checkedAt.getTime())).toBe(false);
    expect(checkedAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it('missingPermissions is an array of strings', () => {
    expect(Array.isArray(result.missingPermissions)).toBe(true);
    for (const p of result.missingPermissions) {
      expect(typeof p).toBe('string');
    }
  });

  it('warnings is an array', () => {
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('errors is an empty array (no hard failures)', () => {
    expect(result.errors).toHaveLength(0);
  });

  // ── CapabilitySet ──────────────────────────────────────────────────────

  const ALL_CAPS = [
    'canReadApplications', 'canReadApplicationSecrets',
    'canReadServicePrincipals', 'canReadOwners', 'canReadDirectory',
    'canQueryLogAnalytics', 'canAnalyzeServicePrincipalSignIns',
    'canCreateApplicationSecrets', 'canDeleteApplicationSecrets',
    'canCreateApplications', 'canReadAzureResources', 'canReadKeyVaultMetadata',
  ] as const;

  it('capabilities object contains all 12 flags', () => {
    for (const cap of ALL_CAPS) {
      expect(cap in result.capabilities).toBe(true);
      expect(typeof result.capabilities[cap]).toBe('boolean');
    }
  });

  it('canReadApplications is true (Application.Read.All granted)', () => {
    if (!result.capabilities.canReadApplications) {
      console.warn('   ⚠  canReadApplications=false — grant Application.Read.All with admin consent');
    }
    expect(result.capabilities.canReadApplications).toBe(true);
  });

  it('canReadApplicationSecrets is true', () => {
    expect(result.capabilities.canReadApplicationSecrets).toBe(true);
  });

  it('write capabilities are false (read-only MVP)', () => {
    expect(result.capabilities.canCreateApplicationSecrets).toBe(false);
    expect(result.capabilities.canDeleteApplicationSecrets).toBe(false);
    expect(result.capabilities.canCreateApplications).toBe(false);
  });

  it('Azure resource capabilities are false (Phase 2)', () => {
    expect(result.capabilities.canReadAzureResources).toBe(false);
    expect(result.capabilities.canReadKeyVaultMetadata).toBe(false);
  });

  it('missing permissions contain mode-aware hints when capabilities are unavailable', () => {
    const unavailable = ALL_CAPS.filter((c) => !result.capabilities[c]);
    if (unavailable.length > 0 && result.missingPermissions.length > 0) {
      // Hints should mention "delegated" since we're using interactive-browser
      const hasDelegatedHint = result.missingPermissions.some(
        (p) => p.toLowerCase().includes('delegated') || p.toLowerCase().includes('signed-in user'),
      );
      expect(hasDelegatedHint).toBe(true);
    }
  });

  // ── Capability summary ─────────────────────────────────────────────────

  it('prints a capability report', () => {
    const enabled  = ALL_CAPS.filter((c) => result.capabilities[c]);
    const disabled = ALL_CAPS.filter((c) => !result.capabilities[c]);

    console.info('\n   🔍  Capability report');
    console.info(`       Auth mode:  interactive-browser (delegated)`);
    console.info(`       Available (${enabled.length}):   ${enabled.join(', ')}`);
    console.info(`       Unavailable (${disabled.length}): ${disabled.join(', ')}`);

    if (result.missingPermissions.length > 0) {
      console.info('\n   📋  Missing permissions:');
      for (const p of result.missingPermissions) {
        console.info(`       • ${p}`);
      }
    }

    // Always passes — informational only
    expect(true).toBe(true);
  });
});

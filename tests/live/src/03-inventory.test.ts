/**
 * Feature: Secret inventory, expiry calculation, risk classification
 *
 * The core monitoring pipeline: list all secrets, calculate days until
 * expiry, classify risk, and verify the results are internally consistent.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import {
  calculateExpiryStatus,
  classifySecretRisk,
  maxRiskLevel,
  type AppRegistrationSummary,
  type RiskLevel,
  type SecretSummary,
} from '@brunsforge/azure-app-registration-monitor';
import { inventoryService } from './shared.js';

describe('SecretInventoryService.getInventory()', () => {
  let inventory: AppRegistrationSummary[];
  let allSecrets: SecretSummary[];

  beforeAll(async () => {
    inventory = await inventoryService.getInventory();
    allSecrets = inventory.flatMap((a) => a.secrets);
  });

  // ── Shape ──────────────────────────────────────────────────────────────

  it('returns an array of AppRegistrationSummary', () => {
    expect(Array.isArray(inventory)).toBe(true);
    expect(inventory.length).toBeGreaterThan(0);
  });

  it('every summary has all required fields', () => {
    for (const app of inventory) {
      expect(typeof app.applicationObjectId).toBe('string');
      expect(typeof app.appId).toBe('string');
      expect(typeof app.displayName).toBe('string');
      expect(typeof app.createdDateTime).toBe('string');
      expect(typeof app.secretCount).toBe('number');
      expect(typeof app.expiredSecretCount).toBe('number');
      expect(typeof app.expiringSecretCount).toBe('number');
      expect(typeof app.riskLevel).toBe('string');
      expect(Array.isArray(app.secrets)).toBe(true);
      expect(Array.isArray(app.owners)).toBe(true);
    }
  });

  it('secretCount equals secrets array length', () => {
    for (const app of inventory) {
      expect(app.secretCount).toBe(app.secrets.length);
    }
  });

  it('expiredSecretCount matches actual expired secrets in the array', () => {
    for (const app of inventory) {
      const counted = app.secrets.filter((s) => s.status === 'Expired').length;
      expect(app.expiredSecretCount).toBe(counted);
    }
  });

  it('expiringSecretCount matches actual ExpiringSoon secrets in the array', () => {
    for (const app of inventory) {
      const counted = app.secrets.filter((s) => s.status === 'ExpiringSoon').length;
      expect(app.expiringSecretCount).toBe(counted);
    }
  });

  it('app riskLevel equals the max riskLevel of its secrets (or Info when no secrets)', () => {
    const ORDER: RiskLevel[] = ['Info', 'Low', 'Medium', 'High', 'Critical'];
    for (const app of inventory) {
      const expected = app.secrets.length > 0
        ? maxRiskLevel(app.secrets.map((s) => s.riskLevel as RiskLevel))
        : 'Info';
      expect(app.riskLevel).toBe(expected);
    }
  });

  // ── SecretSummary fields ───────────────────────────────────────────────

  it('every SecretSummary has required fields', () => {
    for (const s of allSecrets) {
      expect(typeof s.applicationObjectId).toBe('string');
      expect(typeof s.appId).toBe('string');
      expect(typeof s.appDisplayName).toBe('string');
      expect(typeof s.keyId).toBe('string');
      expect(typeof s.status).toBe('string');
      expect(typeof s.riskLevel).toBe('string');
      expect(s.daysUntilExpiry === null || typeof s.daysUntilExpiry === 'number').toBe(true);
    }
  });

  it('status is one of the four valid values', () => {
    const valid = new Set(['Valid', 'ExpiringSoon', 'Expired', 'Unknown']);
    for (const s of allSecrets) {
      expect(valid.has(s.status)).toBe(true);
    }
  });

  it('riskLevel is one of the five valid values', () => {
    const valid = new Set<RiskLevel>(['Info', 'Low', 'Medium', 'High', 'Critical']);
    for (const s of allSecrets) {
      expect(valid.has(s.riskLevel as RiskLevel)).toBe(true);
    }
  });

  // ── Cross-check: calculateExpiryStatus() matches service output ────────

  it('calculateExpiryStatus() called directly matches the service output for every secret', () => {
    let mismatches = 0;
    for (const s of allSecrets) {
      const direct = calculateExpiryStatus(s.endDateTime);
      if (direct.status !== s.status) {
        mismatches++;
        console.error(`  Mismatch on ${s.keyId}: direct=${direct.status} service=${s.status}`);
      }
    }
    expect(mismatches).toBe(0);
  });

  // ── Cross-check: classifySecretRisk() matches service output ──────────

  it('classifySecretRisk() called directly matches the service output for every secret', () => {
    let mismatches = 0;
    for (const s of allSecrets) {
      const { daysUntilExpiry, status } = calculateExpiryStatus(s.endDateTime);
      const direct = classifySecretRisk(daysUntilExpiry, status);
      if (direct !== s.riskLevel) {
        mismatches++;
        console.error(`  Mismatch on ${s.keyId}: direct=${direct} service=${s.riskLevel}`);
      }
    }
    expect(mismatches).toBe(0);
  });

  // ── Business findings summary ──────────────────────────────────────────

  it('produces a meaningful findings summary', () => {
    const total    = allSecrets.length;
    const expired  = allSecrets.filter((s) => s.status === 'Expired').length;
    const soon     = allSecrets.filter((s) => s.status === 'ExpiringSoon').length;
    const critical = allSecrets.filter((s) => s.riskLevel === 'Critical').length;
    const high     = allSecrets.filter((s) => s.riskLevel === 'High').length;

    console.info('\n   📊  Secret inventory summary');
    console.info(`       Total secrets:    ${total}`);
    console.info(`       Expired:          ${expired}`);
    console.info(`       Expiring ≤30d:    ${soon}`);
    console.info(`       Critical risk:    ${critical}`);
    console.info(`       High risk:        ${high}`);

    if (expired + critical + high > 0) {
      console.info('\n   ⚠   Secrets requiring attention:');
      const urgent = allSecrets
        .filter((s) => ['Expired','Critical','High'].includes(s.status) || ['Critical','High'].includes(s.riskLevel))
        .sort((a, b) => (a.daysUntilExpiry ?? -999) - (b.daysUntilExpiry ?? -999))
        .slice(0, 10);
      for (const s of urgent) {
        console.info(`       [${s.riskLevel.padEnd(8)}] ${s.appDisplayName} — ${s.displayName ?? s.keyId}  (${s.daysUntilExpiry ?? 'expired'} days)`);
      }
    }

    // The suite always passes — the summary is informational
    expect(total).toBeGreaterThanOrEqual(0);
  });
});

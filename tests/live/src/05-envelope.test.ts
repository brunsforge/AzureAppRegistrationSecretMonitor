/**
 * Feature: JSON result envelope
 *
 * Verifies that createResultEnvelope() / envelopeToJson() produce
 * the exact JSON shape that CliModels.cs in the MAUI app expects.
 * Uses real inventory data to build a real envelope.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import {
  createResultEnvelope,
  envelopeToJson,
  type AppRegistrationSummary,
  type ResultEnvelope,
} from '@brunsforge/azure-app-registration-monitor';
import { config, inventoryService } from './shared.js';

describe('createResultEnvelope() + envelopeToJson()', () => {
  let inventory: AppRegistrationSummary[];
  let envelope: ResultEnvelope<AppRegistrationSummary[]>;
  let json: string;
  let parsed: unknown;

  beforeAll(async () => {
    inventory = await inventoryService.getInventory();
    envelope  = createResultEnvelope(inventory, config.tenantId, 'live-test', {
      warnings: ['Live test envelope'],
    });
    json   = envelopeToJson(envelope);
    parsed = JSON.parse(json);
  });

  // ── Envelope object ────────────────────────────────────────────────────

  it('success is a boolean', () => {
    expect(typeof envelope.success).toBe('boolean');
    expect(envelope.success).toBe(true);
  });

  it('metadata has all required fields', () => {
    expect(typeof envelope.metadata.tenantId).toBe('string');
    expect(typeof envelope.metadata.environmentName).toBe('string');
    expect(typeof envelope.metadata.generatedAt).toBe('string');
    expect(typeof envelope.metadata.toolVersion).toBe('string');
    expect(envelope.metadata.tenantId).toBe(config.tenantId);
    expect(envelope.metadata.environmentName).toBe('live-test');
  });

  it('generatedAt is a valid ISO 8601 string', () => {
    expect(isNaN(new Date(envelope.metadata.generatedAt).getTime())).toBe(false);
  });

  it('data is the inventory array', () => {
    expect(envelope.data).toBe(inventory);
  });

  it('warnings is the array passed in', () => {
    expect(envelope.warnings).toContain('Live test envelope');
  });

  it('errors is an empty array', () => {
    expect(envelope.errors).toHaveLength(0);
  });

  // ── JSON serialisation ─────────────────────────────────────────────────

  it('envelopeToJson() produces valid JSON', () => {
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('JSON is pretty-printed (indented)', () => {
    expect(json).toContain('\n');
    expect(json).toContain('  ');
  });

  it('JSON top-level keys match CliModels.cs expectations', () => {
    const keys = Object.keys(parsed as object);
    expect(keys).toContain('success');
    expect(keys).toContain('metadata');
    expect(keys).toContain('data');
    expect(keys).toContain('warnings');
    expect(keys).toContain('errors');
    expect(keys).toHaveLength(5);
  });

  it('all keys in the JSON are camelCase (matches JsonPropertyName attributes)', () => {
    const camelCase = /^[a-z][a-zA-Z0-9]*$/;
    function checkKeys(obj: unknown, path = '') {
      if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return;
      for (const key of Object.keys(obj as object)) {
        expect(key, `Key "${path}.${key}" must be camelCase`).toMatch(camelCase);
        checkKeys((obj as Record<string, unknown>)[key], `${path}.${key}`);
      }
    }
    checkKeys(parsed);
  });

  it('AppRegistrationSummary JSON fields match C# model', () => {
    const data = (parsed as { data: object[] }).data;
    if (data.length === 0) return;
    const first = data[0] as Record<string, unknown>;
    for (const field of [
      'applicationObjectId', 'appId', 'displayName', 'createdDateTime',
      'owners', 'secretCount', 'expiredSecretCount', 'expiringSecretCount',
      'riskLevel', 'secrets',
    ]) {
      expect(field in first, `Missing field "${field}" in AppRegistrationSummary`).toBe(true);
    }
  });

  it('SecretSummary JSON fields match C# model', () => {
    const data = (parsed as { data: Array<{ secrets: object[] }> }).data;
    const withSecrets = data.find((a) => a.secrets.length > 0);
    if (!withSecrets) return;
    const secret = withSecrets.secrets[0] as Record<string, unknown>;
    for (const field of [
      'applicationObjectId', 'appId', 'appDisplayName', 'keyId',
      'displayName', 'hint', 'startDateTime', 'endDateTime',
      'daysUntilExpiry', 'status', 'riskLevel',
    ]) {
      expect(field in secret, `Missing field "${field}" in SecretSummary`).toBe(true);
    }
  });

  it('prints JSON envelope size info', () => {
    const sizeKb = (json.length / 1024).toFixed(1);
    const apps   = inventory.length;
    const secrets = inventory.reduce((n, a) => n + a.secretCount, 0);
    console.info(`\n   📦  Envelope: ${sizeKb} KB  (${apps} apps, ${secrets} secrets)`);
    expect(true).toBe(true);
  });
});

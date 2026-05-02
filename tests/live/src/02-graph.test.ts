/**
 * Feature: Microsoft Graph — App Registration listing
 *
 * Verifies that GraphApplicationReader can list App Registrations
 * and that each record has the fields the library promises.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { GraphApplication } from '@brunsforge/azure-app-registration-monitor';
import { graphReader } from './shared.js';

describe('GraphApplicationReader.listApplications()', () => {
  let apps: GraphApplication[];

  beforeAll(async () => {
    apps = await graphReader.listApplications();
  });

  it('returns an array', () => {
    expect(Array.isArray(apps)).toBe(true);
  });

  it('tenant has at least one App Registration', () => {
    expect(apps.length).toBeGreaterThan(0);
    console.info(`\n   📋  Found ${apps.length} App Registration(s)`);
  });

  it('every app has a non-empty object ID (id)', () => {
    for (const app of apps) {
      expect(typeof app.id).toBe('string');
      expect(app.id.length).toBeGreaterThan(0);
    }
  });

  it('every app has a non-empty client ID (appId)', () => {
    for (const app of apps) {
      expect(typeof app.appId).toBe('string');
      expect(app.appId.length).toBeGreaterThan(0);
    }
  });

  it('every app has a displayName string', () => {
    for (const app of apps) {
      expect(typeof app.displayName).toBe('string');
    }
  });

  it('every app has a createdDateTime string', () => {
    for (const app of apps) {
      expect(typeof app.createdDateTime).toBe('string');
    }
  });

  it('every app has a passwordCredentials array', () => {
    for (const app of apps) {
      expect(Array.isArray(app.passwordCredentials)).toBe(true);
    }
  });

  it('apps with secrets have valid credential fields', () => {
    const withSecrets = apps.filter((a) => a.passwordCredentials.length > 0);
    console.info(`   🔒  ${withSecrets.length} app(s) have at least one secret`);
    for (const app of withSecrets) {
      for (const cred of app.passwordCredentials) {
        expect(typeof cred.keyId).toBe('string');
        // displayName and hint may be null
        expect(cred.displayName === null || typeof cred.displayName === 'string').toBe(true);
      }
    }
  });

  it('getApplicationOwners() returns an array (may be empty without Directory.Read.All)', async () => {
    const firstApp = apps[0];
    const owners = await graphReader.getApplicationOwners(firstApp.id);
    expect(Array.isArray(owners)).toBe(true);
    if (owners.length > 0) {
      console.info(`   👤  "${firstApp.displayName}" has ${owners.length} owner(s)`);
      expect(typeof owners[0].id).toBe('string');
    } else {
      console.info(`   ℹ  owners empty — Directory.Read.All may not be granted`);
    }
  });
});

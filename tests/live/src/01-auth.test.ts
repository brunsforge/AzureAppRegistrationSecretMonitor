/**
 * Feature: Authentication
 *
 * Verifies that the library can acquire a valid Entra access token
 * using the interactive browser flow. The browser opens here — log in
 * and return to the terminal. All subsequent tests reuse the cached token.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { config, credential } from './shared.js';

console.info(`\n🔑  Live tests — tenant: ${config.tenantId}\n`);
console.info('   A browser window will open. Log in and return to the terminal.\n');

describe('Authentication — interactive-browser', () => {
  let token: Awaited<ReturnType<typeof credential.getToken>>;

  beforeAll(async () => {
    // This is where the browser opens
    token = await credential.getToken('https://graph.microsoft.com/.default');
  });

  it('returns a non-null token', () => {
    expect(token).not.toBeNull();
  });

  it('token string is non-empty', () => {
    expect(token?.token).toBeTruthy();
    expect(typeof token?.token).toBe('string');
    expect(token!.token.length).toBeGreaterThan(100);
  });

  it('token is not already expired', () => {
    expect(token?.expiresOnTimestamp).toBeGreaterThan(Date.now());
  });

  it('token expires in the future (at least 5 minutes from now)', () => {
    const fiveMinutes = 5 * 60 * 1000;
    expect(token?.expiresOnTimestamp).toBeGreaterThan(Date.now() + fiveMinutes);
  });

  it('second getToken() call uses cached token without re-opening browser', async () => {
    const t1 = Date.now();
    const token2 = await credential.getToken('https://graph.microsoft.com/.default');
    const elapsed = Date.now() - t1;
    expect(token2?.token).toBeTruthy();
    // Cached token is returned almost instantly — no network round-trip
    expect(elapsed).toBeLessThan(500);
  });
});

import { SecretClient } from '@azure/keyvault-secrets';
import { getCredential } from '../auth/credential.js';

let _client: SecretClient | undefined;

function getClient(): SecretClient | null {
  const kvUri = process.env['AARM_KEYVAULT_URI'];
  if (!kvUri) return null;
  _client ??= new SecretClient(kvUri, getCredential());
  return _client;
}

/**
 * Retrieves a secret value from Azure Key Vault.
 *
 * Local dev fallback: when AARM_KEYVAULT_URI is not set (e.g. running locally without KV),
 * attempts to read the value from the env var AARM_SECRET_<NAME_UPPER_SNAKE>.
 * Example: secret name "aarm-contoso-prod" → env var "AARM_SECRET_AARM_CONTOSO_PROD".
 */
export async function getSecret(name: string): Promise<string | null> {
  const client = getClient();
  if (!client) {
    // Local dev fallback: AARM_SECRET_<NAME_IN_UPPER_SNAKE_CASE>
    const envKey = `AARM_SECRET_${name.toUpperCase().replace(/-/g, '_')}`;
    return process.env[envKey] ?? null;
  }
  try {
    const { value } = await client.getSecret(name);
    return value ?? null;
  } catch {
    return null;
  }
}

/** Creates or updates a secret in Key Vault. */
export async function setSecret(name: string, value: string): Promise<void> {
  const client = getClient();
  if (!client) throw new Error('AARM_KEYVAULT_URI is not configured');
  await client.setSecret(name, value);
}

/**
 * Soft-deletes a secret and immediately purges it so the name can be reused.
 * Silently ignores "not found" errors.
 */
export async function deleteSecret(name: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    const poller = await client.beginDeleteSecret(name);
    await poller.pollUntilDone();
    await client.purgeDeletedSecret(name);
  } catch {
    // Not found or purge not supported (soft-delete disabled) — ignore.
  }
}

/** Derives the KV secret name for a given job ID. Convention: "aarm-{jobId}" */
export function kvSecretName(jobId: string): string {
  return `aarm-${jobId}`;
}

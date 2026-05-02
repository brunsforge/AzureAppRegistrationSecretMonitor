import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// keytar is a CommonJS native addon — import via createRequire for ESM compatibility.
const keytar = require('keytar') as {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
};

const SERVICE = 'aarm';

export class CredentialStore {
  // ── Client secrets (service-principal / client-secret mode) ──────────────

  async getClientSecret(tenantId: string, clientId: string): Promise<string | null> {
    return keytar.getPassword(SERVICE, `${tenantId}:${clientId}`);
  }

  async setClientSecret(tenantId: string, clientId: string, secret: string): Promise<void> {
    await keytar.setPassword(SERVICE, `${tenantId}:${clientId}`, secret);
  }

  async deleteClientSecret(tenantId: string, clientId: string): Promise<boolean> {
    return keytar.deletePassword(SERVICE, `${tenantId}:${clientId}`);
  }

  // ── User passwords (username-password / ROPC mode) ───────────────────────
  // Key includes the UPN so a single client-id can hold credentials for different users.

  async getUserPassword(
    tenantId: string,
    clientId: string,
    username: string,
  ): Promise<string | null> {
    return keytar.getPassword(SERVICE, `${tenantId}:${clientId}:upw:${username}`);
  }

  async setUserPassword(
    tenantId: string,
    clientId: string,
    username: string,
    password: string,
  ): Promise<void> {
    await keytar.setPassword(
      SERVICE,
      `${tenantId}:${clientId}:upw:${username}`,
      password,
    );
  }

  async deleteUserPassword(
    tenantId: string,
    clientId: string,
    username: string,
  ): Promise<boolean> {
    return keytar.deletePassword(SERVICE, `${tenantId}:${clientId}:upw:${username}`);
  }
}

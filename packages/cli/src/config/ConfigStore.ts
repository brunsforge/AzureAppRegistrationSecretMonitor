import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { TenantProfile } from '@brunsforge/azure-app-registration-monitor';

const DEFAULT_CONFIG_DIR = join(homedir(), '.aarm');

export class ConfigStore {
  constructor(private readonly configDir: string = DEFAULT_CONFIG_DIR) {}

  private get tenantsPath(): string {
    return join(this.configDir, 'tenants.json');
  }

  async listTenants(): Promise<TenantProfile[]> {
    try {
      const raw = await readFile(this.tenantsPath, 'utf8');
      return JSON.parse(raw) as TenantProfile[];
    } catch {
      return [];
    }
  }

  async getTenant(nameOrId: string): Promise<TenantProfile | undefined> {
    const tenants = await this.listTenants();
    return tenants.find(
      (t) => t.tenantId === nameOrId || t.displayName === nameOrId,
    );
  }

  async upsertTenant(profile: TenantProfile): Promise<void> {
    const tenants = await this.listTenants();
    const idx = tenants.findIndex((t) => t.tenantId === profile.tenantId);
    if (idx >= 0) {
      tenants[idx] = profile;
    } else {
      tenants.push(profile);
    }
    await this.save(tenants);
  }

  async removeTenant(tenantId: string): Promise<boolean> {
    const tenants = await this.listTenants();
    const filtered = tenants.filter((t) => t.tenantId !== tenantId);
    if (filtered.length === tenants.length) return false;
    await this.save(filtered);
    return true;
  }

  private async save(tenants: TenantProfile[]): Promise<void> {
    await mkdir(this.configDir, { recursive: true });
    await writeFile(this.tenantsPath, JSON.stringify(tenants, null, 2), 'utf8');
  }
}

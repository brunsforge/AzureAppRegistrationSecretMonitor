import chalk from 'chalk';
import Table from 'cli-table3';
import type { AppRegistrationSummary, SecretSummary, TenantProfile } from '@brunsforge/azure-app-registration-monitor';
import type { ResultEnvelope } from '@brunsforge/azure-app-registration-monitor';

export function printJson<T>(envelope: ResultEnvelope<T>): void {
  process.stdout.write(JSON.stringify(envelope, null, 2) + '\n');
}

export function riskColor(level: string): string {
  switch (level) {
    case 'Critical': return chalk.red.bold(level);
    case 'High':     return chalk.red(level);
    case 'Medium':   return chalk.yellow(level);
    case 'Low':      return chalk.cyan(level);
    default:         return chalk.dim(level);
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case 'Expired':      return chalk.red.bold(status);
    case 'ExpiringSoon': return chalk.yellow(status);
    case 'Valid':        return chalk.green(status);
    default:             return chalk.dim(status);
  }
}

export function printTenantsTable(tenants: TenantProfile[]): void {
  if (tenants.length === 0) {
    process.stdout.write('No tenants configured. Run "aarm tenants add" to add one.\n');
    return;
  }
  const table = new Table({
    head: ['Name', 'Tenant ID', 'Auth Mode', 'Client ID', 'Last Scan'],
    style: { head: ['cyan'] },
  });
  for (const t of tenants) {
    table.push([
      t.displayName,
      t.tenantId,
      t.authMode,
      t.clientId ?? '-',
      t.lastSuccessfulScanAt
        ? new Date(t.lastSuccessfulScanAt).toLocaleDateString()
        : 'Never',
    ]);
  }
  process.stdout.write(table.toString() + '\n');
}

export function printAppsTable(apps: AppRegistrationSummary[]): void {
  if (apps.length === 0) {
    process.stdout.write('No App Registrations found.\n');
    return;
  }
  const table = new Table({
    head: ['Risk', 'App Name', 'Client ID', 'Secrets', 'Expired', 'Expiring'],
    style: { head: ['cyan'] },
  });
  for (const a of apps) {
    table.push([
      riskColor(a.riskLevel),
      a.displayName,
      a.appId,
      String(a.secretCount),
      a.expiredSecretCount > 0 ? chalk.red(String(a.expiredSecretCount)) : '0',
      a.expiringSecretCount > 0 ? chalk.yellow(String(a.expiringSecretCount)) : '0',
    ]);
  }
  process.stdout.write(table.toString() + '\n');
  process.stdout.write(chalk.dim(`${apps.length} app registration(s)\n`));
}

export function secretsToMarkdown(
  secrets: SecretSummary[],
  tenantId: string,
  _envName?: string,
): string {
  const lines: string[] = [
    `# Secret Expiry Report`,
    ``,
    `**Tenant:** ${tenantId}  **Generated:** ${new Date().toISOString().slice(0, 10)}`,
    ``,
    `| Risk | App | Secret | Key ID | Expires | Days | Status |`,
    `|------|-----|--------|--------|---------|------|--------|`,
  ];
  for (const s of secrets) {
    const expires = s.endDateTime ? new Date(s.endDateTime).toISOString().slice(0, 10) : '—';
    const days = s.daysUntilExpiry !== null ? String(s.daysUntilExpiry) : '—';
    const keyShort = s.keyId ? s.keyId.slice(0, 8) + '…' : '—';
    lines.push(
      `| ${s.riskLevel} | ${s.appDisplayName} | ${s.displayName ?? '—'} | ${keyShort} | ${expires} | ${days} | ${s.status} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

export function secretsToCsv(secrets: SecretSummary[]): string {
  const header = 'risk,app,appId,secret,keyId,startDate,endDate,daysUntilExpiry,status';
  const rows = secrets.map((s) => {
    const csv = (v: string | null | undefined) => `"${(v ?? '').replace(/"/g, '""')}"`;
    return [
      csv(s.riskLevel),
      csv(s.appDisplayName),
      csv(s.appId),
      csv(s.displayName),
      csv(s.keyId),
      csv(s.startDateTime),
      csv(s.endDateTime),
      String(s.daysUntilExpiry ?? ''),
      csv(s.status),
    ].join(',');
  });
  return [header, ...rows, ''].join('\n');
}

export function printSecretsTable(secrets: SecretSummary[]): void {
  if (secrets.length === 0) {
    process.stdout.write('No secrets found.\n');
    return;
  }
  const table = new Table({
    head: ['Risk', 'App', 'Secret', 'Expires', 'Days', 'Status'],
    style: { head: ['cyan'] },
  });
  for (const s of secrets) {
    const expires = s.endDateTime
      ? new Date(s.endDateTime).toLocaleDateString()
      : '-';
    const days =
      s.daysUntilExpiry !== null ? String(s.daysUntilExpiry) : '-';
    table.push([
      riskColor(s.riskLevel),
      s.appDisplayName,
      s.displayName ?? s.keyId,
      expires,
      days,
      statusColor(s.status),
    ]);
  }
  process.stdout.write(table.toString() + '\n');
  process.stdout.write(chalk.dim(`${secrets.length} secret(s)\n`));
}

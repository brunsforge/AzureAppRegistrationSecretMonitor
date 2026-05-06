import type { TokenCredential } from '@azure/identity';
import { LogsQueryClient, LogsQueryResultStatus } from '@azure/monitor-query';

export interface LogAnalyticsCapabilityResult {
  canQuery: boolean;
  canAnalyzeSignIns: boolean;
  warning?: string;
}

export interface UsageObservation {
  timeGenerated: string;
  appId: string;
  servicePrincipalId: string;
  credentialKeyId: string;
  resourceDisplayName: string;
  ipAddress: string;
  resultType: string;
  resultDescription: string;
  correlationId: string;
}

export interface UsageSummary {
  lastSeen: string;
  count: number;
  appId: string;
  servicePrincipalId: string;
  resourceDisplayName: string;
  ipAddress: string;
  resultType: string;
  resultDescription: string;
}

export interface AppUsageResult {
  workspaceId: string;
  appId: string;
  lookBackDays: number;
  rows: UsageObservation[];
  firstSeen: string | null;
  lastSeen: string | null;
  totalCount: number;
  successCount: number;
  failureCount: number;
  distinctKeyIds: string[];
}

export interface SecretUsageResult {
  workspaceId: string;
  keyId: string;
  lookBackDays: number;
  rows: UsageSummary[];
  lastSeen: string | null;
  totalCount: number;
}

const SP_SIGN_IN_TABLE = 'AADServicePrincipalSignInLogs';

/** Pattern that indicates the table is not routed to the workspace. */
const TABLE_NOT_FOUND_PATTERNS = [
  "is not defined",
  "could not be resolved",
  "unknown table",
  "doesn't exist",
];

function isPermissionError(err: unknown): boolean {
  const status = (err as { statusCode?: number }).statusCode;
  if (status === 403 || status === 401) return true;
  const msg = String((err as { message?: string }).message ?? '').toLowerCase();
  return msg.includes('forbidden') || msg.includes('unauthorized') || msg.includes('authorization');
}

function isTableNotFound(err: unknown): boolean {
  const msg = String((err as { message?: string }).message ?? '').toLowerCase();
  return TABLE_NOT_FOUND_PATTERNS.some((p) => msg.includes(p));
}

function rowsToObjects(
  columns: { name?: string }[],
  rows: unknown[][],
): Record<string, unknown>[] {
  return rows.map((row) =>
    Object.fromEntries(columns.map((col, i) => [col.name ?? `col${i}`, row[i]])),
  );
}

function isoOrNull(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function str(value: unknown): string {
  return value == null ? '' : String(value);
}

export class LogAnalyticsClient {
  private readonly logsClient: LogsQueryClient;

  constructor(credential: TokenCredential) {
    this.logsClient = new LogsQueryClient(credential);
  }

  async queryAppUsage(
    workspaceId: string,
    appId: string,
    days: number,
  ): Promise<AppUsageResult> {
    const kql = `
let lookBackWindow = ${days}d;
AADServicePrincipalSignInLogs
| where TimeGenerated > ago(lookBackWindow)
| where AppId == '${appId}'
| project TimeGenerated, AppId, ServicePrincipalId,
    ServicePrincipalCredentialKeyId, ResourceDisplayName,
    IPAddress, ResultType, ResultDescription, CorrelationId
| order by TimeGenerated desc`;

    const raw = await this.runQuery(workspaceId, kql, days);
    const rows: UsageObservation[] = raw.map((r) => ({
      timeGenerated: isoOrNull(r['TimeGenerated']) ?? '',
      appId: str(r['AppId']),
      servicePrincipalId: str(r['ServicePrincipalId']),
      credentialKeyId: str(r['ServicePrincipalCredentialKeyId']),
      resourceDisplayName: str(r['ResourceDisplayName']),
      ipAddress: str(r['IPAddress']),
      resultType: str(r['ResultType']),
      resultDescription: str(r['ResultDescription']),
      correlationId: str(r['CorrelationId']),
    }));

    const times = rows.map((r) => r.timeGenerated).filter(Boolean).sort();
    const distinctKeyIds = [...new Set(rows.map((r) => r.credentialKeyId).filter(Boolean))];

    return {
      workspaceId,
      appId,
      lookBackDays: days,
      rows,
      firstSeen: times[0] ?? null,
      lastSeen: times[times.length - 1] ?? null,
      totalCount: rows.length,
      successCount: rows.filter((r) => r.resultType === '0').length,
      failureCount: rows.filter((r) => r.resultType !== '0' && r.resultType !== '').length,
      distinctKeyIds,
    };
  }

  async querySecretUsage(
    workspaceId: string,
    keyId: string,
    days: number,
  ): Promise<SecretUsageResult> {
    const kql = `
let lookBackWindow = ${days}d;
AADServicePrincipalSignInLogs
| where TimeGenerated > ago(lookBackWindow)
| where ServicePrincipalCredentialKeyId == '${keyId}'
| summarize LastSeen = max(TimeGenerated), Count = count()
    by AppId, ServicePrincipalId, ResourceDisplayName, IPAddress, ResultType, ResultDescription
| order by LastSeen desc`;

    const raw = await this.runQuery(workspaceId, kql, days);
    const rows: UsageSummary[] = raw.map((r) => ({
      lastSeen: isoOrNull(r['LastSeen']) ?? '',
      count: Number(r['Count'] ?? 0),
      appId: str(r['AppId']),
      servicePrincipalId: str(r['ServicePrincipalId']),
      resourceDisplayName: str(r['ResourceDisplayName']),
      ipAddress: str(r['IPAddress']),
      resultType: str(r['ResultType']),
      resultDescription: str(r['ResultDescription']),
    }));

    const lastSeenValues = rows.map((r) => r.lastSeen).filter(Boolean).sort();

    return {
      workspaceId,
      keyId,
      lookBackDays: days,
      rows,
      lastSeen: lastSeenValues[lastSeenValues.length - 1] ?? null,
      totalCount: rows.reduce((sum, r) => sum + r.count, 0),
    };
  }

  async queryRotationCheck(
    workspaceId: string,
    appId: string,
    oldKeyId: string,
    days: number,
  ): Promise<SecretUsageResult> {
    const kql = `
let lookBackWindow = ${days}d;
AADServicePrincipalSignInLogs
| where TimeGenerated > ago(lookBackWindow)
| where AppId == '${appId}'
| where ServicePrincipalCredentialKeyId == '${oldKeyId}'
| summarize LastSeen = max(TimeGenerated), Count = count()
    by ResourceDisplayName, IPAddress, ResultType, ResultDescription
| order by LastSeen desc`;

    const raw = await this.runQuery(workspaceId, kql, days);
    const rows: UsageSummary[] = raw.map((r) => ({
      lastSeen: isoOrNull(r['LastSeen']) ?? '',
      count: Number(r['Count'] ?? 0),
      appId,
      servicePrincipalId: '',
      resourceDisplayName: str(r['ResourceDisplayName']),
      ipAddress: str(r['IPAddress']),
      resultType: str(r['ResultType']),
      resultDescription: str(r['ResultDescription']),
    }));

    const lastSeenValues = rows.map((r) => r.lastSeen).filter(Boolean).sort();

    return {
      workspaceId,
      keyId: oldKeyId,
      lookBackDays: days,
      rows,
      lastSeen: lastSeenValues[lastSeenValues.length - 1] ?? null,
      totalCount: rows.reduce((sum, r) => sum + r.count, 0),
    };
  }

  private async runQuery(
    workspaceId: string,
    kql: string,
    days: number,
  ): Promise<Record<string, unknown>[]> {
    const result = await this.logsClient.queryWorkspace(workspaceId, kql, {
      duration: `P${days}D`,
    });

    // Failure status throws an exception; only Success has tables guaranteed.
    if (result.status !== LogsQueryResultStatus.Success) {
      return [];
    }

    const table = result.tables[0];
    if (!table) return [];
    return rowsToObjects(table.columnDescriptors, table.rows as unknown[][]);
  }

  /**
   * Checks whether the workspace is queryable and whether
   * AADServicePrincipalSignInLogs is routed and accessible.
   * Uses `take 0` — no data is fetched, only schema is validated.
   */
  async checkCapability(workspaceId: string): Promise<LogAnalyticsCapabilityResult> {
    try {
      const result = await this.logsClient.queryWorkspace(
        workspaceId,
        `${SP_SIGN_IN_TABLE} | take 0`,
        { duration: 'PT1H' },
      );

      if (result.status === LogsQueryResultStatus.Success) {
        return { canQuery: true, canAnalyzeSignIns: true };
      }

      // Partial failure — workspace reachable but query partially failed
      return {
        canQuery: true,
        canAnalyzeSignIns: false,
        warning: `Log Analytics query returned partial results. Ensure ${SP_SIGN_IN_TABLE} is routed to workspace ${workspaceId}.`,
      };
    } catch (err) {
      if (isPermissionError(err)) {
        return { canQuery: false, canAnalyzeSignIns: false };
      }
      if (isTableNotFound(err)) {
        return {
          canQuery: true,
          canAnalyzeSignIns: false,
          warning:
            `${SP_SIGN_IN_TABLE} was not found in workspace ${workspaceId}. ` +
            'Configure Entra Diagnostic Settings to route Service Principal Sign-in Logs to this workspace.',
        };
      }
      const msg = err instanceof Error ? err.message : String(err);
      return {
        canQuery: false,
        canAnalyzeSignIns: false,
        warning: `Log Analytics check failed: ${msg}`,
      };
    }
  }
}

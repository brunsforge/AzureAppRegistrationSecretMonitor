import type { TokenCredential } from '@azure/identity';
import { LogsQueryClient, LogsQueryResultStatus } from '@azure/monitor-query';

export interface LogAnalyticsCapabilityResult {
  canQuery: boolean;
  canAnalyzeSignIns: boolean;
  warning?: string;
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

export class LogAnalyticsClient {
  private readonly logsClient: LogsQueryClient;

  constructor(credential: TokenCredential) {
    this.logsClient = new LogsQueryClient(credential);
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

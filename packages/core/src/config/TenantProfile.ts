import type { AuthMode } from '../auth/AuthMode.js';

export interface TenantProfile {
  tenantId: string;
  displayName: string;
  authMode: AuthMode;
  /** App Registration (client ID) used for authentication. Not required for azure-cli mode. */
  clientId?: string;
  /** UPN / email address for username-password mode. Never used for other modes. */
  username?: string;
  /** Log Analytics workspace ID for usage analysis (optional). */
  logAnalyticsWorkspaceId?: string;
  createdAt: string;
  updatedAt: string;
  lastPreflightAt?: string;
  lastSuccessfulScanAt?: string;
}

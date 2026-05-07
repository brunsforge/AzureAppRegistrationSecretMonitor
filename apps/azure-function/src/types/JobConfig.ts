export type JobAuthMode = 'workload-identity-federation' | 'client-secret' | 'certificate';

export interface JobConfig {
  id: string;
  enabled: boolean;
  tenantId: string;
  tenantDisplayName: string;
  environmentName: string;
  authMode: JobAuthMode;
  clientId: string;
  /** App Setting env var name (e.g. AARM_SECRET_CONTOSO_PROD). Omit for workload-identity-federation. */
  credentialRef?: string;
  schedule: {
    intervalDays: number;
    runAtUtc: string;
  };
  teamsWebhooks?: {
    status?: string | null;
    alerts?: string | null;
    errors?: string | null;
  };
  notificationTemplates?: {
    expiring?: string | null;
    critical?: string | null;
    summary?: string | null;
    error?: string | null;
  };
  notificationThresholds?: {
    expiringWithinDays?: number;
    criticalWithinDays?: number;
  };
  logAnalytics?: {
    workspaceId?: string | null;
    enabled?: boolean;
  };
}

export interface JobsConfig {
  version: string;
  jobs: JobConfig[];
}

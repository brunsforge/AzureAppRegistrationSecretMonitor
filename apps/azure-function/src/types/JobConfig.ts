export type JobAuthMode = 'workload-identity-federation' | 'client-secret' | 'certificate';

export interface JobConfig {
  id: string;
  enabled: boolean;
  tenantId: string;
  tenantDisplayName: string;
  authMode: JobAuthMode;
  clientId: string;
  /** Key Vault secret name (e.g. aarm-contoso-prod). Omit for workload-identity-federation. */
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
    /** Email template names (HTML Handlebars). null = built-in. */
    emailExpiring?: string | null;
    emailCritical?: string | null;
    emailSummary?: string | null;
    emailError?: string | null;
  };
  notificationThresholds?: {
    expiringWithinDays?: number;
    criticalWithinDays?: number;
  };
  /** Azure Communication Services Email targets. Requires AARM_ACS_ENDPOINT + AARM_ACS_SENDER_EMAIL. */
  mailTargets?: {
    to: string[];
    sendOnExpiring?: boolean;
    sendOnCritical?: boolean;
    sendOnStatus?: boolean;
    sendOnError?: boolean;
  } | null;
  logAnalytics?: {
    workspaceId?: string | null;
    enabled?: boolean;
  };
}

export interface JobsConfig {
  version: string;
  jobs: JobConfig[];
}

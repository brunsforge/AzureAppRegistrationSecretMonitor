export interface EnvironmentProfile {
  environmentId: string;
  tenantId: string;
  /** User-defined slug, e.g. "prod", "test", "contoso-prod" */
  name: string;
  notes?: string;
  logAnalyticsWorkspaceId?: string;
  defaultDaysForUsageAnalysis?: number;
}

export interface NotificationContext {
  tenantDisplayName: string;
  environmentName: string;
  scanTimestamp: string;
  secretCount: string;
  expiringCount: string;
  criticalCount: string;
  dashboardUrl: string;
}

export interface ErrorNotificationContext {
  tenantDisplayName: string;
  environmentName: string;
  errorMessage: string;
  timestamp: string;
  dashboardUrl: string;
}

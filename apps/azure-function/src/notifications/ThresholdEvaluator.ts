import type { AppRegistrationSummary } from '@brunsforge/azure-app-registration-monitor';
import type { JobConfig } from '../types/JobConfig.js';

export interface ThresholdResult {
  secretCount: number;
  expiringCount: number;
  criticalCount: number;
  hasCritical: boolean;
  hasExpiring: boolean;
}

export function evaluateThresholds(
  apps: AppRegistrationSummary[],
  job: JobConfig,
): ThresholdResult {
  const expiringDays = job.notificationThresholds?.expiringWithinDays ?? 30;
  const criticalDays = job.notificationThresholds?.criticalWithinDays ?? 7;

  let secretCount = 0;
  let expiringCount = 0;
  let criticalCount = 0;

  for (const app of apps) {
    for (const secret of app.secrets) {
      secretCount++;
      const days = secret.daysUntilExpiry;
      if (days !== null && days !== undefined) {
        if (days <= criticalDays) criticalCount++;
        else if (days <= expiringDays) expiringCount++;
      }
    }
  }

  return {
    secretCount,
    expiringCount,
    criticalCount,
    hasCritical: criticalCount > 0,
    hasExpiring: expiringCount > 0,
  };
}

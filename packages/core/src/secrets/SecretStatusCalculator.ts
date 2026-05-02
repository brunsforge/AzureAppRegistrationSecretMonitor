export type SecretStatus = 'Valid' | 'ExpiringSoon' | 'Expired' | 'Unknown';

export interface ExpiryResult {
  status: SecretStatus;
  daysUntilExpiry: number | null;
}

export interface ExpiryThresholds {
  expiringWithinDays: number;
}

const DEFAULT_THRESHOLDS: ExpiryThresholds = {
  expiringWithinDays: 30,
};

export function calculateExpiryStatus(
  endDateTime: string | null | undefined,
  thresholds: ExpiryThresholds = DEFAULT_THRESHOLDS,
  now: Date = new Date(),
): ExpiryResult {
  if (!endDateTime) {
    return { status: 'Unknown', daysUntilExpiry: null };
  }

  const expiry = new Date(endDateTime);
  if (isNaN(expiry.getTime())) {
    return { status: 'Unknown', daysUntilExpiry: null };
  }

  const msUntilExpiry = expiry.getTime() - now.getTime();
  const daysUntilExpiry = Math.floor(msUntilExpiry / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) {
    return { status: 'Expired', daysUntilExpiry };
  }
  if (daysUntilExpiry <= thresholds.expiringWithinDays) {
    return { status: 'ExpiringSoon', daysUntilExpiry };
  }
  return { status: 'Valid', daysUntilExpiry };
}

export type RiskLevel = 'Info' | 'Low' | 'Medium' | 'High' | 'Critical';

const RISK_ORDER: Record<RiskLevel, number> = {
  Info: 0,
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

export function riskLevelOrder(level: RiskLevel): number {
  return RISK_ORDER[level];
}

export function maxRiskLevel(levels: RiskLevel[]): RiskLevel {
  return levels.reduce<RiskLevel>(
    (worst, l) => (riskLevelOrder(l) > riskLevelOrder(worst) ? l : worst),
    'Info',
  );
}

export function classifySecretRisk(
  daysUntilExpiry: number | null,
  status: string,
): RiskLevel {
  if (status === 'Unknown') return 'Info';
  if (status === 'Expired') return 'Critical';
  if (daysUntilExpiry === null) return 'Info';

  if (daysUntilExpiry <= 30) return 'High';
  if (daysUntilExpiry <= 90) return 'Medium';
  if (daysUntilExpiry <= 180) return 'Low';
  return 'Info';
}

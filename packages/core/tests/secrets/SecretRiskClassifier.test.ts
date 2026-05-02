import { describe, expect, it } from 'vitest';
import {
  classifySecretRisk,
  maxRiskLevel,
  riskLevelOrder,
} from '../../src/secrets/SecretRiskClassifier.js';

describe('classifySecretRisk', () => {
  it('returns Info for Unknown status regardless of days', () => {
    expect(classifySecretRisk(null, 'Unknown')).toBe('Info');
    expect(classifySecretRisk(200, 'Unknown')).toBe('Info');
  });

  it('returns Critical for Expired status', () => {
    expect(classifySecretRisk(-5, 'Expired')).toBe('Critical');
    expect(classifySecretRisk(0, 'Expired')).toBe('Critical');
  });

  it('returns High for 0–30 days remaining', () => {
    expect(classifySecretRisk(0, 'ExpiringSoon')).toBe('High');
    expect(classifySecretRisk(15, 'ExpiringSoon')).toBe('High');
    expect(classifySecretRisk(30, 'ExpiringSoon')).toBe('High');
  });

  it('returns Medium for 31–90 days remaining', () => {
    expect(classifySecretRisk(31, 'Valid')).toBe('Medium');
    expect(classifySecretRisk(90, 'Valid')).toBe('Medium');
  });

  it('returns Low for 91–180 days remaining', () => {
    expect(classifySecretRisk(91, 'Valid')).toBe('Low');
    expect(classifySecretRisk(180, 'Valid')).toBe('Low');
  });

  it('returns Info for more than 180 days remaining', () => {
    expect(classifySecretRisk(181, 'Valid')).toBe('Info');
    expect(classifySecretRisk(365, 'Valid')).toBe('Info');
  });
});

describe('riskLevelOrder', () => {
  it('orders risk levels correctly', () => {
    expect(riskLevelOrder('Info')).toBeLessThan(riskLevelOrder('Low'));
    expect(riskLevelOrder('Low')).toBeLessThan(riskLevelOrder('Medium'));
    expect(riskLevelOrder('Medium')).toBeLessThan(riskLevelOrder('High'));
    expect(riskLevelOrder('High')).toBeLessThan(riskLevelOrder('Critical'));
  });
});

describe('maxRiskLevel', () => {
  it('returns Info for an empty array', () => {
    expect(maxRiskLevel([])).toBe('Info');
  });

  it('returns the highest risk level in the array', () => {
    expect(maxRiskLevel(['Info', 'Medium', 'High', 'Low'])).toBe('High');
    expect(maxRiskLevel(['Low', 'Critical', 'Medium'])).toBe('Critical');
  });

  it('returns Info when all levels are Info', () => {
    expect(maxRiskLevel(['Info', 'Info'])).toBe('Info');
  });
});

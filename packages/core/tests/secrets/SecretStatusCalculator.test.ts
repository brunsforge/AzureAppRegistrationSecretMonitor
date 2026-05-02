import { describe, expect, it } from 'vitest';
import { calculateExpiryStatus } from '../../src/secrets/SecretStatusCalculator.js';

const NOW = new Date('2026-05-01T12:00:00Z');

describe('calculateExpiryStatus', () => {
  it('returns Unknown for null endDateTime', () => {
    const result = calculateExpiryStatus(null, undefined, NOW);
    expect(result.status).toBe('Unknown');
    expect(result.daysUntilExpiry).toBeNull();
  });

  it('returns Unknown for undefined endDateTime', () => {
    const result = calculateExpiryStatus(undefined, undefined, NOW);
    expect(result.status).toBe('Unknown');
  });

  it('returns Unknown for an invalid date string', () => {
    const result = calculateExpiryStatus('not-a-date', undefined, NOW);
    expect(result.status).toBe('Unknown');
    expect(result.daysUntilExpiry).toBeNull();
  });

  it('returns Expired with negative daysUntilExpiry for a past date', () => {
    const result = calculateExpiryStatus('2026-04-01T00:00:00Z', undefined, NOW);
    expect(result.status).toBe('Expired');
    expect(result.daysUntilExpiry).toBeLessThan(0);
  });

  it('returns ExpiringSoon for a date within the default 30-day threshold', () => {
    const result = calculateExpiryStatus('2026-05-20T00:00:00Z', undefined, NOW);
    expect(result.status).toBe('ExpiringSoon');
    expect(result.daysUntilExpiry).toBeGreaterThanOrEqual(0);
    expect(result.daysUntilExpiry).toBeLessThanOrEqual(30);
  });

  it('returns Valid for a date beyond the threshold', () => {
    const result = calculateExpiryStatus('2027-01-01T00:00:00Z', undefined, NOW);
    expect(result.status).toBe('Valid');
    expect(result.daysUntilExpiry).toBeGreaterThan(30);
  });

  it('respects a custom expiringWithinDays threshold', () => {
    const result = calculateExpiryStatus(
      '2026-07-01T00:00:00Z',
      { expiringWithinDays: 90 },
      NOW,
    );
    expect(result.status).toBe('ExpiringSoon');
  });

  it('returns Valid when date is exactly one day beyond the threshold', () => {
    // NOW = 2026-05-01, default threshold = 30 days → boundary = 2026-05-31
    const result = calculateExpiryStatus('2026-06-01T12:00:00Z', undefined, NOW);
    expect(result.status).toBe('Valid');
  });
});

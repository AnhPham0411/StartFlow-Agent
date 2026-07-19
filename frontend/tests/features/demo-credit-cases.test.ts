import { describe, expect, it } from 'vitest';
import { demoCreditCases, findDemoCreditCase } from '@/src/data/demo-credit-cases';

describe('synthetic credit case fixtures', () => {
  it('provides a populated and diverse dashboard without a backend', () => {
    expect(demoCreditCases).toHaveLength(6);
    expect(new Set(demoCreditCases.map((item) => item.registrationNumber)).size).toBe(6);
    expect(demoCreditCases.every((item) => item.demoData && item.companyName.includes('Demo'))).toBe(true);
    expect(demoCreditCases.some((item) => item.latestRun?.status === 'AWAITING_APPROVAL')).toBe(true);
    expect(demoCreditCases.some((item) => item.latestRun?.status === 'COMPLETED')).toBe(true);
  });

  it('resolves a full case with financials and submitted documents', () => {
    const record = findDemoCreditCase('demo-case-sao-mai');
    expect(record?.financials.revenue).toBeGreaterThan(0);
    expect(record?.submittedDocuments.length).toBeGreaterThan(1);
  });
});

import { describe, expect, it } from 'vitest';
import {
  caseInputSchema,
  decisionStatusSchema,
  publicRunEventTypeSchema,
  runEventSchema,
} from '../src/index.js';

describe('shared StartFlow contracts', () => {
  it('accepts a demo company case and rejects non-demo data', () => {
    const input = {
      companyName: 'Công ty Cổ phần Sao Việt Demo',
      registrationNumber: 'DEMO-01020304',
      requestedAmount: 5_000_000_000,
      purpose: 'Bổ sung vốn lưu động cho đơn hàng mô phỏng.',
      financials: {
        revenue: 30_000_000_000,
        ebitda: 4_500_000_000,
        totalDebt: 8_000_000_000,
        equity: 12_000_000_000,
        currentAssets: 15_000_000_000,
        currentLiabilities: 9_000_000_000,
      },
      submittedDocuments: ['Đăng ký kinh doanh', 'Báo cáo tài chính năm gần nhất'],
      demoData: true as const,
    };

    expect(caseInputSchema.parse(input)).toEqual(input);
    expect(() => caseInputSchema.parse({ ...input, demoData: false })).toThrow();
  });

  it('locks the public decision and event vocabularies', () => {
    expect(decisionStatusSchema.options).toEqual(['RECOMMEND', 'NEEDS_REVIEW', 'BLOCKED']);
    expect(publicRunEventTypeSchema.options).toContain('approval.required');
  });

  it('rejects an event without a monotonic positive sequence', () => {
    expect(
      runEventSchema.safeParse({
        id: '5da18152-1dc1-4a55-a89d-2711c9b8d1df',
        runId: 'a3a81819-ad15-4370-a1c4-99247205a102',
        sequence: 0,
        type: 'run.started',
        agent: null,
        occurredAt: '2026-07-17T09:00:00.000Z',
        correlationId: 'b00f4274-3107-4754-90b9-97e29255af91',
        idempotencyKey: 'run-started-1',
        payload: {},
      }).success,
    ).toBe(false);
  });
});

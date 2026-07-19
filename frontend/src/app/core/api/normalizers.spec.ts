import {
  normalizeCaseDetail,
  normalizeCaseSummary,
  normalizeCollection,
  normalizeRunDetail,
  unwrapPayload,
} from './normalizers';

describe('API normalizers', () => {
  it('unwraps raw and data-envelope payloads', () => {
    expect(unwrapPayload({ id: 'raw' })).toEqual({ id: 'raw' });
    expect(unwrapPayload({ data: { id: 'wrapped' } })).toEqual({ id: 'wrapped' });
  });

  it('normalizes raw, items and nested data/items collections', () => {
    expect(normalizeCollection([{ id: 1 }])).toEqual([{ id: 1 }]);
    expect(normalizeCollection({ items: [{ id: 2 }] })).toEqual([{ id: 2 }]);
    expect(normalizeCollection({ data: { items: [{ id: 3 }] } })).toEqual([{ id: 3 }]);
    expect(normalizeCollection({ data: {} })).toEqual([]);
  });

  it('supplies safe optional defaults for case summaries and details', () => {
    expect(normalizeCaseSummary({ id: 'case-1', companyName: 'Demo' })).toEqual(
      jasmine.objectContaining({
        id: 'case-1',
        companyName: 'Demo',
        registrationNumber: '',
        requestedAmount: 0,
        latestRun: null,
        runCount: 0,
      }),
    );
    expect(normalizeCaseDetail({ id: 'case-1', financials: null })).toEqual(
      jasmine.objectContaining({
        id: 'case-1',
        demoData: true,
        submittedDocuments: [],
        runs: [],
        runCount: 0,
        financials: {
          revenue: 0,
          ebitda: 0,
          totalDebt: 0,
          equity: 0,
          currentAssets: 0,
          currentLiabilities: 0,
        },
      }),
    );
  });

  it('filters invalid stored run events instead of leaking malformed API data', () => {
    const run = normalizeRunDetail({
      id: 'run-1',
      caseId: 'case-1',
      status: 'RUNNING',
      events: [{ id: 'not-a-uuid' }],
      tasks: [],
    });

    expect(run.events).toEqual([]);
    expect(run.agentResults).toEqual([]);
    expect(run.finalDecision).toBeNull();
  });
});

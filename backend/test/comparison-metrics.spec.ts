import { buildDemoComparisonMetrics } from '../src/modules/runs/comparison-metrics';

describe('same-snapshot comparison rubric', () => {
  it('returns all six stable metrics from one immutable demo snapshot', () => {
    const snapshot = { submittedDocuments: ['registration', 'financials'] };

    const first = buildDemoComparisonMetrics(snapshot);
    const second = buildDemoComparisonMetrics(snapshot);

    expect(second).toEqual(first);
    expect(first.map((metric) => metric.name)).toEqual([
      'completeness',
      'citationCoverage',
      'toolUse',
      'conflictDetection',
      'latency',
      'rubricScore',
    ]);
    expect(first).toHaveLength(6);
  });
});

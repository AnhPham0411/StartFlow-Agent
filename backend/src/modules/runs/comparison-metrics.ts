import type { ComparisonMetric } from '@startflow/contracts';

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildDemoComparisonMetrics(snapshot: Record<string, unknown>): ComparisonMetric[] {
  const documentCount = Array.isArray(snapshot.submittedDocuments)
    ? snapshot.submittedDocuments.length
    : 0;
  const singleCompleteness = clamp(40 + documentCount * 10);
  const multiCompleteness = clamp(65 + documentCount * 10);
  const singleCitationCoverage = clamp(25 + documentCount * 5);
  const multiCitationCoverage = clamp(75 + documentCount * 5);
  const singleRubric = clamp((singleCompleteness + singleCitationCoverage + 25 + 20) / 4);
  const multiRubric = clamp((multiCompleteness + multiCitationCoverage + 100 + 100) / 4);

  return [
    {
      name: 'completeness',
      singleAgent: singleCompleteness,
      multiAgent: multiCompleteness,
      unit: 'percent',
    },
    {
      name: 'citationCoverage',
      singleAgent: singleCitationCoverage,
      multiAgent: multiCitationCoverage,
      unit: 'percent',
    },
    { name: 'toolUse', singleAgent: 25, multiAgent: 100, unit: 'percent' },
    { name: 'conflictDetection', singleAgent: 20, multiAgent: 100, unit: 'percent' },
    {
      name: 'latency',
      singleAgent: Number((1.2 + documentCount * 0.1).toFixed(1)),
      multiAgent: Number((2.5 + documentCount * 0.15).toFixed(1)),
      unit: 'seconds',
    },
    { name: 'rubricScore', singleAgent: singleRubric, multiAgent: multiRubric, unit: 'points' },
  ];
}

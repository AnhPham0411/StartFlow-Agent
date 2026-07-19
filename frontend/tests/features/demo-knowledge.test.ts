import { describe, expect, it } from 'vitest';
import {
  demoKnowledgeDocuments,
  isDemoKnowledgeDocument,
} from '@/src/data/demo-knowledge';

describe('synthetic knowledge fixtures', () => {
  it('keeps the standalone knowledge library populated across banking domains', () => {
    expect(demoKnowledgeDocuments).toHaveLength(6);
    expect(new Set(demoKnowledgeDocuments.map((item) => item.domain))).toEqual(
      new Set(['credit', 'compliance', 'operations']),
    );
    expect(demoKnowledgeDocuments.every((item) => item.status === 'READY')).toBe(true);
    expect(demoKnowledgeDocuments.every((item) => (item.chunkCount ?? 0) > 0)).toBe(true);
  });

  it('provides readable detail and a concrete example for every document', () => {
    for (const item of demoKnowledgeDocuments) {
      expect(isDemoKnowledgeDocument(item)).toBe(true);
      expect(item.summary.length).toBeGreaterThan(60);
      expect(item.keyPoints.length).toBeGreaterThanOrEqual(3);
      expect(item.exampleCase.length).toBeGreaterThan(60);
      expect(item.title).not.toMatch(/DEMO-|PROC-|KNOW-/i);
    }
  });
});

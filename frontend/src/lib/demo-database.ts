import rawDatabase from '@/src/data/synthetic-banking-demo.json';
import type { AssistantEvidence } from './assistant-types';

interface DemoRecord {
  id: string;
  type: string;
  domain: string;
  title: string;
  section: string;
  effectiveDate: string;
  keywords: string[];
  content: string;
}

const records = rawDatabase.records as DemoRecord[];

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function retrieveDemoEvidence(prompt: string, limit = 5): AssistantEvidence[] {
  const query = normalize(prompt);
  const tokens = new Set(query.split(' ').filter((token) => token.length > 2));
  return records
    .map((record) => {
      const title = normalize(record.title);
      const content = normalize(record.content);
      const keywords = record.keywords.map(normalize);
      let score = 0;
      for (const keyword of keywords) {
        if (keyword && query.includes(keyword)) score += keyword.includes(' ') ? 10 : 6;
      }
      for (const token of tokens) {
        if (title.includes(token)) score += 3;
        else if (content.includes(token)) score += 1;
      }
      return { record, score };
    })
    .filter(({ score }) => score >= 3)
    .sort((left, right) => right.score - left.score || left.record.id.localeCompare(right.record.id))
    .slice(0, limit)
    .map(({ record, score }) => ({
      id: `demo-${record.id}`,
      source: `${record.id} · ${record.title}`,
      label: `CSDL demo tổng hợp · ${record.section} · hiệu lực ${record.effectiveDate}`,
      excerpt: record.content,
      confidence: Math.min(0.98, 0.62 + score / 100),
    }));
}

export function demoDatabaseSummary() {
  const seedDataset = rawDatabase.sourceDatasets[0];
  return {
    synthetic: rawDatabase.synthetic,
    version: rawDatabase.version,
    records: records.length,
    staff: rawDatabase.staff.length,
    sourceRows: seedDataset?.insertRows ?? 0,
    sourceTables: seedDataset?.tables ?? 0,
  };
}

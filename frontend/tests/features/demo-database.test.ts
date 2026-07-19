import { describe, expect, it } from 'vitest';
import { demoDatabaseSummary, retrieveDemoEvidence } from '@/src/lib/demo-database';

describe('synthetic banking demo database', () => {
  it('is explicitly synthetic and includes policy/workforce demo records', () => {
    const summary = demoDatabaseSummary();
    expect(summary.synthetic).toBe(true);
    expect(summary.records).toBeGreaterThanOrEqual(16);
    expect(summary.staff).toBeGreaterThanOrEqual(6);
    expect(summary.sourceRows).toBe(37_624);
    expect(summary.sourceTables).toBe(27);
  });

  it('retrieves cited KYC policy evidence for read-only employee guidance', () => {
    const evidence = retrieveDemoEvidence('Hướng dẫn cách kiểm tra hồ sơ KYC và CCCD');
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence.some((item) => item.id.includes('POL-DEMO-001'))).toBe(true);
    expect(evidence.every((item) => !item.source.includes('DEMO-00'))).toBe(true);
    expect(evidence.every((item) => item.label.includes('CSDL demo tổng hợp'))).toBe(true);
  });

  it('retrieves only masked aggregate evidence derived from seed_20k.sql', () => {
    const evidence = retrieveDemoEvidence('Tổng quan pipeline NBA và sàng lọc khách hàng tiềm năng');
    expect(evidence.some((item) => item.id.includes('NBA-DEMO-001'))).toBe(true);
    expect(evidence.some((item) => item.excerpt.includes('2.500 điểm sản phẩm'))).toBe(true);
    expect(evidence.every((item) => !item.excerpt.includes('CIF000'))).toBe(true);
  });
});

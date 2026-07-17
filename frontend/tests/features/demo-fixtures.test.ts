import { caseInputSchema } from '@startflow/contracts';
import { describe, expect, it } from 'vitest';
import { demoFixtures } from '@/src/lib/demo-fixtures';

describe('demo intake fixtures', () => {
  it('keeps every fixture inside the shared case contract', () => {
    expect(demoFixtures).toHaveLength(2);
    for (const fixture of demoFixtures)
      expect(caseInputSchema.safeParse(fixture.input).success).toBe(true);
  });

  it('uses only explicit demo data', () => {
    expect(demoFixtures.every((fixture) => fixture.input.demoData)).toBe(true);
  });
});

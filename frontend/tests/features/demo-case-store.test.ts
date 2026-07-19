import { beforeEach, describe, expect, it } from 'vitest';
import { demoFixtures } from '@/src/lib/demo-fixtures';
import {
  findStoredDemoCase,
  listStoredDemoCases,
  saveStoredDemoCase,
} from '@/src/lib/demo-case-store';

describe('standalone demo case store', () => {
  beforeEach(() => window.localStorage.clear());

  it('persists a valid intake and makes its detail available without an API', () => {
    const created = saveStoredDemoCase(demoFixtures[0]!.input);

    expect(created.id).toMatch(/^demo-case-local-/);
    expect(listStoredDemoCases()).toHaveLength(1);
    expect(findStoredDemoCase(created.id)?.companyName).toBe(created.companyName);
    expect(findStoredDemoCase(created.id)?.runs).toEqual([]);
  });

  it('ignores malformed browser storage', () => {
    window.localStorage.setItem('startflow.demo.cases.v1', '[{"id":"unsafe"}]');
    expect(listStoredDemoCases()).toEqual([]);
  });
});

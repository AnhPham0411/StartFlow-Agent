import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const routeSources = [
  'frontend/src/app/layout/main-layout.component.ts',
  'frontend/src/app/layout/main-layout.component.html',
  'frontend/src/app/features/dashboard/dashboard.component.ts',
  'frontend/src/app/features/cases/list/case-list.component.ts',
  'frontend/src/app/features/cases/intake/case-intake.component.ts',
  'frontend/src/app/features/cases/detail/case-detail.component.ts',
  'frontend/src/app/features/runs/run-workspace.component.ts',
  'frontend/src/app/features/comparisons/comparison.component.ts',
  'frontend/src/app/features/knowledge/knowledge.component.ts',
];

test('SHB shell owns responsive spacing and a valid PNG logo', async () => {
  const styles = await readFile('frontend/src/app/layout/main-layout.component.scss', 'utf8');
  assert.match(styles, /padding:\s*24px/);
  assert.match(styles, /@media\s*\(max-width:\s*767px\)[\s\S]*padding:\s*16px/);

  const logo = await readFile('frontend/public/logo.png');
  assert.deepEqual([...logo.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});

test('routed pages no longer depend on the Core tab router', async () => {
  for (const path of routeSources) {
    const source = await readFile(path, 'utf8');
    assert.doesNotMatch(
      source,
      /@sdcorejs\/angular\/components\/tab-router|SdTabComponent|SD_TAB|sd-tab-router-outlet/,
      `${path} still contains tab-router integration`,
    );
  }
});

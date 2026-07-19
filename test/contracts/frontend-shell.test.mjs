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

function assertValidPng(png) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.deepEqual(png.subarray(0, signature.length), signature);

  let offset = signature.length;
  let chunkIndex = 0;
  let foundIend = false;

  while (offset < png.length) {
    assert.ok(offset + 12 <= png.length, `PNG chunk ${chunkIndex} header or CRC is truncated`);

    const length = png.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = typeStart + 4;
    const chunkEnd = dataStart + length + 4;
    const type = png.toString('ascii', typeStart, dataStart);

    assert.match(type, /^[A-Za-z]{4}$/, `PNG chunk ${chunkIndex} has an invalid type`);
    assert.ok(chunkEnd <= png.length, `PNG chunk ${type} exceeds the file length`);

    if (chunkIndex === 0) {
      assert.equal(type, 'IHDR');
      assert.equal(length, 13);
    }

    if (type === 'IEND') {
      assert.equal(length, 0);
      assert.equal(chunkEnd, png.length, 'PNG contains bytes after IEND');
      foundIend = true;
    }

    offset = chunkEnd;
    chunkIndex += 1;
  }

  assert.ok(foundIend, 'PNG is missing IEND');
  assert.equal(offset, png.length);
}

test('SHB shell owns responsive spacing and a valid PNG logo', async () => {
  const logo = await readFile('frontend/public/logo.png');
  assertValidPng(logo);

  const styles = await readFile('frontend/src/app/layout/main-layout.component.scss', 'utf8');
  const activeStyles = styles.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.match(activeStyles, /\.app-route-content\s*\{[^}]*padding:\s*24px/);
  assert.match(
    activeStyles,
    /@media\s*\(max-width:\s*767px\)\s*\{[\s\S]*?\.app-route-content\s*\{[^}]*padding:\s*16px/,
  );
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

import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const guideDir = dirname(fileURLToPath(import.meta.url));
const imageDir = join(guideDir, 'images');
const requireFromE2e = createRequire(new URL('../../../test/e2e/package.json', import.meta.url));
const baseUrl =
  process.env.SDCOREJS_DOCS_BASE_URL || readArg('--base-url') || 'http://localhost:3000';

// No configuration screen exists yet. Add harvested routes here when one is introduced.
const screenshots = [];

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (screenshots.length === 0) {
  console.log('No frontend-configuration screens are available to capture.');
} else {
  const { chromium } = requireFromE2e('@playwright/test');
  await mkdir(imageDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    for (const item of screenshots) {
      await page.goto(new URL(item.route, baseUrl).href, { waitUntil: 'networkidle' });
      for (const step of item.steps ?? []) await step(page);
      await page.locator(item.selector).first().screenshot({ path: join(guideDir, item.file) });
      console.log(`captured ${item.file}`);
    }
  } finally {
    await browser.close();
  }
}

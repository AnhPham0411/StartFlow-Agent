import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.STARTFLOW_E2E_BASE_URL;

if (!baseURL) {
  throw new Error(
    'STARTFLOW_E2E_BASE_URL is required (for example http://compute-node:3220 or the Cloudflare URL).',
  );
}

export default defineConfig({
  testDir: './standalone',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 150_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
});

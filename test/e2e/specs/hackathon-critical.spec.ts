import { expect, test } from '@playwright/test';

const demoCase = {
  id: '5d8de625-cbd0-48ba-9c45-cbe4a2c1eff5',
  companyName: 'Công ty Minh An Demo',
  registrationNumber: 'DEMO-001',
  requestedAmount: 2_500_000_000,
  purpose: 'Bổ sung vốn lưu động cho đơn hàng demo',
  createdAt: '2026-07-17T08:00:00.000Z',
};

test('Sales Copilot: mock analyst lands on the protected call list', async ({ page }) => {
  await page.route('**/api/nba/calllist**', (route) => route.fulfill({ json: [] }));
  await page.goto('/dashboard');

  await expect(page).toHaveURL(/\/nba\/calllist$/);
  await expect(page.getByRole('heading', { name: 'Call List' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Khách hàng' })).toBeVisible();
  await expect(page.getByText(/Không có khách nào trong call list ngày/)).toBeVisible();
});

test('US-06 · AC-017: comparison renders all six frozen metrics', async ({ page }) => {
  await page.route('**/api/cases', (route) => route.fulfill({ json: [demoCase] }));
  await page.route('**/api/cases/*/comparisons', (route) =>
    route.fulfill({
      json: {
        id: 'cmp-demo-001',
        metrics: [
          ['completeness', 55, 90, '%'],
          ['citationCoverage', 25, 88, '%'],
          ['toolUse', 1, 4, 'count'],
          ['conflictDetection', 0, 2, 'count'],
          ['latency', 2.1, 3.6, 's'],
          ['rubricScore', 48, 91, 'points'],
        ].map(([name, singleAgent, multiAgent, unit]) => ({ name, singleAgent, multiAgent, unit })),
      },
    }),
  );

  await page.goto('/comparisons');
  await page.getByRole('button', { name: 'Chạy phép so sánh' }).click();

  await expect(page.getByRole('table', { name: 'So sánh sáu metric' })).toBeVisible();
  await expect(page.getByText('Điểm rubric')).toBeVisible();
  await expect(page.getByText('Phát hiện xung đột')).toBeVisible();
});

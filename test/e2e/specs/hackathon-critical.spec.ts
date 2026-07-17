import { expect, test } from '@playwright/test';

const demoCase = {
  id: '5d8de625-cbd0-48ba-9c45-cbe4a2c1eff5',
  companyName: 'Công ty Minh An Demo',
  registrationNumber: 'DEMO-001',
  requestedAmount: 2_500_000_000,
  purpose: 'Bổ sung vốn lưu động cho đơn hàng demo',
  createdAt: '2026-07-17T08:00:00.000Z',
};

test('US-01 · AC-002/004: mock analyst can open the protected dashboard', async ({ page }) => {
  await page.route('**/api/cases', (route) => route.fulfill({ json: [] }));
  await page.goto('/dashboard');

  await expect(page.getByRole('heading', { name: 'Trung tâm đánh giá tín dụng' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tạo hồ sơ demo' }).first()).toBeVisible();
  await expect(page.getByText('Chưa có hồ sơ')).toBeVisible();
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

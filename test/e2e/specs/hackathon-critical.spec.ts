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

  const main = page.getByRole('main', { name: 'Nội dung chính' });
  await expect(
    main.getByRole('heading', { level: 1, name: 'Trung tâm đánh giá tín dụng' }),
  ).toBeVisible();
  const createCase = page.locator('[data-autoid="components-button-dashboard-create-case"]');
  await expect(createCase).toBeVisible();
  await expect(createCase).toHaveAccessibleName('Tạo hồ sơ demo');
  await expect(main.getByText('Chưa có hồ sơ', { exact: true })).toBeVisible();
});

test('US-06 · AC-017: comparison renders all six frozen metrics', async ({ page }) => {
  await page.route('**/api/cases', (route) => route.fulfill({ json: [demoCase] }));
  await page.route('**/api/cases/*/comparisons', (route) =>
    route.fulfill({
      json: {
        id: 'cmp-demo-001',
        metrics: [
          ['latency', 2.1, 3.6, 's'],
          ['conflictDetection', 0, 2, 'count'],
          ['toolUse', 1, 4, 'count'],
          ['citationCoverage', 25, 88, 'percent'],
          ['completeness', 55, 90, '%'],
          ['rubricScore', 48, 91, 'points'],
        ].map(([name, singleAgent, multiAgent, unit]) => ({ name, singleAgent, multiAgent, unit })),
      },
    }),
  );

  await page.goto('/comparisons');
  await page.locator('[data-autoid="components-button-run-comparison"]').click();

  const table = page.locator('[data-autoid="components-table-comparison-metrics"]');
  await expect(table).toBeVisible();
  for (const label of [
    'Độ đầy đủ',
    'Phủ căn cứ',
    'Sử dụng công cụ',
    'Phát hiện xung đột',
    'Độ trễ',
    'Điểm rubric',
  ]) {
    await expect(table.getByText(label, { exact: true })).toBeVisible();
  }
});

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

test('NBA demo: sale opens a recommendation, saves a note and submits feedback', async ({
  page,
}) => {
  const notes = [
    {
      id: 7,
      customer_id: 42,
      sale_id: 2,
      note_text: 'Khách muốn tìm hiểu thêm về lãi suất.',
      created_at: '2026-07-19T01:00:00.000Z',
      sale_name: 'Sale Demo',
    },
  ];

  await page.route('**/api/nba/calllist*', (route) =>
    route.fulfill({
      json: [
        {
          customer_id: 42,
          name: 'Nguyễn Demo An',
          cif_code: 'CIF-00042',
          product_rank1: 'vay',
          score_rank1: 0.91,
          product_rank2: 'the',
          score_rank2: 0.76,
          rec_id: '123',
          rec_version: 3,
        },
      ],
    }),
  );
  await page.route('**/api/nba/customer/42', (route) =>
    route.fulfill({
      json: {
        customer_id: 42,
        full_name: 'Nguyễn Demo An',
        cif_code: 'CIF-00042',
        recommendation: {
          id: '123',
          version: 3,
          source: 'rules',
          created_at: '2026-07-18T23:00:00.000Z',
          product_rank1: 'vay',
          hook1: 'Gói vay linh hoạt theo dòng tiền',
          explain1: 'Dòng tiền vào ổn định và tỷ lệ nợ phù hợp.',
          product_rank2: 'the',
          hook2: 'Thẻ hoàn tiền cho chi tiêu thường xuyên',
          explain2: 'Tần suất giao dịch cao trong ba tháng gần nhất.',
          rules_applied: ['R1', 'R4'],
          weights_versions: { vay: '2026-07' },
          input_snapshot: { features: { casa_avg: 10_000_000 } },
          input_snapshot_hash: 'hash-demo-123',
        },
        versions: [{ version: 3, created_at: '2026-07-18T23:00:00.000Z', source: 'rules' }],
        staleness: { flag: true, fields: ['casa_avg'] },
      },
    }),
  );
  await page.route('**/api/nba/customer/42/assessment*', (route) =>
    route.fulfill({ json: nbaAssessmentFixture() }),
  );
  await page.route('**/api/nba/audit/recommendation/123', (route) =>
    route.fulfill({
      json: {
        id: '123',
        customer_id: 42,
        version: 3,
        source: 'rules',
        created_at: '2026-07-18T23:00:00.000Z',
        input_snapshot_hash: 'hash-demo-123',
        rules_applied: ['R1', 'R4'],
        feedback: [],
      },
    }),
  );
  await page.route('**/api/nba/notes/42', (route) => route.fulfill({ json: notes }));
  await page.route('**/api/nba/notes', async (route) => {
    const request = route.request();
    const payload = request.postDataJSON() as { customer_id: number; note_text: string };
    notes.unshift({
      id: 8,
      customer_id: payload.customer_id,
      sale_id: 2,
      note_text: payload.note_text,
      created_at: '2026-07-19T02:00:00.000Z',
      sale_name: 'Sale Demo',
    });
    await route.fulfill({ json: { ok: true, noteId: 8 } });
  });
  await page.route('**/api/nba/feedback', (route) =>
    route.fulfill({ json: { ok: true, suppressed: false } }),
  );

  await page.goto('/nba');
  await expect(page.getByRole('heading', { level: 1, name: 'Danh sách gọi NBA' })).toBeVisible();
  await expect(page.getByText('Nguyễn Demo An', { exact: true })).toBeVisible();
  await page.getByText('Nguyễn Demo An', { exact: true }).click();

  await expect(page).toHaveURL(/\/nba\/customers\/42$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Nguyễn Demo An' })).toBeVisible();
  await expect(page.getByText('Gói vay linh hoạt theo dòng tiền', { exact: true })).toBeVisible();
  await expect(page.getByText('Dữ liệu đã thay đổi', { exact: true })).toBeVisible();

  const noteRequest = page.waitForRequest(
    (request) => request.url().endsWith('/api/nba/notes') && request.method() === 'POST',
  );
  await page
    .locator('[data-autoid="forms-textarea-nba-call-note"]')
    .fill('Hẹn gọi lại sáng thứ Hai.');
  await page.locator('[data-autoid="components-button-nba-save-note"]').click();
  expect((await noteRequest).postDataJSON()).toEqual({
    customer_id: 42,
    note_text: 'Hẹn gọi lại sáng thứ Hai.',
  });
  await expect(page.getByText('Đã lưu ghi chú cuộc gọi.', { exact: true })).toBeVisible();

  const feedbackRequest = page.waitForRequest(
    (request) => request.url().endsWith('/api/nba/feedback') && request.method() === 'POST',
  );
  await page
    .locator('[data-autoid="forms-textarea-nba-feedback-note"]')
    .fill('Khách đồng ý nhận tư vấn.');
  await page.locator('[data-autoid="components-button-nba-submit-feedback"]').click();
  expect((await feedbackRequest).postDataJSON()).toEqual({
    rec_id: '123',
    product: 'vay',
    status: 'success',
    note: 'Khách đồng ý nhận tư vấn.',
  });
  await expect(page.getByText('Đã ghi nhận kết quả tư vấn.', { exact: true })).toBeVisible();
});

function nbaAssessmentFixture() {
  const window = {
    from_date: '2026-04-19',
    to_date: '2026-07-19',
    total_in: 120_000_000,
    total_out: 90_000_000,
    net_flow: 30_000_000,
    txn_count: 48,
    txn_per_month: 16,
    max_txn_amount: 20_000_000,
    active_months: 3,
    spend_tags: [{ tag: 'shopping', txn_count: 14 }],
    loans_opened: 0,
    products_opened: 1,
  };

  return {
    customer_id: 42,
    as_of: '2026-07-19',
    current: {
      casa_avg: 12_500_000,
      casa_accounts: 1,
      total_debt: 25_000_000,
      monthly_payment: 2_500_000,
      monthly_income: 20_000_000,
      dti: 0.125,
      has_overdue: false,
      cic_group: 1,
      age: 34,
    },
    window_3m: { ...window, months: 3 },
    window_6m: {
      ...window,
      months: 6,
      from_date: '2026-01-19',
      total_in: 220_000_000,
      total_out: 170_000_000,
      net_flow: 50_000_000,
      txn_count: 88,
      txn_per_month: 14.7,
      active_months: 6,
    },
    trend: { net_flow_pct: 0.2, txn_count_pct: 0.1, total_in_pct: 0.15, direction: 'up' },
    relationship: {
      held_products: [{ product: 'taikhoan', tier: 'standard', since: '2024-01-01' }],
      suppressed: [],
      last_contact_days: 30,
      last_feedback: null,
      note_count: 1,
    },
    customer_blocks: [],
    packages: [
      {
        product: 'vay',
        package: 'Vay linh hoạt',
        tier: 'gold',
        eligible: true,
        criteria: [
          {
            code: 'DTI',
            label: 'Tỷ lệ nợ trên thu nhập',
            passed: true,
            actual: '12.5%',
            required: '< 50%',
            source: 'catalog',
            blocking: true,
          },
        ],
        multiplier: 1,
        blocked_by: [],
      },
    ],
    drift: [],
    explanation: {
      mode: 'rules',
      evidence: ['Dòng tiền vào 3 tháng đạt 120 triệu đồng.'],
      narrative: null,
      degraded_reason: null,
    },
  };
}

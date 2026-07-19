import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, account: 'banker' | 'manager') {
  await page.goto('/assistant');
  await page.getByLabel('Tài khoản demo').fill(account);
  await page.getByLabel('Mật khẩu').fill('12345678');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Hỏi trợ lý nghiệp vụ' })).toBeVisible();
}

test.describe('standalone demo role smoke', () => {
  test('banker can use core workspace and cannot access manager-only areas', async ({ page }) => {
    await login(page, 'banker');

    const navigation = page.getByRole('navigation', { name: 'Điều hướng chính' });
    await expect(navigation.getByRole('link', { name: 'Trợ lý AI' })).toBeVisible();
    await expect(navigation.getByRole('link', { name: 'Tổng quan' })).toBeVisible();
    await expect(navigation.getByRole('link', { name: 'Hồ sơ' })).toBeVisible();
    await expect(navigation.getByRole('link', { name: 'Quản lý' })).toHaveCount(0);
    await expect(navigation.getByRole('link', { name: 'Tri thức' })).toHaveCount(0);

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Trung tâm đánh giá tín dụng' })).toBeVisible();
    await expect(page.getByText('Công ty Cổ phần Sao Mai Demo')).toBeVisible();
    await expect(page.getByText('Công ty TNHH Mây Đỏ Demo')).toBeVisible();

    await page.goto('/cases');
    await expect(page.getByRole('heading', { name: 'Hồ sơ doanh nghiệp' })).toBeVisible();
    await expect(page.getByText('Công ty Minh Phát Demo')).toBeVisible();

    await page.goto('/manager');
    await expect(page.getByRole('heading', { name: 'Chỉ manager được truy cập' })).toBeVisible();
    await page.goto('/knowledge');
    await expect(page.getByRole('heading', { name: 'Không có quyền quản lý tri thức' })).toBeVisible();
  });

  test('banker assistant request is served by the local HPC VLM', async ({ page }) => {
    await login(page, 'banker');
    const replies = page.locator('.assistant-message--assistant');
    await page
      .getByRole('textbox', { name: 'Câu hỏi cho trợ lý' })
      .fill('Theo dữ liệu mô phỏng, hồ sơ vay SME cần kiểm tra những gì?');
    await page.getByRole('button', { name: 'Gửi' }).click();

    await expect(replies).toHaveCount(2, { timeout: 120_000 });
    const latestReply = replies.last();
    await expect(latestReply.getByText('Local VLM')).toBeVisible();
    await expect(latestReply.getByText('Demo fallback')).toHaveCount(0);
    await expect(latestReply.locator('.assistant-answer')).not.toBeEmpty();
    await expect(latestReply.locator('.assistant-evidence-card').first()).toBeVisible();
  });

  test('banker can save the prefilled demo case', async ({ page }) => {
    await login(page, 'banker');
    await page.goto('/cases/new');
    await expect(page.getByRole('heading', { name: 'Tạo hồ sơ đánh giá' })).toBeVisible();
    await page.getByRole('button', { name: 'Lưu hồ sơ demo' }).click();

    await expect(page).not.toHaveURL(/\/cases\/new(?:[/?#]|$)/, { timeout: 15_000 });
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('manager sees human workforce and knowledge demo data', async ({ page }) => {
    await login(page, 'manager');

    const navigation = page.getByRole('navigation', { name: 'Điều hướng chính' });
    await expect(navigation.getByRole('link', { name: 'Quản lý' })).toBeVisible();
    await expect(navigation.getByRole('link', { name: 'Tri thức' })).toBeVisible();

    await page.goto('/manager');
    await expect(page.getByRole('heading', { name: 'Quản lý nhân sự' })).toBeVisible();
    await expect(page.getByText('Nhân sự và hiệu suất hôm nay')).toBeVisible();
    const workforce = page.getByRole('table');
    await expect(workforce).toBeVisible();
    await expect(workforce.getByText('Nguyễn An (Demo)')).toBeVisible();
    await expect(workforce.getByText('Phạm Dũng (Demo)')).toBeVisible();
    await expect(page.locator('#main-content').getByText(/agent/i)).toHaveCount(0);

    await page.goto('/knowledge');
    await expect(page.getByRole('heading', { name: 'Tri thức mô phỏng' })).toBeVisible();
    await expect(page.getByText('Hướng dẫn thẩm định tín dụng doanh nghiệp SME')).toBeVisible();
    await expect(page.getByText('Quy trình KYC và xác minh chủ sở hữu hưởng lợi')).toBeVisible();
  });

  test('server enforces manager API authorization', async ({ request }) => {
    const health = await request.get('/api/health');
    expect(health.status()).toBe(200);
    expect(await health.json()).toMatchObject({
      service: 'startflow-frontend',
      status: 'ok',
    });

    const manager = await request.get('/api/manager/status', {
      headers: { Authorization: 'Bearer demo-manager-token' },
    });
    expect(manager.status()).toBe(200);
    const payload = (await manager.json()) as { staff?: unknown[]; synthetic?: boolean };
    expect(payload.synthetic).toBe(true);
    expect(payload.staff?.length).toBeGreaterThanOrEqual(6);

    const banker = await request.get('/api/manager/status', {
      headers: { Authorization: 'Bearer demo-banker-token' },
    });
    expect(banker.status()).toBe(401);
  });

  test('mobile navigation preserves role visibility and logout', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'manager');

    const managerNavigation = page.getByRole('navigation', { name: 'Điều hướng di động' });
    await expect(managerNavigation.getByRole('link', { name: 'Trợ lý AI' })).toBeVisible();
    await expect(managerNavigation.getByRole('link', { name: 'Quản lý' })).toBeVisible();
    await expect(managerNavigation.getByRole('link', { name: 'Tri thức' })).toBeVisible();
    await managerNavigation.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible();

    await page.getByLabel('Tài khoản demo').fill('banker');
    await page.getByLabel('Mật khẩu').fill('12345678');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    const bankerNavigation = page.getByRole('navigation', { name: 'Điều hướng di động' });
    await expect(bankerNavigation.getByRole('link', { name: 'Hồ sơ' })).toBeVisible();
    await expect(bankerNavigation.getByRole('link', { name: 'Quản lý' })).toHaveCount(0);
    await expect(bankerNavigation.getByRole('link', { name: 'Tri thức' })).toHaveCount(0);
  });
});

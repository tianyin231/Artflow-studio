import { test, expect } from '@playwright/test';

test('download management disables starting a job without authentication', async ({ page }) => {
  await page.route('**/api/auth/status', (route) => route.fulfill({
    json: { data: { isAuthenticated: false, hasToken: false } },
  }));
  await page.goto('/download');
  await expect(page.getByRole('heading', { name: /下载任务管理|Download Task Management/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /启动下载任务|Start Download Task/, exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: /停止当前任务|Stop Current Task/, exact: true })).toBeDisabled();
});

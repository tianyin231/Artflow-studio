import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('root renders the dashboard after redirect', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('.paf-page').getByRole('heading', { name: 'Pixiv Auto Flow' })).toBeVisible();
    await expect(page.getByRole('button', { name: '按当前参数启动', exact: true })).toBeEnabled();
  });

  test('menu navigation opens publishers and returns to dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('menuitem', { name: '发布平台', exact: true }).click();
    await expect(page).toHaveURL(/\/publish-platforms$/);
    await expect(page.getByTestId('platform-bilibili')).toBeVisible();
    await page.getByRole('menuitem', { name: /仪表盘|Dashboard/, exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('button', { name: '按当前参数启动', exact: true })).toBeVisible();
  });
});

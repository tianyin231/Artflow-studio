import { test, expect } from '@playwright/test';

test.describe('Authentication entry points', () => {
  test('legacy login route redirects to accounts and exposes supported methods', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/accounts$/);
    await expect(page.getByTestId('btn-open-auth')).toBeVisible();
    await expect(page.getByTestId('input-refresh-token')).toBeEditable();
    await expect(page.locator('input[type="password"]')).toHaveCount(1);
    await expect(page.getByText('账号密码登录', { exact: true })).toHaveCount(0);
  });

  test('dashboard stays usable while authentication guidance is shown', async ({ page }) => {
    await page.route('**/api/auth/status', (route) => route.fulfill({
      json: { data: { isAuthenticated: false, hasToken: false } },
    }));
    await page.goto('/');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('.paf-page').getByRole('heading', { name: 'Pixiv Auto Flow' })).toBeVisible();
    await expect(page.getByRole('link', { name: /立即登录|Login Now/ })).toBeVisible();
  });
});

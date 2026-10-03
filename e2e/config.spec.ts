import { test, expect } from '@playwright/test';

test('configuration loads and exposes a JSON preview of actual settings', async ({ page }) => {
  await page.goto('/config');
  await expect(page.getByRole('heading', { name: /配置管理|Configuration Management/ })).toBeVisible();
  await page.getByRole('button', { name: /预览配置|Preview Config/, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('textarea')).toHaveValue(/"pixiv"/);
  await expect(dialog.locator('textarea')).toHaveAttribute('readonly', '');
});

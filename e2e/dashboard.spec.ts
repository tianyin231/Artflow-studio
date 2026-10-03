import { test, expect } from '@playwright/test';

test('dashboard exposes editable collection and video parameters', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('.paf-page').getByRole('heading', { name: 'Pixiv Auto Flow' })).toBeVisible();
  await expect(page.getByLabel('目标标签')).toBeEditable();
  await expect(page.getByLabel('抓取数量')).toBeEditable();
  await expect(page.getByRole('checkbox', { name: '只使用本地素材' })).toBeVisible();
  await expect(page.getByRole('button', { name: /按当前参数启动$/ })).toBeEnabled();
});

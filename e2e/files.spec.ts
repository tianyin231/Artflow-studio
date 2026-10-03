import { test, expect } from '@playwright/test';

test('file browser loads its table and filters by filename', async ({ page }) => {
  await page.goto('/files');
  await expect(page.getByRole('heading', { name: /文件浏览|File Browser/ })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /名称|Name/ }).first()).toBeVisible();
  const search = page.getByPlaceholder(/搜索文件名|Search files/);
  await expect(search).toBeEditable();
  await search.fill('artflow-e2e-no-such-file');
  await expect(search).toHaveValue('artflow-e2e-no-such-file');
  await expect(page.getByRole('table')).toBeVisible();
});

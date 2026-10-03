import { test, expect } from '@playwright/test';

test('production routes render their page content without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  for (const [path, heading] of [
    ['/', /^Pixiv Auto Flow$/],
    ['/dashboard', /^Pixiv Auto Flow$/],
    ['/accounts', /账号与连接/],
    ['/publish-platforms', /发布平台/],
    ['/config', /配置管理|Configuration Management/],
    ['/files', /文件浏览|File Browser/],
    ['/logs', /日志查看|Logs/],
  ] as const) {
    await page.goto(path);
    const content = path === '/' || path === '/dashboard' ? page.locator('.paf-page') : page;
    await expect(content.getByRole('heading', { name: heading }).first(), `page content at ${path}`).toBeVisible();
  }
  expect(errors.filter((error) => !/Warning:|deprecated|useForm|favicon/i.test(error))).toEqual([]);
});

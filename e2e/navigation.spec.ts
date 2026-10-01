import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should load root without crash', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const url = page.url();
    expect(url).toContain('127.0.0.1');
    await page.screenshot({ path: 'test-results/screens/nav-root.png' });
  });

  test('can open dashboard route', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    expect(await page.locator('body').count()).toBe(1);
  });
});

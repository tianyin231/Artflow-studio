import { test, expect } from '@playwright/test';

test.describe('smoke', () => {
  test('all routes render non-empty content on production build', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    for (const path of ['/', '/dashboard', '/accounts', '/publish-platforms', '/config', '/files', '/logs']) {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(800);
      const body = await page.locator('body').innerText();
      expect(body.length, `empty body at ${path}`).toBeGreaterThan(10);
      await page.screenshot({ path: `test-results/screens/F2-M1-smoke${path.replace(/\//g, '_') || '_root'}.png` });
    }

    const real = errors.filter(
      (e) => !/Warning:|deprecated|useForm|favicon/i.test(e)
    );
    expect(real, `console errors: ${real.join(' | ')}`).toEqual([]);
  });
});

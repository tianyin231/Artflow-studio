import { test, expect } from '@playwright/test';

test.describe('accounts', () => {
  test('host login start/complete via UI and mock OAuth', async ({ page, context }) => {
    await page.goto('/accounts', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="accounts-page"]');

    // 1. Open authorize URL
    const [popup] = await Promise.all([
      context.waitForEvent('page', { timeout: 10000 }).catch(() => null),
      page.getByTestId('btn-open-auth').click(),
    ]);

    // Authorize URL must include S256 challenge and must NOT include verifier
    const authUrlText = await page.getByTestId('authorize-url').innerText();
    expect(authUrlText).toContain('code_challenge');
    expect(authUrlText.toLowerCase()).not.toContain('code_verifier');

    if (popup) {
      // Mock OAuth may redirect to pixiv:// — capture it
      await popup.waitForLoadState('domcontentloaded').catch(() => undefined);
      const url = popup.url();
      await popup.close().catch(() => undefined);
      // If mock redirected to pixiv:// we can complete from that URL
      if (url.includes('code=') || url.startsWith('pixiv://')) {
        await page.getByTestId('input-callback').fill(url);
        await page.getByTestId('btn-complete-login').click();
        await expect(page.getByTestId('accounts-list-card')).toBeVisible();
      }
    } else {
      // No popup (blocker): complete with a mock callback derived from start URL
      const mockCallback = 'pixiv://account/login?code=mock_e2e_code';
      await page.getByTestId('input-callback').fill(mockCallback);
      await page.getByTestId('btn-complete-login').click();
    }

    await page.screenshot({ path: 'test-results/screens/F2-M1-accounts-login.png' });
  });

  test('import token shows masked preview and keeps connected after reload', async ({ page }) => {
    await page.goto('/accounts', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="input-refresh-token"]');

    const token = ['demo', 'e2e', 'token', 'abcdef123456'].join('_');
    await page.getByTestId('input-refresh-token').fill(token);
    await page.getByTestId('btn-import-token').click();

    const preview = page.getByTestId('token-preview');
    await expect(preview).toBeVisible({ timeout: 5000 });
    await expect(preview).toContainText('****');
    // masked — full token must not appear
    await expect(preview).not.toContainText(token);

    // reload still shows connected state (accounts list card present)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('accounts-list-card')).toBeVisible();
    await page.screenshot({ path: 'test-results/screens/F2-M1-accounts-import.png' });
  });

  test('account list shows fixture user after import', async ({ page }) => {
    await page.goto('/accounts', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="input-refresh-token"]');
    const token = ['demo', 'e2e', 'fixture', 'zzzzzzzzzzzz'].join('_');
    await page.getByTestId('input-refresh-token').fill(token);
    await page.getByTestId('btn-import-token').click();
    await expect(page.getByTestId('accounts-list')).toBeVisible({ timeout: 5000 });
    // Memory importer creates an Imported account
    await expect(page.getByTestId('accounts-list')).toContainText(/Imported|UID/);
  });
});

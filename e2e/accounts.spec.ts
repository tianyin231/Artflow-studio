import { test, expect } from '@playwright/test';
import { apiResponse } from './helpers';

test.describe('Accounts', () => {
  test('PKCE login completes through the UI with mock OAuth', async ({ page, context }) => {
    await page.goto('/accounts');
    await expect(page.getByTestId('accounts-page')).toBeVisible();

    const [response] = await Promise.all([
      apiResponse(page, '/api/auth/login/start'),
      page.getByTestId('btn-open-auth').click(),
    ]);
    expect(response.status()).toBe(200);
    const start = await response.json();
    const authorize = new URL(start.data.authorizeUrl);
    expect(authorize.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorize.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(authorize.searchParams.has('code_verifier')).toBe(false);
    expect(JSON.stringify(start)).not.toContain('codeVerifier');
    await expect(page.getByTestId('authorize-url')).toBeVisible();
    // Opening after an async API call may be blocked; the explicit link is
    // the supported browser fallback and must always open the authorization.
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      page.getByTestId('authorize-link').click(),
    ]);
    if (!popup.isClosed()) await popup.close();

    // Obtain the mock's real redirect; browsers cannot navigate a pixiv:// URL.
    const redirect = await page.request.get(start.data.authorizeUrl, { maxRedirects: 0 });
    expect(redirect.status()).toBe(302);
    const callback = redirect.headers().location;
    expect(callback).toMatch(/^pixiv:\/\/account\/login\?code=/);
    await page.getByTestId('input-callback').fill(callback);
    const [completed] = await Promise.all([
      apiResponse(page, '/api/auth/login/complete'),
      page.getByTestId('btn-complete-login').click(),
    ]);
    expect(completed.status()).toBe(200);
    expect((await completed.json()).data.ok).toBe(true);
    await expect(page.locator('[data-testid^="account-"]').first()).toBeVisible();
  });

  test('import masks the token, clears the input and survives page reload', async ({ page }) => {
    await page.goto('/accounts');
    const token = ['demo', 'e2e', 'token', 'abcdef123456'].join('_');
    await page.getByTestId('input-refresh-token').fill(token);
    const [response] = await Promise.all([
      apiResponse(page, '/api/auth/import-token'),
      page.getByTestId('btn-import-token').click(),
    ]);
    expect(response.status()).toBe(200);
    expect((await response.json()).data.ok).toBe(true);
    await expect(page.getByTestId('token-preview')).toContainText('****');
    await expect(page.getByTestId('token-preview')).not.toContainText(token);
    await expect(page.getByTestId('input-refresh-token')).toHaveValue('');
    const account = page.locator('[data-testid^="account-"]').first();
    await expect(account).toBeVisible();
    const accountId = await account.getAttribute('data-testid');
    expect(accountId).toBeTruthy();
    await page.reload();
    await expect(page.getByTestId(accountId!)).toBeVisible();
    await expect(page.getByTestId('accounts-list')).not.toContainText(token);
  });

  test('empty token submission stays on the form with validation guidance', async ({ page }) => {
    await page.goto('/accounts');
    await page.getByTestId('btn-import-token').click();
    await expect(page.getByText('请粘贴 token', { exact: true })).toBeVisible();
    await expect(page.getByTestId('token-preview')).toHaveCount(0);
  });
});

import { test, expect } from '@playwright/test';
import { publishPackage } from './helpers';

test.describe('Errors and API contracts', () => {
  test('deprecated password login returns 410 with guidance', async ({ request }) => {
    const response = await request.post('/api/auth/login', { data: { username: 'x', password: 'y' } });
    expect(response.status()).toBe(410);
    const body = await response.json();
    expect(body.errorCode).toBe('LOGIN_METHOD_DEPRECATED');
    expect(body.message).toContain('弃用');
  });

  test('login completion succeeds once and rejects session reuse', async ({ request }) => {
    const response = await request.post('/api/auth/login/start');
    expect(response.status()).toBe(200);
    const { data } = await response.json();
    const first = await request.post('/api/auth/login/complete', {
      data: { loginId: data.loginId, callback: 'pixiv://account/login?code=first' },
    });
    expect(first.status()).toBe(200);
    expect((await first.json()).data.ok).toBe(true);
    const replay = await request.post('/api/auth/login/complete', {
      data: { loginId: data.loginId, callback: 'pixiv://account/login?code=second' },
    });
    expect(replay.status()).toBe(400);
    expect((await replay.json()).errorCode).toBe('AUTH_HOST_LOGIN_SESSION_INVALID');
  });

  test('dashboard offers login guidance when backend reports no account', async ({ page }) => {
    await page.route('**/api/auth/status', (route) => route.fulfill({
      json: { data: { isAuthenticated: false, hasToken: false } },
    }));
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: /立即登录|Login Now/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /按当前参数启动$/ })).toBeVisible();
  });

  test('local publish dry-run returns the documented status', async ({ request }) => {
    const response = await request.post('/api/publishers/local-export/dry-run', { data: publishPackage });
    expect(response.status()).toBe(200);
    expect((await response.json()).data.status).toBe('dry_run');
  });

  test('unknown publisher returns 404', async ({ request }) => {
    const response = await request.post('/api/publishers/no-such-platform/dry-run', { data: publishPackage });
    expect(response.status()).toBe(404);
  });
});

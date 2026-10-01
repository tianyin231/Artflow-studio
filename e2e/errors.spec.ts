import { test, expect } from '@playwright/test';

test.describe('errors', () => {
  test('deprecated password login returns 410 with guidance', async ({ request }) => {
    const res = await request.post('http://127.0.0.1:3300/api/auth/login', {
      data: { username: 'x', password: 'y' },
    });
    expect(res.status()).toBe(410);
    const body = await res.json();
    expect(body.errorCode).toBe('LOGIN_METHOD_DEPRECATED');
    expect(body.message).toContain('弃用');
  });

  test('login complete is one-shot and rejects reuse', async ({ request }) => {
    const res = await request.post('http://127.0.0.1:3300/api/auth/login/start');
    expect(res.status()).toBe(200);
    const start = await res.json();
    const loginId = start.data.loginId;

    const first = await request.post('http://127.0.0.1:3300/api/auth/login/complete', {
      data: { loginId, callback: 'pixiv://account/login?code=first' },
    });
    // first complete consumes the session (mock OAuth returns a token)
    expect(first.status()).toBe(200);

    const replay = await request.post('http://127.0.0.1:3300/api/auth/login/complete', {
      data: { loginId, callback: 'pixiv://account/login?code=second' },
    });
    expect(replay.status()).toBe(400);
    const body = await replay.json();
    expect(body.errorCode).toBe('AUTH_HOST_LOGIN_SESSION_INVALID');
  });

  test('UI shows account guidance on dashboard', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(10);
    expect(body).toMatch(/登录|账号|Pixiv|连接|未/i);
    await page.screenshot({ path: 'test-results/screens/F2-M1-errors-guidance.png' });
  });

  test('publish dry-run returns structured result', async ({ request }) => {
    const res = await request.post('http://127.0.0.1:3300/api/publishers/local-export/dry-run', {
      data: {
        taskId: 'e2e-dry',
        videoPath: '',
        coverPath: '',
        title: 't',
        description: 'd',
        tags: [],
        aspectRatio: '16:9',
        durationSec: 1,
        sizeBytes: 1,
        sources: [],
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('dry_run');
  });

  test('unknown publisher returns 404', async ({ request }) => {
    const res = await request.post('http://127.0.0.1:3300/api/publishers/no-such-platform/dry-run', {
      data: { taskId: 'x', videoPath: '', coverPath: '', title: 't', description: 'd', tags: [], aspectRatio: '16:9', durationSec: 1, sizeBytes: 1, sources: [] },
    });
    expect(res.status()).toBe(404);
  });
});

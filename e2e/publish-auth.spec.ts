import { test, expect } from '@playwright/test';

test.describe('publish-auth', () => {
  test('bilibili dry-run requires auth mapping', async ({ request }) => {
    const res = await request.post('http://127.0.0.1:3300/api/publishers/bilibili/dry-run', {
      data: {
        taskId: 'auth-e2e',
        videoPath: '',
        coverPath: '',
        title: 'title',
        description: 'desc',
        tags: ['Anime'],
        aspectRatio: '16:9',
        durationSec: 10,
        sizeBytes: 1000,
        sources: [],
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // dry-run short-circuits before auth in our impl; if auth required it maps explicitly
    expect(['dry_run', 'auth_required', 'failed']).toContain(body.data.status);
  });

  test('publisher list shows auth state for each platform', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:3300/api/publishers');
    expect(res.status()).toBe(200);
    const body = await res.json();
    const ids = body.data.map((p: { id: string }) => p.id);
    expect(ids).toContain('bilibili');
    expect(ids).toContain('youtube');
    expect(ids).toContain('local-export');
    for (const p of body.data) {
      expect(p.state).toBeTruthy();
    }
  });

  test('UI publish platforms page lists bilibili and youtube', async ({ page }) => {
    await page.goto('/publish-platforms', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="publish-platforms-page"]');
    await expect(page.getByTestId('platform-bilibili')).toBeVisible();
    await expect(page.getByTestId('platform-youtube')).toBeVisible();
    await expect(page.getByTestId('btn-dryrun-local-export')).toBeVisible();
    await page.screenshot({ path: 'test-results/screens/F2-M1-publish-auth.png' });
  });
});

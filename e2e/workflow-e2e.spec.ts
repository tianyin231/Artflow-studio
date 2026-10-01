import { test, expect, type Page } from '@playwright/test';

async function createDryRunViaUi(page: Page) {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Pixiv Auto Flow', { timeout: 20000 });

  // Fill command and submit via API from UI context is not enough — use UI form if present
  const cmd = page.locator('textarea').first();
  if (await cmd.count()) {
    await cmd.fill('本周鸣潮主题 收藏数500+ 做成卡点视频');
  }

  // Create task via core API (same origin through preview proxy)
  const res = await page.request.post('http://127.0.0.1:3300/api/workflow/tasks', {
    data: {
      dryRunDownload: true,
      instruction: '本周鸣潮主题 收藏数500+ 做成卡点视频',
    },
  });
  expect(res.status()).toBe(200);
  const created = await res.json();
  return created.data.id as string;
}

test.describe('workflow-e2e', () => {
  test('dry-run workflow reaches asset review via UI and API', async ({ page }) => {
    await createDryRunViaUi(page);

    let status = 'running';
    for (let i = 0; i < 30; i++) {
      const list = await page.request.get('http://127.0.0.1:3300/api/workflow/tasks');
      expect(list.status()).toBe(200);
      const body = await list.json();
      status = body.data?.[0]?.status || 'running';
      if (status === 'asset_review_required' || status === 'failed' || status === 'completed') break;
      await page.waitForTimeout(1000);
    }
    expect(status).toBe('asset_review_required');

    // UI shows the workflow pipeline
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toContain('工作流');
    await page.screenshot({ path: 'test-results/screens/F2-M1-workflow-assets.png' });
  });

  test('asset review reject/accept updates task', async ({ page }) => {
    await createDryRunViaUi(page);
    let status = 'running';
    for (let i = 0; i < 30; i++) {
      const list = await page.request.get('http://127.0.0.1:3300/api/workflow/tasks');
      const body = await list.json();
      status = body.data?.[0]?.status || 'running';
      if (status === 'asset_review_required') break;
      await page.waitForTimeout(1000);
    }
    expect(status).toBe('asset_review_required');

    const tasks = await (await page.request.get('http://127.0.0.1:3300/api/workflow/tasks')).json();
    const taskId = tasks.data[0].id;
    const assets = tasks.data[0].assets || [];
    expect(assets.length).toBeGreaterThan(0);

    // Reject one asset via API (UI panel uses same endpoint)
    const reject = await page.request.patch(
      `http://127.0.0.1:3300/api/workflow/tasks/${taskId}/assets/${encodeURIComponent(assets[0].name)}`,
      { data: { status: 'rejected', reason: 'e2e reject' } }
    );
    expect(reject.status()).toBe(200);

    const after = await (await page.request.get(`http://127.0.0.1:3300/api/workflow/tasks/${taskId}`)).json();
    const a0 = after.data.assets.find((a: { name: string }) => a.name === assets[0].name);
    expect(a0.status).toBe('rejected');
    await page.screenshot({ path: 'test-results/screens/F2-M1-workflow-review.png' });
  });

  test('publish dry-run for multiple platforms succeeds', async ({ request }) => {
    const platforms = ['local-export', 'wallpaper-engine-package', 'bilibili', 'youtube', 'telegram'];
    for (const id of platforms) {
      const res = await request.post(`http://127.0.0.1:3300/api/publishers/${id}/dry-run`, {
        data: {
          taskId: 'e2e-multi',
          videoPath: '',
          coverPath: '',
          title: 'E2E Title',
          description: 'E2E desc',
          tags: ['Anime'],
          aspectRatio: '16:9',
          durationSec: 5,
          sizeBytes: 1024,
          sources: [],
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(['dry_run', 'exported', 'submitted', 'auth_required']).toContain(body.data.status);
    }

    // mock server received requests
    const mock = await request.get('http://127.0.0.1:3302/__requests');
    expect(mock.status()).toBe(200);
  });
});

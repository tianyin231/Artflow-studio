import { test, expect } from '@playwright/test';
import { apiResponse, publishPackage } from './helpers';

test.describe('Publisher authentication and dry-run', () => {
  test('Bilibili dry-run validates the package without requiring a live account', async ({ request }) => {
    const response = await request.post('/api/publishers/bilibili/dry-run', { data: publishPackage });
    expect(response.status()).toBe(200);
    expect((await response.json()).data.status).toBe('dry_run');
  });

  test('publisher list exposes a documented auth state for every platform', async ({ request }) => {
    const response = await request.get('/api/publishers');
    expect(response.status()).toBe(200);
    const { data } = await response.json();
    expect(data.map((publisher: { id: string }) => publisher.id)).toEqual(expect.arrayContaining(['bilibili', 'youtube', 'local-export']));
    for (const publisher of data) expect(['not_configured', 'ok', 'expired', 'error']).toContain(publisher.state);
    expect(data.find((publisher: { id: string }) => publisher.id === 'local-export').state).toBe('ok');
  });

  test('publisher page runs a local dry-run through the UI', async ({ page }) => {
    await page.goto('/publish-platforms');
    await expect(page.getByTestId('platform-bilibili')).toBeVisible();
    await expect(page.getByTestId('platform-youtube')).toBeVisible();
    const [response] = await Promise.all([
      apiResponse(page, '/api/publishers/local-export/dry-run'),
      page.getByTestId('btn-dryrun-local-export').click(),
    ]);
    expect(response.status()).toBe(200);
    expect((await response.json()).data.status).toBe('dry_run');
    await expect(page.getByTestId('dry-run-result')).toContainText('local-export dry-run: dry_run');
  });
});

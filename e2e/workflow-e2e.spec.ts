import { test, expect, type Page } from '@playwright/test';
import { apiResponse, getTask, mockBaseURL, publishPackage } from './helpers';

async function createDryRunViaUi(page: Page) {
  await page.goto('/dashboard');
  await expect(page.locator('.paf-page').getByRole('heading', { name: 'Pixiv Auto Flow' })).toBeVisible();
  await page.getByPlaceholder('可输入：本周鸣潮 收藏数500+ 卡点视频。也可以留空，只用表单启动。').fill('fixture Artflow E2E');
  await page.getByLabel('目标标签').fill('fixture');
  await page.getByLabel('抓取数量').fill('3');
  await page.getByLabel('收藏阈值', { exact: true }).fill('0');
  await page.getByRole('checkbox', { name: '只使用本地素材' }).check();
  const [response] = await Promise.all([
    apiResponse(page, '/api/workflow/tasks'),
    page.getByRole('button', { name: /按当前参数启动$/ }).click(),
  ]);
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({
    command: 'fixture Artflow E2E', dryRunDownload: true,
    pixivOverrides: { tag: 'fixture', limit: 3, minBookmarks: 0 },
  });
  const { data } = await response.json();
  expect(data.id).toEqual(expect.any(String));
  await expect.poll(async () => (await getTask(page.request, data.id)).status, {
    timeout: 30000, intervals: [200, 500, 1000],
  }).toBe('asset_review_required');
  await expect(page.getByText(`任务 ${data.id}`, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '展开审核', exact: true })).toBeVisible();
  return data.id as string;
}

test.describe('Workflow', () => {
  test('dashboard form creates the requested task and displays asset review', async ({ page }) => {
    const id = await createDryRunViaUi(page);
    const task = await getTask(page.request, id);
    expect(task.assets.length).toBeGreaterThan(0);
    expect(task.status).toBe('asset_review_required');
    await expect(page.getByRole('button', { name: '按当前选择继续', exact: true }).first()).toBeEnabled();
  });

  test('asset reject and accept in the UI persist on the created task', async ({ page }) => {
    const id = await createDryRunViaUi(page);
    const task = await getTask(page.request, id);
    const asset = task.assets[0];
    expect(asset.name).toEqual(expect.any(String));
    await page.getByRole('button', { name: '展开审核', exact: true }).click();
    const card = page.locator('.dashboard-asset-card').filter({ has: page.getByText(asset.name, { exact: true }) });
    await expect(card).toBeVisible();
    const assetPath = `/api/workflow/tasks/${id}/assets/${encodeURIComponent(asset.name)}`;
    const [rejected] = await Promise.all([
      apiResponse(page, assetPath, 'PATCH'),
      card.getByRole('button', { name: /^剔\s*除$/ }).click(),
    ]);
    expect(rejected.status()).toBe(200);
    expect((await getTask(page.request, id)).assets.find((item: { name: string }) => item.name === asset.name).status).toBe('rejected');
    await expect(card.getByRole('button', { name: /^剔\s*除$/ })).toBeDisabled();

    const [accepted] = await Promise.all([
      apiResponse(page, assetPath, 'PATCH'),
      card.getByRole('button', { name: /^通\s*过$/ }).click(),
    ]);
    expect(accepted.status()).toBe(200);
    expect((await getTask(page.request, id)).assets.find((item: { name: string }) => item.name === asset.name).status).toBe('accepted');
    await expect(card.getByRole('button', { name: /^通\s*过$/ })).toBeDisabled();
  });

  test('platform dry-runs return dry_run without issuing publisher network requests', async ({ request }) => {
    const before = await request.get(`${mockBaseURL}/__requests`);
    expect(before.status()).toBe(200);
    const prior = (await before.json()).requests.length;
    for (const id of ['local-export', 'wallpaper-engine-package', 'bilibili', 'youtube', 'telegram']) {
      const response = await request.post(`/api/publishers/${id}/dry-run`, { data: publishPackage });
      expect(response.status()).toBe(200);
      const { data } = await response.json();
      expect(data.status, `${id}: ${data.message || ''}`).toBe('dry_run');
    }
    const after = await request.get(`${mockBaseURL}/__requests`);
    expect(after.status()).toBe(200);
    const calls = (await after.json()).requests.slice(prior);
    expect(calls.filter((call: { method: string }) => call.method !== 'GET' && call.method !== 'HEAD')).toEqual([]);
  });
});

import { test, expect } from '@playwright/test';

test.use({
  timezoneId: 'America/Los_Angeles',
  viewport: { width: 1440, height: 1000 },
});

// These pages intentionally manage browser-local drafts. Keep the surrounding
// shell deterministic without pretending there are execution APIs for them.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/status', (route) =>
    route.fulfill({
      json: { success: true, data: { isAuthenticated: true } },
    })
  );
  await page.route('**/api/workflow/tasks', (route) =>
    route.fulfill({ json: { success: true, data: [] } })
  );
});

test('template edits, switching, and copies survive reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/templates');
  await page.getByTestId('btn-edit-wuthering-weekly').click();
  await expect(page.locator('.react-flow__node')).toHaveCount(7);
  const firstNode = page.locator('.react-flow__node[data-id="n0"]');
  await firstNode.scrollIntoViewIfNeeded();
  const box = await firstNode.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error('The editor node has no rendered geometry');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50, { steps: 8 });
  await page.mouse.up();
  await page.getByTestId('btn-save-template').click();
  const position = await page.evaluate(() => {
    const templates = JSON.parse(localStorage.getItem('artflow-template-library-v1') || '[]');
    return templates.find((t: { id: string }) => t.id === 'wuthering-weekly').graph.nodes[0]
      .position;
  });
  expect(position).not.toEqual({ x: 80, y: 80 });
  await page.reload();
  await page.getByTestId('btn-edit-wuthering-weekly').click();
  const transform = await firstNode.evaluate((node) => (node as HTMLElement).style.transform);
  const coordinates = transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/);
  expect(Number(coordinates?.[1])).toBeCloseTo(position.x, 2);
  expect(Number(coordinates?.[2])).toBeCloseTo(position.y, 2);
  await page.getByTestId('btn-edit-miku-soft').click();
  await expect(page.locator('.react-flow__node')).toHaveCount(4);
  await page.getByTestId('btn-save-template').click();
  expect(
    JSON.parse((await page.getByTestId('saved-template-json').textContent()) || '{}')
  ).toMatchObject({ id: 'miku-soft', name: '初音柔和图集' });
  await page.getByTestId('template-miku-soft').getByRole('button', { name: '复制' }).click();
  await expect(page.getByText('初音柔和图集（副本）', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('初音柔和图集（副本）', { exact: true })).toBeVisible();
  await expect(
    page.getByTestId('template-miku-soft').getByRole('button', { name: '运行' })
  ).toBeDisabled();
  expect(errors).toEqual([]);
});

test('calendar uses Shanghai time and persists cancellation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/calendar');
  await expect(page.getByText('2026-10-02 20:00:00', { exact: true })).toBeVisible();
  const picker = page.getByRole('textbox', { name: '排期时间（Asia/Shanghai）' });
  await picker.fill('2026-10-04 20:00:00');
  await picker.press('Enter');
  await page.getByTestId('btn-new-schedule').click();
  const scheduled = await page.evaluate(() => {
    const items = JSON.parse(localStorage.getItem('artflow-publish-calendar-v1') || '[]');
    return items.find((item: { platform: string }) => item.platform === 'local-export');
  });
  expect(scheduled.isoTime).toBe('2026-10-04T12:00:00.000Z');
  await page.getByTestId('btn-cancel-1').click();
  await page.reload();
  await expect(page.getByTestId('btn-cancel-1')).toBeDisabled();
  await expect(page.getByTestId('btn-cancel-3')).toBeDisabled();
  await expect(page.getByText('2026-10-04 20:00:00', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('plugin preferences survive a full page reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/plugins');
  const toggle = page.getByTestId('toggle-publisher-s3');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect(errors).toEqual([]);
});

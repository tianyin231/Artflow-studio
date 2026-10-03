import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const mockBaseURL = process.env.ARTFLOW_E2E_MOCK_URL
  || `http://127.0.0.1:${process.env.ARTFLOW_E2E_MOCK_PORT || '3302'}`;

export const publishPackage = {
  taskId: 'e2e-dry-run',
  videoPath: '/fixture/video.mp4',
  coverPath: '/fixture/cover.jpg',
  title: 'Artflow E2E',
  description: 'Fixture publish validation',
  tags: ['Anime'],
  aspectRatio: '16:9',
  durationSec: 5,
  sizeBytes: 1024,
  sources: [{ pixivId: '1001', author: 'Fixture User', url: 'https://www.pixiv.net/artworks/1001' }],
  extras: { tid: 17 },
};

export function apiResponse(page: Page, path: string, method = 'POST') {
  return page.waitForResponse((response) =>
    new URL(response.url()).pathname === path && response.request().method() === method);
}

export async function getTask(request: APIRequestContext, id: string) {
  const response = await request.get(`/api/workflow/tasks/${encodeURIComponent(id)}`);
  expect(response.status()).toBe(200);
  const { data } = await response.json();
  expect(data.id).toBe(id);
  return data;
}

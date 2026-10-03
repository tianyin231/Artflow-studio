import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const core = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/api/auth/accounts') res.end(JSON.stringify({ data: [] }));
  else if (req.url === '/api/auth/status') res.end(JSON.stringify({ data: { authenticated: false } }));
  else res.end(JSON.stringify({ data: {} }));
});
await new Promise((resolve) => core.listen(0, '127.0.0.1', resolve));
let server;
let browser;
try {
  const target = `http://127.0.0.1:${core.address().port}`;
  server = await preview({
    root,
    preview: {
      host: '127.0.0.1', port: 0,
      proxy: { '/api': { target }, '/socket.io': { target } },
    },
  });
  const url = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${url}/accounts`);
  await page.getByTestId('accounts-title').waitFor();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }
  });
  const online = await page.evaluate(async () => (await fetch('/api/auth/accounts')).json());
  assert.deepEqual(online, { data: [] });
  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  assert.deepEqual(installabilityErrors, []);
  const cached = await page.evaluate(async () => {
    const requests = (await Promise.all((await caches.keys()).map(async (name) =>
      (await (await caches.open(name)).keys()).map((request) => request.url)))).flat();
    return requests;
  });
  assert(cached.some((entry) => entry.includes('/icons/artflow-192.png')));
  assert(cached.some((entry) => entry.includes('/icons/artflow-512.png')));
  assert(cached.some((entry) => entry.includes('/vendor/antd.esm.js')));
  assert(!cached.some((entry) => new URL(entry).pathname.startsWith('/api/')));

  await context.setOffline(true);
  await page.reload();
  await page.getByTestId('accounts-title').waitFor();
  // An unvisited SPA route and its lazy chunk must also be available offline.
  await page.goto(`${url}/publish-platforms`);
  await page.getByTestId('publish-platforms-page').waitFor({ timeout: 15000 }).catch(async () => {
    throw new Error(`Offline route failed: ${errors.join('; ')}; online=${await page.evaluate(() => navigator.onLine)}; body=${(await page.locator('body').innerHTML()).slice(0, 1500)}`);
  });
  const offlineApi = await page.evaluate(async () => {
    try { await fetch('/api/auth/accounts'); return 'served'; } catch { return 'unavailable'; }
  });
  assert.equal(offlineApi, 'unavailable');
  for (const backendRoute of ['/api/auth/accounts', '/socket.io/']) {
    const probe = await context.newPage();
    await assert.rejects(probe.goto(`${url}${backendRoute}`));
    await probe.close();
  }
  assert.deepEqual(errors, []);
  console.log('PWA smoke OK: install icons, precache, offline reload and lazy routes; API/socket requests remain unavailable offline');
} finally {
  await browser?.close();
  if (server) await new Promise((resolve) => server.httpServer.close(resolve));
  await new Promise((resolve) => core.close(resolve));
}

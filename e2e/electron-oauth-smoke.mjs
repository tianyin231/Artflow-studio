import { _electron as electron } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exe = process.env.ARTFLOW_ELECTRON_EXE || path.join(__dirname, '..', 'dist_electron', 'linux-unpacked', 'artflow');

const requests = [];
const mock = http.createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  if (req.url === '/api/auth/login/start') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ data: {
      loginId: 'mock-login', authorizeUrl: `http://127.0.0.1:${mock.address().port}/authorize`,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    } }));
    return;
  }
  if (req.url === '/api/auth/login/complete') {
    requests.push(JSON.parse(body));
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ data: { ok: true } }));
    return;
  }
  if (req.url === '/api/auth/status') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ data: { authenticated: true } }));
    return;
  }
  if (req.url === '/api/auth/accounts') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ data: [] }));
    return;
  }
  if (req.url === '/api/workflow/tasks' || req.url === '/api/command-presets') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ data: [] }));
    return;
  }
  if (req.url?.startsWith('/authorize')) {
    res.writeHead(302, {
      Location: 'pixiv://account/login?code=MOCK_E2E_CODE&state=s',
    });
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ data: {} }));
});
await new Promise((r) => mock.listen(0, '127.0.0.1', r));
const port = mock.address().port;

let app;
try {
  app = await electron.launch({
    executablePath: exe,
    args: ['--no-sandbox', '--disable-gpu'],
    env: {
      ...process.env, ARTFLOW_E2E_BASE_URL: '',
      ARTFLOW_CORE_URL: `http://127.0.0.1:${port}`,
    },
  });
  const win = await app.firstWindow();
  const pageErrors = [];
  win.on('pageerror', (error) => pageErrors.push(error.message));
  await win.waitForLoadState('domcontentloaded');
  await win.evaluate(() => { window.location.href = '/accounts'; });
  await win.getByTestId('accounts-title').waitFor({ timeout: 15000 }).catch(async () => {
    throw new Error(`Accounts failed to load: ${pageErrors.join('; ')}; online=${await win.evaluate(() => navigator.onLine)}; body=${(await win.locator('body').innerText()).slice(0, 500)}`);
  });
  await win.getByTestId('btn-open-auth').click();
  await win.waitForFunction(() => document.body.innerText.includes('登录完成'));
  assert.deepEqual(requests, [{
    loginId: 'mock-login', callback: 'pixiv://account/login?code=MOCK_E2E_CODE&state=s',
  }]);
  assert.equal(await win.getByTestId('btn-complete-login').isDisabled(), true);
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
  console.log('electron OAuth smoke OK: actual Accounts button, capture and Core completion contract');
} finally {
  await app?.close();
  await new Promise((resolve) => mock.close(resolve));
}

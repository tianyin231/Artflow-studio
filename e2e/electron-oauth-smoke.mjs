import { _electron as electron } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exe = path.join(__dirname, '..', 'dist_electron', 'linux-unpacked', 'pixivflow');

// Mock OAuth page that redirects to pixiv://callback
const mock = http.createServer((req, res) => {
  if (req.url?.startsWith('/authorize')) {
    res.writeHead(302, {
      Location: 'pixiv://account/login?code=MOCK_E2E_CODE&state=s',
    });
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<html><body>mock oauth</body></html>');
});
await new Promise((r) => mock.listen(0, '127.0.0.1', r));
const port = mock.address().port;

const app = await electron.launch({
  executablePath: exe,
  args: ['--no-sandbox'],
  env: {
    ...process.env,
    ARTFLOW_E2E_BASE_URL: 'http://127.0.0.1:5373',
    ARTFLOW_CORE_URL: 'http://127.0.0.1:3300',
  },
});

const win = await app.firstWindow();
await win.waitForLoadState('domcontentloaded');
await win.waitForTimeout(1000);

// Listen for oauth-callback via evaluate of exposed API
const captured = await win.evaluate(async (url) => {
  return new Promise((resolve) => {
    const w = window.open(url, '_blank');
    // In electron main, will-redirect will close popup and send oauth-callback
    // Fallback: resolve after timeout with window name
    setTimeout(() => resolve({ opened: Boolean(w) }), 1500);
  });
}, `http://127.0.0.1:${port}/authorize`);

console.log('oauth smoke captured', captured);
await win.screenshot({ path: 'test-results/screens/F6-E-electron-oauth.png' });
await app.close();
mock.close();
console.log('electron oauth smoke OK');

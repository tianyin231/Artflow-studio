import { _electron as electron } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exe = path.join(__dirname, '..', 'dist_electron', 'linux-unpacked', 'pixivflow');
const app = await electron.launch({
  executablePath: exe,
  args: ['--no-sandbox'],
  env: { ...process.env, ARTFLOW_E2E_BASE_URL: 'http://127.0.0.1:5373' },
});
const win = await app.firstWindow();
await win.waitForLoadState('domcontentloaded');
await win.waitForTimeout(2000);
const body = await win.locator('body').innerText().catch(() => '');
console.log('electron bodyLen', body.length);
console.log('electron sample', body.slice(0, 80).replace(/\n/g, ' | '));
await win.screenshot({ path: 'test-results/screens/F5-B-electron.png' });
await app.close();
console.log('electron smoke OK');

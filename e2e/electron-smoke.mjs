import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exe = process.env.ARTFLOW_ELECTRON_EXE || path.join(__dirname, '..', 'dist_electron', 'linux-unpacked', 'artflow');
const app = await electron.launch({
  executablePath: exe,
  args: ['--no-sandbox', '--disable-gpu'],
  env: { ...process.env, ARTFLOW_E2E_BASE_URL: '' },
});
const win = await app.firstWindow();
await win.waitForLoadState('domcontentloaded');
try {
  await win.waitForFunction(() => document.querySelector('#root')?.childElementCount > 0);
  assert.notEqual(new URL(win.url()).port, '5373');
  assert.equal(await win.evaluate(() => window.artflow.invoke('app.getVersion')), '1.0.0');
  assert.equal(await win.evaluate(() => typeof window.require), 'undefined');
  await assert.rejects(win.evaluate(() => window.artflow.invoke('fs.readFile')));
  const preferences = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  assert.equal(preferences.contextIsolation, true);
  assert.equal(preferences.sandbox, true);
  assert.equal(preferences.nodeIntegration, false);
  console.log('electron smoke OK: packaged assets and isolated allowlisted bridge');
} finally {
  await app.close();
}

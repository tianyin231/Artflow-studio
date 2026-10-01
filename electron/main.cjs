/**
 * Electron main (F2-M4) — opens studio URL, captures pixiv:// OAuth.
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const { fork } = require('node:child_process');
const path = require('node:path');

const SECURITY = {
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  preloadAllowlist: ['auth.startLogin', 'auth.completeLogin', 'auth.importToken', 'app.getVersion'],
};

let coreProc = null;
let mainWindow = null;

function startCoreIfRequested() {
  if (process.env.ARTFLOW_FORK_CORE !== '1') return;
  const coreEntry = process.env.ARTFLOW_CORE_ENTRY
    || path.join(__dirname, '..', '..', 'Artflow-core', 'dist', 'webui', 'index.js');
  try {
    coreProc = fork(coreEntry, [], {
      env: { ...process.env, HOST: '127.0.0.1', PORT: process.env.PORT || '3300' },
      stdio: 'inherit',
    });
  } catch (e) {
    console.error('[electron] core fork failed', e.message);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: true,
    webPreferences: {
      contextIsolation: SECURITY.contextIsolation,
      sandbox: SECURITY.sandbox,
      nodeIntegration: SECURITY.nodeIntegration,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  const url = process.env.ARTFLOW_E2E_BASE_URL || 'http://127.0.0.1:5373';
  mainWindow.loadURL(url).catch((e) => console.error('[electron] loadURL', e.message));
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[electron] window loaded', url);
  });
}

function openOAuth(authorizeUrl) {
  const win = new BrowserWindow({
    width: 480,
    height: 720,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  const capture = (_e, next) => {
    if (typeof next === 'string' && (next.startsWith('pixiv://') || next.includes('code='))) {
      win.close();
      mainWindow?.webContents.send('oauth-callback', next);
    }
  };
  win.webContents.on('will-redirect', capture);
  win.webContents.on('will-navigate', capture);
  win.loadURL(authorizeUrl).catch(() => undefined);
  return win;
}

ipcMain.handle('auth.startLogin', async () => {
  const base = process.env.ARTFLOW_CORE_URL || 'http://127.0.0.1:3300';
  const res = await fetch(`${base}/api/auth/login/start`, { method: 'POST' });
  const body = await res.json();
  const url = body?.data?.authorizeUrl;
  if (url) openOAuth(url);
  return body;
});

ipcMain.handle('auth.completeLogin', async (_e, payload) => {
  const base = process.env.ARTFLOW_CORE_URL || 'http://127.0.0.1:3300';
  const res = await fetch(`${base}/api/auth/login/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
});

app.whenReady().then(() => {
  startCoreIfRequested();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (coreProc && !coreProc.killed) {
    try { coreProc.kill(); } catch { /* ignore */ }
  }
  app.quit();
});

module.exports = { openOAuth, SECURITY };

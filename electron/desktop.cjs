const path = require('node:path');
const { fork } = require('node:child_process');
const { startStudioServer } = require('./studio-server.cjs');

const SECURITY = Object.freeze({
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  preloadAllowlist: Object.freeze([
    'auth.startLogin', 'auth.completeLogin', 'auth.importToken', 'app.getVersion',
  ]),
});

function isWebUrl(value) {
  try {
    const url = new URL(value);
    return !url.username && !url.password &&
      (url.protocol === 'https:' || (url.protocol === 'http:' &&
        ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)));
  } catch {
    return false;
  }
}

function isPixivCallback(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'pixiv:' && url.hostname === 'account' &&
      url.pathname === '/login' && !url.username && !url.password && !url.port &&
      url.searchParams.getAll('code').length === 1 && Boolean(url.searchParams.get('code'));
  } catch {
    return false;
  }
}

function createDesktop(electron, options = {}) {
  const { app, BrowserWindow, ipcMain, shell } = electron;
  const env = options.env || process.env;
  const request = options.fetch || globalThis.fetch;
  const forkCore = options.fork || fork;
  const serveStudio = options.startStudioServer || startStudioServer;
  const coreUrl = env.ARTFLOW_CORE_URL || `http://127.0.0.1:${env.PORT || '3300'}`;
  if (!isWebUrl(coreUrl)) throw new Error('ARTFLOW_CORE_URL must use HTTPS or loopback HTTP');

  let coreProc;
  let studioServer;
  let studioUrl;
  let mainWindow;
  let oauthWindow;
  let activeLoginId;

  function assertTrustedSender(event) {
    const contents = mainWindow?.webContents;
    if (!contents || event.sender !== contents || event.senderFrame !== contents.mainFrame ||
      new URL(event.senderFrame.url).origin !== new URL(studioUrl).origin) {
      throw new Error('Untrusted IPC sender');
    }
  }

  async function postCore(route, payload) {
    const response = await request(new URL(`/api/auth/${route}`, coreUrl).href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      signal: AbortSignal.timeout(30_000),
    });
    let body;
    try { body = await response.json(); } catch { /* Non-JSON failures use the status. */ }
    if (!response.ok) {
      const detail = [body?.message, body?.error].find((value) => typeof value === 'string' && value);
      throw new Error(detail || `Core request failed (${response.status})`);
    }
    if (!body) throw new Error('Invalid Core response');
    return body;
  }

  function openOAuth(authorizeUrl, loginId) {
    if (!isWebUrl(authorizeUrl)) throw new Error('Invalid authorization URL');
    oauthWindow?.close();
    const win = new BrowserWindow({
      width: 480,
      height: 720,
      parent: mainWindow,
      webPreferences: {
        contextIsolation: SECURITY.contextIsolation,
        sandbox: SECURITY.sandbox,
        nodeIntegration: SECURITY.nodeIntegration,
        partition: 'persist:artflow-oauth',
      },
    });
    oauthWindow = win;
    activeLoginId = loginId;
    win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    win.webContents.session.setPermissionCheckHandler(() => false);
    let captured = false;
    const capture = (event, next) => {
      if (isPixivCallback(next)) {
        event.preventDefault();
        if (captured || activeLoginId !== loginId) return;
        captured = true;
        win.close();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('oauth-callback', { loginId, callback: next });
        }
      } else if (!isWebUrl(next)) {
        event.preventDefault();
      }
    };
    win.webContents.on('will-redirect', capture);
    win.webContents.on('will-navigate', capture);
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.on('closed', () => {
      if (oauthWindow === win) oauthWindow = undefined;
    });
    win.loadURL(authorizeUrl).catch(() => console.error('[electron] authorization page failed to load'));
    return win;
  }

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      webPreferences: {
        contextIsolation: SECURITY.contextIsolation,
        sandbox: SECURITY.sandbox,
        nodeIntegration: SECURITY.nodeIntegration,
        preload: path.join(__dirname, 'preload.cjs'),
      },
    });
    const contents = mainWindow.webContents;
    const restrictNavigation = (event, target) => {
      try {
        if (new URL(target).origin === new URL(studioUrl).origin) return;
      } catch { /* Block invalid URLs too. */ }
      event.preventDefault();
    };
    contents.on('will-navigate', restrictNavigation);
    contents.on('will-redirect', restrictNavigation);
    contents.on('will-attach-webview', (event) => event.preventDefault());
    contents.setWindowOpenHandler(({ url }) => {
      if (isWebUrl(url)) shell.openExternal(url).catch(() => undefined);
      return { action: 'deny' };
    });
    contents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    contents.session.setPermissionCheckHandler(() => false);
    mainWindow.on('closed', () => {
      oauthWindow?.close();
      mainWindow = undefined;
    });
    mainWindow.loadURL(studioUrl).catch(() => console.error('[electron] Studio failed to load'));
    return mainWindow;
  }

  ipcMain.handle('auth.startLogin', async (event) => {
    assertTrustedSender(event);
    const body = await postCore('login/start');
    const data = body?.data;
    if (!data || typeof data.loginId !== 'string' || !data.loginId || !isWebUrl(data.authorizeUrl)) {
      throw new Error('Invalid login session response');
    }
    openOAuth(data.authorizeUrl, data.loginId);
    return body;
  });

  ipcMain.handle('auth.completeLogin', async (event, payload) => {
    assertTrustedSender(event);
    if (!payload || typeof payload.loginId !== 'string' || payload.loginId !== activeLoginId ||
      typeof payload.callback !== 'string' || !payload.callback.trim() || payload.callback.length > 4096) {
      throw new Error('Invalid login callback');
    }
    // Core consumes each PKCE session before exchange, including failed exchanges.
    activeLoginId = undefined;
    oauthWindow?.close();
    return postCore('login/complete', {
      loginId: payload.loginId, callback: payload.callback.trim(),
    });
  });

  ipcMain.handle('auth.importToken', async (event, payload) => {
    assertTrustedSender(event);
    if (!payload || typeof payload.refreshToken !== 'string' || !payload.refreshToken.trim() ||
      payload.refreshToken.length > 16384) throw new Error('Refresh token required');
    return postCore('import-token', { refreshToken: payload.refreshToken.trim() });
  });

  ipcMain.handle('app.getVersion', (event) => {
    assertTrustedSender(event);
    return app.getVersion();
  });

  const ready = app.whenReady().then(async () => {
    if (env.ARTFLOW_FORK_CORE === '1') {
      const coreEntry = env.ARTFLOW_CORE_ENTRY ||
        path.join(app.getAppPath(), '..', 'Artflow-core', 'dist', 'webui', 'index.js');
      const port = new URL(coreUrl).port || '3300';
      coreProc = forkCore(coreEntry, [], {
        env: { ...env, ELECTRON_RUN_AS_NODE: '1', HOST: '127.0.0.1', PORT: port },
        stdio: 'inherit',
      });
      coreProc.on('error', () => console.error('[electron] core process failed to start'));
    }
    if (env.ARTFLOW_E2E_BASE_URL) {
      if (!isWebUrl(env.ARTFLOW_E2E_BASE_URL)) throw new Error('Invalid Studio URL');
      studioUrl = env.ARTFLOW_E2E_BASE_URL;
    } else if (app.isPackaged) {
      studioServer = await serveStudio(path.join(app.getAppPath(), 'dist'), coreUrl);
      studioUrl = studioServer.url;
    } else {
      studioUrl = 'http://127.0.0.1:5373';
    }
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  ready.catch(() => {
    console.error('[electron] desktop startup failed');
    app.quit();
  });

  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => {
    oauthWindow?.close();
    studioServer?.server.close();
    if (coreProc && !coreProc.killed) coreProc.kill();
  });

  return { ready };
}

module.exports = { createDesktop, SECURITY, isPixivCallback };

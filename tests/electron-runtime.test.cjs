const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createDesktop, SECURITY } = require('../electron/desktop.cjs');

async function desktop(options = {}) {
  const windows = [];
  const handlers = new Map();
  const calls = [];
  const external = [];
  class BrowserWindow extends EventEmitter {
    static getAllWindows() { return windows.filter((win) => !win.closed); }
    constructor(config) {
      super();
      this.config = config;
      this.webContents = new EventEmitter();
      this.webContents.mainFrame = { url: '' };
      this.webContents.send = (...args) => calls.push(args);
      this.webContents.setWindowOpenHandler = (handler) => { this.openHandler = handler; };
      this.webContents.session = {
        setPermissionRequestHandler: () => {}, setPermissionCheckHandler: () => {},
      };
      windows.push(this);
    }
    loadURL(url) { this.url = url; this.webContents.mainFrame.url = url; return Promise.resolve(); }
    close() { this.closed = true; this.emit('closed'); }
    isDestroyed() { return Boolean(this.closed); }
  }
  const app = Object.assign(new EventEmitter(), {
    isPackaged: false,
    whenReady: () => Promise.resolve(),
    getAppPath: () => '/app',
    getVersion: () => '1.0.0',
    quit: () => app.emit('before-quit'),
    ...options.app,
  });
  const requests = [];
  const runtime = createDesktop({
    app, BrowserWindow,
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    shell: { openExternal: async (url) => external.push(url) },
  }, {
    env: { ARTFLOW_E2E_BASE_URL: 'http://127.0.0.1:5373' },
    fetch: async (...args) => {
      requests.push(args);
      return { ok: true, json: async () => ({ data: {
        loginId: 'login-1', authorizeUrl: 'https://app-api.pixiv.net/web/v1/login',
      } }) };
    },
    ...options,
  });
  await runtime.ready;
  const main = windows[0];
  const event = { sender: main.webContents, senderFrame: main.webContents.mainFrame };
  return { app, windows, main, handlers, event, calls, requests, external };
}

test('the actual desktop window is sandboxed and every exposed IPC channel has a handler', async () => {
  const { main, handlers, event } = await desktop();
  assert.equal(main.config.webPreferences.contextIsolation, true);
  assert.equal(main.config.webPreferences.sandbox, true);
  assert.equal(main.config.webPreferences.nodeIntegration, false);
  assert.match(main.config.webPreferences.preload, /preload\.cjs$/);
  assert.deepEqual([...handlers.keys()], SECURITY.preloadAllowlist);
  assert.equal(handlers.get('app.getVersion')(event), '1.0.0');
});

test('main navigation and popups cannot load foreign content with the preload', async () => {
  const { main, external } = await desktop();
  let blocked = 0;
  const navigation = { preventDefault: () => blocked++ };
  main.webContents.emit('will-navigate', navigation, 'http://127.0.0.1:5373/accounts');
  assert.equal(blocked, 0);
  main.webContents.emit('will-redirect', navigation, 'https://example.invalid');
  main.webContents.emit('will-attach-webview', navigation);
  assert.equal(blocked, 2);
  assert.deepEqual(main.openHandler({ url: 'https://www.pixiv.net' }), { action: 'deny' });
  assert.deepEqual(main.openHandler({ url: 'file:///etc/passwd' }), { action: 'deny' });
  assert.deepEqual(external, ['https://www.pixiv.net']);
});

test('IPC rejects other windows, subframes and a foreign main frame before contacting Core', async () => {
  const { main, handlers, event, requests } = await desktop();
  const start = handlers.get('auth.startLogin');
  await assert.rejects(start({ ...event, sender: {} }), /Untrusted/);
  await assert.rejects(start({ ...event, senderFrame: { url: main.url } }), /Untrusted/);
  main.webContents.mainFrame.url = 'https://example.invalid';
  await assert.rejects(start(event), /Untrusted/);
  assert.equal(requests.length, 0);
});

test('OAuth only captures the exact Pixiv callback, prevents navigation and delivers the login session once', async () => {
  const { windows, handlers, event, calls } = await desktop();
  await handlers.get('auth.startLogin')(event);
  const oauth = windows[1];
  assert.equal(oauth.config.webPreferences.preload, undefined);
  assert.equal(oauth.config.webPreferences.sandbox, true);
  assert.equal(oauth.config.webPreferences.partition, 'persist:artflow-oauth');
  let blocked = 0;
  const redirect = { preventDefault: () => blocked++ };
  oauth.webContents.emit('will-redirect', redirect, 'https://accounts.pixiv.net/login?code=intermediate');
  assert.equal(oauth.closed, undefined);
  assert.equal(blocked, 0);
  oauth.webContents.emit('will-navigate', redirect, 'pixiv://attacker/login?code=wrong');
  assert.equal(oauth.closed, undefined);
  assert.equal(calls.length, 0);
  const callback = 'pixiv://account/login?code=mock-code';
  oauth.webContents.emit('will-redirect', redirect, callback);
  oauth.webContents.emit('will-navigate', redirect, callback);
  assert.equal(oauth.closed, true);
  assert.equal(blocked, 3);
  assert.deepEqual(calls, [['oauth-callback', { loginId: 'login-1', callback }]]);
});

test('completion and token import validate payloads and preserve the Core request contract', async () => {
  const { handlers, event, requests } = await desktop();
  const complete = handlers.get('auth.completeLogin');
  const importToken = handlers.get('auth.importToken');
  await assert.rejects(complete(event, { loginId: 'missing', callback: 'code' }), /Invalid/);
  await assert.rejects(importToken(event, { refreshToken: '  ' }), /required/);
  await handlers.get('auth.startLogin')(event);
  await complete(event, { loginId: 'login-1', callback: ' pixiv://account/login?code=x ' });
  assert.equal(requests[1][0], 'http://127.0.0.1:3300/api/auth/login/complete');
  assert.deepEqual(JSON.parse(requests[1][1].body), {
    loginId: 'login-1', callback: 'pixiv://account/login?code=x',
  });
  await assert.rejects(complete(event, { loginId: 'login-1', callback: 'code' }), /Invalid/);
  await importToken(event, { refreshToken: ' mock-token ' });
  assert.equal(requests[2][0], 'http://127.0.0.1:3300/api/auth/import-token');
  assert.deepEqual(JSON.parse(requests[2][1].body), { refreshToken: 'mock-token' });
});

test('Core HTTP errors reject instead of reporting successful login or opening a window', async () => {
  const { handlers, event, windows } = await desktop({
    fetch: async () => ({ ok: false, status: 400 }),
  });
  await assert.rejects(handlers.get('auth.startLogin')(event), /400/);
  await assert.rejects(handlers.get('auth.importToken')(event, { refreshToken: 'mock' }), /400/);
  assert.equal(windows.length, 1);
  const unavailable = await desktop({
    fetch: async () => ({ ok: false, status: 400, json: async () => ({ message: 'Pixiv CLI is unavailable' }) }),
  });
  await assert.rejects(unavailable.handlers.get('auth.startLogin')(unavailable.event), /Pixiv CLI is unavailable/);
});

test('manual completion closes OAuth and consumes the session before an in-flight or failed exchange', async () => {
  let finish;
  const completion = new Promise((resolve) => { finish = resolve; });
  const { handlers, event, windows, calls } = await desktop({
    fetch: async (url) => {
      if (url.endsWith('/complete')) return completion;
      return { ok: true, json: async () => ({ data: {
        loginId: 'login-1', authorizeUrl: 'https://app-api.pixiv.net/web/v1/login',
      } }) };
    },
  });
  await handlers.get('auth.startLogin')(event);
  const oauth = windows[1];
  const payload = { loginId: 'login-1', callback: 'mock-code' };
  const inFlight = handlers.get('auth.completeLogin')(event, payload);
  assert.equal(oauth.closed, true);
  await assert.rejects(handlers.get('auth.completeLogin')(event, payload), /Invalid/);
  oauth.webContents.emit('will-redirect', { preventDefault: () => {} }, 'pixiv://account/login?code=stale');
  assert.equal(calls.length, 0);
  finish({ ok: false, status: 400 });
  await assert.rejects(inFlight, /400/);
  await assert.rejects(handlers.get('auth.completeLogin')(event, payload), /Invalid/);
});

test('packaged startup uses shipped dist and stops its server and the optional Core child on quit', async () => {
  let killed = false;
  let closed = false;
  const child = Object.assign(new EventEmitter(), { kill: () => { killed = true; } });
  const { main, app } = await desktop({
    app: { isPackaged: true },
    env: { ARTFLOW_FORK_CORE: '1', ARTFLOW_CORE_ENTRY: '/core/index.js' },
    fork: (entry, args, options) => {
      assert.equal(entry, '/core/index.js');
      assert.deepEqual(args, []);
      assert.equal(options.env.ELECTRON_RUN_AS_NODE, '1');
      assert.equal(options.env.HOST, '127.0.0.1');
      assert.equal(options.env.PORT, '3300');
      return child;
    },
    startStudioServer: async (dist, core) => {
      assert.equal(dist, '/app/dist');
      assert.equal(core, 'http://127.0.0.1:3300');
      return { url: 'http://127.0.0.1:45678', server: { close: () => { closed = true; } } };
    },
  });
  assert.equal(main.url, 'http://127.0.0.1:45678');
  app.quit();
  assert.equal(killed, true);
  assert.equal(closed, true);
});

test('the real preload enforces its allowlist and unsubscribes without exposing Electron events', async () => {
  let api;
  const renderer = new EventEmitter();
  renderer.invoke = async (channel, ...args) => [channel, ...args];
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../electron/preload.cjs'), 'utf8'), {
    require: (name) => {
      assert.equal(name, 'electron');
      return { contextBridge: { exposeInMainWorld: (name, value) => {
        assert.equal(name, 'artflow'); api = value;
      } }, ipcRenderer: renderer };
    },
  });
  for (const channel of SECURITY.preloadAllowlist) {
    assert.deepEqual(await api.invoke(channel, 'payload'), [channel, 'payload']);
  }
  await assert.rejects(api.invoke('fs.readFile', '/etc/passwd'), /not allowed/);
  const received = [];
  const cleanup = api.onOauthCallback((payload) => received.push(payload));
  const payload = { loginId: 'id', callback: 'pixiv://account/login?code=x' };
  renderer.emit('oauth-callback', { sender: 'privileged' }, payload);
  cleanup();
  renderer.emit('oauth-callback', {}, payload);
  assert.deepEqual(received, [payload]);
  assert.equal(renderer.listenerCount('oauth-callback'), 0);
});

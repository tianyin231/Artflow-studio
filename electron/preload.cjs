const { contextBridge, ipcRenderer } = require('electron');

const ALLOW = ['auth.startLogin', 'auth.completeLogin', 'auth.importToken', 'app.getVersion'];

contextBridge.exposeInMainWorld('artflow', {
  invoke: (channel, ...args) => {
    if (!ALLOW.includes(channel)) {
      return Promise.reject(new Error('channel not allowed: ' + channel));
    }
    return ipcRenderer.invoke(channel, ...args);
  },
  onOauthCallback: (cb) => ipcRenderer.on('oauth-callback', (_e, url) => cb(url)),
});

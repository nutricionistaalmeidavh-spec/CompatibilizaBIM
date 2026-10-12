
const { contextBridge, ipcRenderer } = require('electron');
// The review UI is served at an authenticated ephemeral loopback port.
// It must NOT inherit the SQLite/motor bridge of the trusted file:// or Vite renderer.
const locationInfo = new URL(globalThis.location.href);
const devOrigin = process.env.VITE_DEV_SERVER_URL ? new URL(process.env.VITE_DEV_SERVER_URL).origin : '';
const trustedApp =
  (locationInfo.protocol === 'file:' && locationInfo.pathname.endsWith('/index.html')) ||
  (Boolean(devOrigin) && locationInfo.origin === devOrigin);
if (trustedApp) {
  contextBridge.exposeInMainWorld('engineeringStorage', {
    loadSync: () => ipcRenderer.sendSync('engineering-db:load-sync'),
    saveSync: (base64) => ipcRenderer.sendSync('engineering-db:save-sync', base64),
    path: () => ipcRenderer.invoke('engineering-db:path'),
    math: { calculate: (request) => ipcRenderer.invoke('math:calculate', request) },
    bim: {
      p2: (request) => ipcRenderer.invoke('bim:p2', request),
      generateViewer: (files, output) => ipcRenderer.invoke('bim:generate-viewer', files, output),
      generateViewerBase64: (files) => ipcRenderer.invoke('bim:generate-viewer-base64', files),
      clashBase64: (files, options) => ipcRenderer.invoke('bim:clash-base64', files, options),
      convertDwgBase64: (file) => ipcRenderer.invoke('bim:convert-dwg-base64', file),
      openStudio: (workspacePath) => ipcRenderer.invoke('cbim:open-studio', workspacePath),
      listWorkspaces: () => ipcRenderer.invoke('cbim:list-workspaces'),
      jobs: () => ipcRenderer.invoke('cbim:conversion-jobs'),
      cancel: () => ipcRenderer.invoke('bim:cancel'),
      onProgress: (callback) => {
        const listener = (_event, value) => callback(value);
        ipcRenderer.on('bim:progress', listener);
        return () => ipcRenderer.removeListener('bim:progress', listener);
      },
      clash: (fileA, fileB, options) => ipcRenderer.invoke('bim:clash', fileA, fileB, options)
    }
  });
} else if (locationInfo.protocol === 'http:' && locationInfo.hostname === '127.0.0.1') {
  // The main process checks this window's registered session and exact origin.
  contextBridge.exposeInMainWorld('studioNavigation', {
    returnToApp: () => ipcRenderer.invoke('cbim:return-to-app')
  });
}

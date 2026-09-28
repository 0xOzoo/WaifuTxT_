// electron/preload.cjs — contextBridge surface exposed to the renderer.
// Keep this minimal: only what the UI needs to react to auto-update state.
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('waifuUpdater', {
  onStatus(callback) {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('updater:status', listener);
    return () => ipcRenderer.removeListener('updater:status', listener);
  },
  restartAndInstall() {
    ipcRenderer.send('updater:install');
  },
  getStatus: () => ipcRenderer.invoke('updater:get-status'),
  checkNow: () => ipcRenderer.invoke('updater:check'),
});

contextBridge.exposeInMainWorld('waifuSystem', {
  getLaunchAtStartup: () => ipcRenderer.invoke('startup:get'),
  setLaunchAtStartup: (enabled) => ipcRenderer.invoke('startup:set', enabled),
});

contextBridge.exposeInMainWorld('waifuSteam', {
  request: (method, path, token) => ipcRenderer.invoke('steam:request', { method, path, token }),
});

// Custom title bar (frameless window) — not exposed on macOS, which keeps the native frame.
if (process.platform !== 'darwin') {
  contextBridge.exposeInMainWorld('waifuWindow', {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
    close: () => ipcRenderer.send('window:close'),
    getState: () => ipcRenderer.invoke('window:get-state'),
    onState(callback) {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('window:state', listener);
      return () => ipcRenderer.removeListener('window:state', listener);
    },
  });
}

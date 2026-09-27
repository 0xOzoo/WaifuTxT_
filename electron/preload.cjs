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
});

contextBridge.exposeInMainWorld('waifuSystem', {
  getLaunchAtStartup: () => ipcRenderer.invoke('startup:get'),
  setLaunchAtStartup: (enabled) => ipcRenderer.invoke('startup:set', enabled),
});

/**
 * Preload bridge — expose safe desktop APIs to the ERP renderer.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('textileDesktop', {
  isDesktop: true,
  notify: (title, body) => ipcRenderer.invoke('desktop:notify', { title, body }),
  version: () => ipcRenderer.invoke('desktop:version'),
  platform: () => ipcRenderer.invoke('desktop:platform'),
  /** Sync — used by axios baseURL at module load */
  getApiBaseUrlSync: () => ipcRenderer.sendSync('desktop:api-url-sync'),
  getApiBaseUrl: () => ipcRenderer.invoke('desktop:api-url'),
  machineId: () => ipcRenderer.invoke('desktop:machine-id'),
});

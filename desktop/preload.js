/**
 * Preload bridge — expose safe desktop APIs to the ERP renderer.
 */
const { contextBridge, ipcRenderer } = require('electron');

let cachedIsLocal = true;
try {
  cachedIsLocal = ipcRenderer.sendSync('desktop:is-local-sync') !== false;
} catch {
  cachedIsLocal = true;
}

contextBridge.exposeInMainWorld('textileDesktop', {
  isDesktop: true,
  isLocal: cachedIsLocal,
  isLocalSync: () => {
    try {
      return ipcRenderer.sendSync('desktop:is-local-sync') !== false;
    } catch {
      return cachedIsLocal;
    }
  },
  notify: (title, body) => ipcRenderer.invoke('desktop:notify', { title, body }),
  version: () => ipcRenderer.invoke('desktop:version'),
  platform: () => ipcRenderer.invoke('desktop:platform'),
  /** Sync — used by axios baseURL at module load */
  getApiBaseUrlSync: () => ipcRenderer.sendSync('desktop:api-url-sync'),
  getApiBaseUrl: () => ipcRenderer.invoke('desktop:api-url'),
  machineId: () => ipcRenderer.invoke('desktop:machine-id'),
  needsSetup: () => ipcRenderer.invoke('desktop:needs-setup'),
  markSetupDone: () => ipcRenderer.invoke('desktop:mark-setup-done'),
  backup: () => ipcRenderer.invoke('desktop:backup'),
});

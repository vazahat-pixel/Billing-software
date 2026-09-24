/**
 * Preload bridge — expose safe desktop APIs to the ERP renderer.
 */
const { contextBridge, ipcRenderer } = require('electron');

let cachedIsLocal = true;
let cachedMode = 'hybrid';
try {
  cachedIsLocal = ipcRenderer.sendSync('desktop:is-local-sync') !== false;
  cachedMode = ipcRenderer.sendSync('desktop:mode-sync') || 'hybrid';
} catch {
  cachedIsLocal = true;
  cachedMode = 'hybrid';
}

contextBridge.exposeInMainWorld('textileDesktop', {
  isDesktop: true,
  isLocal: cachedIsLocal,
  mode: cachedMode,
  isLocalSync: () => {
    try {
      return ipcRenderer.sendSync('desktop:is-local-sync') !== false;
    } catch {
      return cachedIsLocal;
    }
  },
  getModeSync: () => {
    try {
      return ipcRenderer.sendSync('desktop:mode-sync') || cachedMode;
    } catch {
      return cachedMode;
    }
  },
  getMode: () => ipcRenderer.invoke('desktop:mode'),
  getSyncStatus: () => ipcRenderer.invoke('desktop:sync-status'),
  getCentralApiUrl: () => ipcRenderer.invoke('desktop:central-url'),
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

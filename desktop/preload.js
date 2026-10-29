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
  jsm: {
    detect: () => ipcRenderer.invoke('jsm:detect'),
    exportPackage: (args) => ipcRenderer.invoke('jsm:export', args),
    readChunk: (file, index, size) => ipcRenderer.invoke('jsm:read-chunk', { file, index, size }),
    cleanup: (file) => ipcRenderer.invoke('jsm:cleanup', file),
    onProgress: (fn) => { const h = (_e, p) => fn(p); ipcRenderer.on('jsm:progress', h); return () => ipcRenderer.removeListener('jsm:progress', h); },
  },
  /** App updates: state is { status, current, version, notes, percent, manual, error }. */
  update: {
    getState: () => ipcRenderer.invoke('update:get-state'),
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'),
    onState: (fn) => { const h = (_e, st) => fn(st); ipcRenderer.on('update:state', h); return () => ipcRenderer.removeListener('update:state', h); },
  },
  /** Renderer reports how many offline entries are still waiting to upload (close/quit warning). */
  setPendingSync: (count) => ipcRenderer.send('desktop:pending-sync', Number(count) || 0),
});

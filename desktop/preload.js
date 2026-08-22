/**
 * Preload bridge — expose safe desktop APIs to the ERP renderer.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('textileDesktop', {
  isDesktop: true,
  notify: (title, body) => ipcRenderer.invoke('desktop:notify', { title, body }),
  version: () => ipcRenderer.invoke('desktop:version'),
  platform: () => ipcRenderer.invoke('desktop:platform'),
  // Hardware-derived identity for licence device binding (read-only).
  machineId: () => ipcRenderer.invoke('desktop:machine-id'),
});

/**
 * Stage 8.5 — Auto-update stub (electron-updater when installed).
 */
function setupAutoUpdater() {
  if (process.env.ERP_DISABLE_AUTOUPDATE === '1') return;
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch {
    console.info('[desktop] electron-updater not installed — skip auto-update');
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.on('update-available', (info) => {
    console.info('[desktop] update available', info?.version);
  });
  autoUpdater.on('update-downloaded', () => {
    console.info('[desktop] update downloaded — restart to apply');
  });
  autoUpdater.on('error', (err) => {
    console.warn('[desktop] updater error', err?.message);
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 5000);
}

module.exports = { setupAutoUpdater };

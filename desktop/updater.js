/**
 * Auto-update: checks the server's update feed (publish url in electron-builder.yml) on start and every
 * 4 hours, downloads in the background, then offers a restart. Disable with ERP_DISABLE_AUTOUPDATE=1.
 */
const { app, dialog } = require('electron');

const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;

function setupAutoUpdater() {
  if (process.env.ERP_DISABLE_AUTOUPDATE === '1' || !app.isPackaged) return;
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch {
    console.info('[desktop] electron-updater not installed — skip auto-update');
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  let prompted = false;

  autoUpdater.on('update-available', (info) => {
    console.info('[desktop] update available', info?.version);
  });
  autoUpdater.on('update-downloaded', async (info) => {
    if (prompted) return;
    prompted = true;
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Update ready',
      message: `Textile ERP ${info?.version || ''} is ready to install.`,
      detail: 'Save your work, then restart to update. If you choose Later, it installs when you close the app.',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.on('error', (err) => {
    console.warn('[desktop] updater error', err?.message);
  });

  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(check, 5000);
  setInterval(check, CHECK_EVERY_MS);
}

module.exports = { setupAutoUpdater };

/**
 * Auto-update: checks the server's update feed (publish url in electron-builder.yml) on start and every
 * 30 minutes, downloads in the background, then tells the user. The app shows an "Update available" bar
 * (with what's new) and installs on "Update now"; if the screen is not listening, a dialog is shown instead.
 * Help > Check for updates checks on demand. Disable with ERP_DISABLE_AUTOUPDATE=1.
 */
const { app, dialog, ipcMain, BrowserWindow } = require('electron');

const CHECK_EVERY_MS = 30 * 60 * 1000;

// What the screen shows: idle | checking | none | available | downloading | downloaded | error | disabled
let state = { status: 'idle', current: app.getVersion() };
let autoUpdater = null;
let rendererListening = false;
let prompted = false;
let manualCheck = false;

function notesText(notes) {
  if (!notes) return '';
  if (typeof notes === 'string') return notes;
  if (Array.isArray(notes)) return notes.map((n) => n?.note || '').filter(Boolean).join('\n\n');
  return '';
}

function setState(patch) {
  state = { ...state, ...patch, current: app.getVersion() };
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send('update:state', state);
    } catch {
      /* window closing */
    }
  }
}

function installNow() {
  if (!autoUpdater || state.status !== 'downloaded') return false;
  // Silent install, then the app opens again by itself on the new version.
  setImmediate(() => autoUpdater.quitAndInstall(true, true));
  return true;
}

async function showDialog(info) {
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
  if (response === 0) installNow();
}

function check(manual = false) {
  if (!autoUpdater) {
    if (manual) {
      dialog.showMessageBox({ type: 'info', title: 'Updates', message: 'Updates are turned off in this copy of the app.' });
    }
    return Promise.resolve(state);
  }
  if (['checking', 'downloading', 'downloaded'].includes(state.status)) return Promise.resolve(state);
  manualCheck = manual;
  return autoUpdater.checkForUpdates().then(() => state).catch(() => state);
}

ipcMain.handle('update:get-state', () => {
  rendererListening = true;
  return state;
});
ipcMain.handle('update:check', () => {
  rendererListening = true;
  return check(true);
});
ipcMain.handle('update:install', () => installNow());

function setupAutoUpdater() {
  if (process.env.ERP_DISABLE_AUTOUPDATE === '1' || !app.isPackaged) {
    setState({ status: 'disabled' });
    return;
  }
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch {
    console.info('[desktop] electron-updater not installed — skip auto-update');
    setState({ status: 'disabled' });
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => setState({ status: 'checking', error: '', manual: manualCheck }));
  autoUpdater.on('update-not-available', () => {
    setState({ status: 'none', checkedAt: new Date().toISOString(), manual: manualCheck });
    if (manualCheck && !rendererListening) {
      dialog.showMessageBox({ type: 'info', title: 'Updates', message: `You have the latest version (${app.getVersion()}).` });
    }
    manualCheck = false;
  });
  autoUpdater.on('update-available', (info) => {
    console.info('[desktop] update available', info?.version);
    setState({ status: 'downloading', version: info?.version || '', notes: notesText(info?.releaseNotes), releaseDate: info?.releaseDate || '', percent: 0 });
  });
  autoUpdater.on('download-progress', (p) => {
    setState({ status: 'downloading', percent: Math.round(p?.percent || 0) });
  });
  autoUpdater.on('update-downloaded', (info) => {
    setState({ status: 'downloaded', version: info?.version || state.version, notes: notesText(info?.releaseNotes) || state.notes, percent: 100 });
    // The screen shows its own bar; a dialog only when the screen is not listening (older screen, crash).
    if (!rendererListening) showDialog(info);
  });
  autoUpdater.on('error', (err) => {
    console.warn('[desktop] updater error', err?.message);
    setState({ status: 'error', error: 'Could not check for updates. Check the internet and try again.', manual: manualCheck });
    if (manualCheck && !rendererListening) {
      dialog.showMessageBox({ type: 'warning', title: 'Updates', message: 'Could not check for updates. Check the internet and try again.' });
    }
    manualCheck = false;
  });

  setTimeout(() => check(false), 5000);
  setInterval(() => check(false), CHECK_EVERY_MS);
}

module.exports = { setupAutoUpdater, checkForUpdates: () => check(true) };

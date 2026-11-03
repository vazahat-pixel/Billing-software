/**
 * Textile ERP — Electron main process
 * Standalone offline: boots local mongod + Express, then loads the React UI.
 */
const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, shell, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
// Registers the update:* IPC handlers early, so the screen can ask for the update state at any time.
const updater = require('./updater');

// Ensure only a single instance of Textile ERP runs at any time.
// Prevents duplicate processes from locking or corrupting the IndexedDB backing store (%APPDATA%/Textile ERP/IndexedDB).
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  console.log('[desktop] Another instance of Textile ERP is already running. Quitting duplicate instance.');
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let tray = null;
let localStack = null;
/** Offline entries the renderer still has to upload (reported over 'desktop:pending-sync'). */
let rendererPendingSync = 0;
const isDev = !app.isPackaged;

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }
});

function readJsonSafe(file) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    /* ignore */
  }
  return null;
}

function writeJsonSafe(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
}

function resolveApiBaseUrl() {
  if (localStack?.apiBaseUrl) return localStack.apiBaseUrl;
  if (process.env.ERP_API_URL) return process.env.ERP_API_URL.replace(/\/$/, '');

  const candidates = [
    path.join(app.getPath('userData'), 'config.json'),
    path.join(process.resourcesPath || __dirname, 'config.json'),
    path.join(__dirname, 'config.json'),
  ];
  for (const file of candidates) {
    const cfg = readJsonSafe(file);
    if (cfg?.apiBaseUrl) return String(cfg.apiBaseUrl).replace(/\/$/, '');
  }
  return process.env.VITE_API_URL || 'https://app.dealingindia.com/api';
}

function resolveStartUrl() {
  if (process.env.ERP_DESKTOP_URL) return { type: 'url', value: process.env.ERP_DESKTOP_URL };

  const rendererIndex = path.join(__dirname, 'renderer', 'index.html');

  if (isDev && process.env.ERP_USE_RENDERER !== '1') {
    return { type: 'url', value: process.env.VITE_DEV_URL || 'http://localhost:5173' };
  }

  if (fs.existsSync(rendererIndex)) {
    return { type: 'file', value: rendererIndex };
  }

  const sibling = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
  if (fs.existsSync(sibling)) {
    return { type: 'file', value: sibling };
  }

  return { type: 'url', value: process.env.VITE_DEV_URL || 'http://localhost:5173' };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    title: 'Textile ERP',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true,
      webSecurity: false,
    },
  });

  const target = resolveStartUrl();
  if (target.type === 'file') {
    mainWindow.loadFile(target.value);
  } else {
    mainWindow.loadURL(target.value);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (process.env.ERP_OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // F12 key to toggle Developer Console
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // Right-click Inspect Element & Reload context menu
  mainWindow.webContents.on('context-menu', (_e, params) => {
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Inspect Element', click: () => mainWindow.webContents.inspectElement(params.x, params.y) },
      { type: 'separator' },
      { label: 'Reload', role: 'reload' },
      { label: 'Toggle Developer Tools (F12)', click: () => mainWindow.webContents.toggleDevTools() },
    ]);
    contextMenu.popup(mainWindow);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: 'deny' };
  });

  mainWindow.on('close', (e) => {
    if (app.isQuiting) return;
    e.preventDefault();
    if (rendererPendingSync > 0) {
      // Window close only hides to the tray, so uploading continues — say so, and ask for internet.
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Entries not uploaded yet',
        message: `${rendererPendingSync} offline entr${rendererPendingSync === 1 ? 'y is' : 'ies are'} not on the cloud yet.`,
        detail: 'Please turn the internet ON. Textile ERP keeps running in the tray and uploads them automatically.\n\nInternet ON karein — entries apne aap cloud par chali jayengi. App tray mein chalta rahega.',
        buttons: ['OK'],
      }).catch(() => {});
    }
    mainWindow.hide();
  });
}

async function runBackupDialog() {
  const { zipUserData } = require('./localRuntime/backup');
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'Backup Textile ERP data',
    defaultPath: `textile-erp-backup-${new Date().toISOString().slice(0, 10)}.zip`,
    filters: [{ name: 'Zip', extensions: ['zip'] }],
  });
  if (canceled || !filePath) return;
  await zipUserData(app.getPath('userData'), filePath);
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Backup complete',
    message: `Saved to:\n${filePath}`,
  });
}

async function runRestoreDialog() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Restore Textile ERP data',
    filters: [{ name: 'Zip', extensions: ['zip'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths[0]) return;
  const confirm = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Restore backup?',
    message: 'This replaces local data. The app will quit after restore — reopen to continue.',
    buttons: ['Cancel', 'Restore'],
    defaultId: 0,
    cancelId: 0,
  });
  if (confirm.response !== 1) return;

  const { restoreUserDataZip } = require('./localRuntime/backup');
  await restoreUserDataZip(result.filePaths[0], app.getPath('userData'));
  app.isQuiting = true;
  app.quit();
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Reload', role: 'reload' },
        { label: 'Force Reload', role: 'forceReload' },
        { type: 'separator' },
        {
          label: 'Backup data…',
          click: () => runBackupDialog().catch((e) => dialog.showErrorBox('Backup failed', e.message)),
        },
        {
          label: 'Restore data…',
          click: () => runRestoreDialog().catch((e) => dialog.showErrorBox('Restore failed', e.message)),
        },
        { type: 'separator' },
        {
          label: 'Local / API Settings…',
          click: () => {
            const cfgPath = path.join(app.getPath('userData'), 'config.json');
            const current = resolveApiBaseUrl();
            const mode = localStack?.mode || readJsonSafe(cfgPath)?.mode || 'local';
            dialog
              .showMessageBox(mainWindow, {
                type: 'info',
                title: 'Desktop settings',
                message: mode === 'local' ? 'Standalone offline mode' : 'Remote API mode',
                detail:
                  `Mode: ${mode}\nAPI: ${current}\n\nConfig file:\n${cfgPath}\n\n` +
                  `local = standalone offline.\n` +
                  `hybrid = local execution + sync to centralApiBaseUrl.\n` +
                  `remote = UI talks only to an external API.`,
                buttons: ['Open data folder', 'OK'],
              })
              .then((r) => {
                if (r.response === 0) shell.openPath(app.getPath('userData'));
              });
          },
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.isQuiting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools (Console)',
          accelerator: 'F12',
          click: () => mainWindow?.webContents.toggleDevTools(),
        },
        {
          label: 'Developer Tools (Alt)',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => mainWindow?.webContents.toggleDevTools(),
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: `Version ${app.getVersion()}`, enabled: false },
        { label: 'Check for updates…', click: () => updater.checkForUpdates() },
        {
          label: 'About offline desktop',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Textile ERP Desktop',
              message: 'Standalone offline ERP (1 PC = 1 company)',
              detail:
                'All data stays on this computer. No internet required after install.\n' +
                'Use File → Backup regularly.',
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createFromDataURL(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAOklEQVQ4T2NkYGD4z0ABYBzVMKoBBgwMDAz/GUgEjKMGRg0YDYLRIGBgYGBgZGBg+M9AGmAc1TBqAABlCQQL/Z6kJQAAAABJRU5ErkJggg=='
      );
  tray = new Tray(icon);
  tray.setToolTip('Textile ERP');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open', click: () => mainWindow?.show() },
      {
        label: 'Quit',
        click: () => {
          app.isQuiting = true;
          app.quit();
        },
      },
    ])
  );
  tray.on('double-click', () => mainWindow?.show());
}

ipcMain.handle('desktop:notify', (_e, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title: title || 'Textile ERP', body: body || '' }).show();
  }
  return true;
});

/**
 * A PC installed before offline mode ran in "remote" mode, where offline entries wait in the
 * window's own queue. Its saved config keeps it there after updating. It moves to the new offline
 * mode only once that queue has reported EMPTY — the new mode does not read the old queue, so
 * switching earlier could strand an entry. Then the owner is asked to restart.
 */
let mirrorSwitchOffered = false;
function shouldMoveToMirror() {
  const userCfgPath = path.join(app.getPath('userData'), 'config.json');
  const userCfg = readJsonSafe(userCfgPath);
  const shipped = readJsonSafe(path.join(process.resourcesPath || __dirname, 'config.json')) || readJsonSafe(path.join(__dirname, 'config.json'));
  return (
    String(shipped?.mode || '').toLowerCase() === 'hybrid' &&
    String(userCfg?.mode || '').toLowerCase() === 'remote' &&
    !userCfg?.mirrorSwitchedAt
  );
}

async function offerMirrorSwitch() {
  if (mirrorSwitchOffered || rendererPendingSync > 0 || !shouldMoveToMirror()) return;
  mirrorSwitchOffered = true;
  const userCfgPath = path.join(app.getPath('userData'), 'config.json');
  const userCfg = readJsonSafe(userCfgPath) || {};
  writeJsonSafe(userCfgPath, {
    ...userCfg,
    mode: 'hybrid',
    apiBaseUrl: userCfg.centralApiBaseUrl || userCfg.apiBaseUrl,
    mirrorSwitchedAt: new Date().toISOString(),
  });
  const { response } = await dialog.showMessageBox(mainWindow || undefined, {
    type: 'info',
    title: 'Offline mode is ready',
    message: 'This computer can now work fully without internet.',
    detail:
      'All your entries are already on the cloud. Restart Textile ERP to switch on offline mode. ' +
      'The first start needs internet once to download your company; after that sale, purchase, mill, job, ' +
      'vouchers and reports all work offline, and everything uploads by itself when the internet is back.\n\n' +
      'Offline mode taiyar hai. Restart karein — pehli baar internet chahiye, uske baad bina internet ke kaam chalega.',
    buttons: ['Restart now', 'Next time I open the app'],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) {
    app.relaunch();
    app.quit();
  }
}

ipcMain.on('desktop:pending-sync', (_e, count) => {
  rendererPendingSync = Math.max(0, Number(count) || 0);
  if (rendererPendingSync === 0) offerMirrorSwitch().catch(() => {});
});
ipcMain.handle('desktop:version', () => app.getVersion());
ipcMain.handle('desktop:platform', () => process.platform);
ipcMain.handle('desktop:api-url', () => resolveApiBaseUrl());
ipcMain.on('desktop:api-url-sync', (event) => {
  event.returnValue = resolveApiBaseUrl();
});
function getEffectiveDesktopMode() {
  if (localStack?.mode) return localStack.mode;
  try {
    const cfg = readJsonSafe(path.join(app.getPath('userData'), 'config.json')) || readJsonSafe(path.join(__dirname, 'config.json'));
    return (cfg?.mode || 'remote').toLowerCase();
  } catch {
    return 'remote';
  }
}

ipcMain.handle('desktop:is-local', () => {
  const mode = getEffectiveDesktopMode();
  return mode === 'local' || mode === 'hybrid';
});
ipcMain.on('desktop:is-local-sync', (event) => {
  const mode = getEffectiveDesktopMode();
  event.returnValue = mode === 'local' || mode === 'hybrid';
});
ipcMain.handle('desktop:mode', () => getEffectiveDesktopMode());
ipcMain.on('desktop:mode-sync', (event) => {
  event.returnValue = getEffectiveDesktopMode();
});
ipcMain.handle('desktop:sync-status', () => {
  try {
    return require('./syncAgent').getStatus();
  } catch {
    return { connectivity: 'unknown', syncState: 'idle', pendingCount: 0 };
  }
});
ipcMain.handle('desktop:central-url', () => localStack?.centralApiBaseUrl || null);
ipcMain.handle('desktop:needs-setup', async () => {
  // Always permit direct sign-in for users; never block on import/activation screen
  return false;
});
ipcMain.handle('desktop:mark-setup-done', () => {
  fs.writeFileSync(path.join(app.getPath('userData'), 'setup.done'), new Date().toISOString(), 'utf8');
  return true;
});

ipcMain.handle('desktop:machine-id', () => {
  try {
    const { getMachineIdentity } = require('./machineId');
    return getMachineIdentity(app.getPath('userData'));
  } catch (err) {
    return { error: err.message, deviceId: null, fingerprint: null };
  }
});

// --- Import from JSM (read-only; the JSM login never leaves this process) ---
const jsmService = require('./jsmExtractor/service');
ipcMain.handle('jsm:detect', () => jsmService.detect().catch((e) => ({ ok: false, reason: 'error', message: String(e.message).slice(0, 200), installs: [] })));
ipcMain.handle('jsm:export', async (event, args) => {
  const r = await jsmService.exportPackage(args, (p) => { try { event.sender.send('jsm:progress', p); } catch { /* window closed */ } });
  return { file: r.file, bytes: r.bytes, totalRows: r.totalRows };
});
ipcMain.handle('jsm:read-chunk', (_e, { file, index, size }) => jsmService.readChunk(file, index, size));
ipcMain.handle('jsm:cleanup', (_e, file) => { jsmService.removeExport(file); return true; });

ipcMain.handle('desktop:backup', async () => {
  await runBackupDialog();
  return true;
});

app.whenReady().then(async () => {
  const userData = app.getPath('userData');
  fs.mkdirSync(userData, { recursive: true });

  const userCfg = readJsonSafe(path.join(userData, 'config.json')) || readJsonSafe(path.join(__dirname, 'config.json'));
  const isRemote = (userCfg?.mode || 'remote').toLowerCase() === 'remote';
  const splashText = isRemote ? 'Connecting to Dealing India Cloud…' : 'Starting local database…';

  const splash = new BrowserWindow({
    width: 420,
    height: 180,
    frame: false,
    resizable: false,
    show: true,
    alwaysOnTop: true,
    backgroundColor: '#0f172a',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  splash.loadURL(
    'data:text/html,' +
      encodeURIComponent(
        `<html><body style="margin:0;font-family:Segoe UI,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh">
        <div style="text-align:center"><div style="font-size:18px;font-weight:600">Textile ERP</div>
        <div style="margin-top:12px;opacity:.7;font-size:13px">${splashText}</div></div></body></html>`
      )
  );

  try {
    const { bootLocalStack } = require('./localRuntime');
    localStack = await bootLocalStack({
      userData,
      desktopRoot: __dirname,
      resourcesPath: process.resourcesPath,
      isPackaged: app.isPackaged,
    });
    try {
      const syncAgent = require('./syncAgent');
      syncAgent.setStatus({ mode: localStack.mode || 'local' });
      if (localStack.mode === 'hybrid' && localStack.centralApiBaseUrl) {
        syncAgent.startProbing({ centralApiBaseUrl: localStack.centralApiBaseUrl });
      }
    } catch (err) {
      console.warn('[desktop] syncAgent init', err.message);
    }
  } catch (err) {
    console.error('[desktop] local stack failed', err);
    splash.destroy();
    dialog.showErrorBox(
      'Textile ERP failed to start',
      `${err.message}\n\nPlease install the latest official setup package or contact support.\nData folder: ${userData}`
    );
    app.isQuiting = true;
    app.quit();
    return;
  }

  try {
    splash.destroy();
  } catch {
    /* ignore */
  }

  const { session } = require('electron');
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (details.url && details.url.includes('dealingindia.com')) {
      details.requestHeaders['Origin'] = 'https://app.dealingindia.com';
    }
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  buildMenu();
  createWindow();
  createTray();
  try {
    updater.setupAutoUpdater();
  } catch {
    /* optional */
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });
});

app.on('before-quit', async (e) => {
  if (app._stackStopped) return;
  e.preventDefault();

  if (!app._forceQuitConfirmed) {
    // Entries waiting to upload: the renderer's offline queue (remote mode) plus, on a mirrored
    // desktop, every document changed on this PC since the last upload. Closing never deletes
    // anything — whatever is still waiting uploads the next time the app opens with internet.
    const api = resolveApiBaseUrl();
    const localUrl = (p) => (api.endsWith('/api') ? `${api}${p}` : `${api}/api${p}`);
    const mirror = async (p, method = 'GET', ms = 2000) => {
      const res = await fetch(localUrl(p), { method, signal: AbortSignal.timeout(ms) });
      if (!res.ok) return null; // not a mirrored desktop
      return (await res.json())?.data || null;
    };

    let state = await mirror('/desktop/sync-pending').catch(() => null);
    const isMirror = !!state;
    let pending = rendererPendingSync + Number(state?.pending || 0);

    while (pending > 0) {
      // Upload first; only ask if something is still left.
      if (isMirror) {
        const after = await mirror('/desktop/sync-now', 'POST', 90000).catch(() => null);
        if (after) state = after;
      } else {
        await new Promise((r) => setTimeout(r, 4000)); // renderer queue drains on its own
      }
      pending = rendererPendingSync + Number(state?.pending || 0);
      if (pending <= 0) break;

      const online = isMirror ? state?.online !== false : true;
      const detail = online
        ? `${pending} entr${pending === 1 ? 'y is' : 'ies are'} still waiting. ${state?.lastError ? `Reason: ${state.lastError}\n\n` : ''}` +
          'Entries is computer mein SAFE hain. "Retry upload" dabakar dobara bhejein, ya "Close anyway" — agli baar app kholne par upload ho jayengi.'
        : 'Internet nahi mila. Entries is computer mein SAFE hain — koi bhi data DELETE nahi hoga.\n\n' +
          'Internet ON karke "Retry upload" dabayein, ya "Close anyway" — agli baar internet ke saath app kholne par upload ho jayengi.';

      const { response } = await dialog.showMessageBox(mainWindow || undefined, {
        type: 'warning',
        title: 'Entries not uploaded yet',
        message: `${pending} entr${pending === 1 ? 'y has' : 'ies have'} not reached the cloud yet.`,
        detail,
        buttons: ['Keep app open', 'Retry upload', 'Close anyway'],
        defaultId: 1,
        cancelId: 0,
      });
      if (response === 0) {
        // Quit cancelled: back to normal, so closing the window hides it again instead of exiting.
        app.isQuiting = false;
        mainWindow?.show();
        return;
      }
      if (response === 2) break; // Close anyway — everything stays in the local database
      // response === 1: Retry — loop uploads again and re-checks
    }
  }

  app._stackStopped = true;
  app.isQuiting = true;
  try {
    const { shutdownLocalStack } = require('./localRuntime');
    await shutdownLocalStack();
  } catch (err) {
    console.error('[desktop] shutdown error', err);
  }
  try {
    require('./syncAgent').stopProbing();
  } catch {
    /* ignore */
  }
  app.exit(0);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    /* tray keeps process alive */
  }
});

process.on('uncaughtException', (err) => {
  console.error('[desktop] crash', err);
});

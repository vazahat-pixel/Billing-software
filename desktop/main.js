/**
 * Textile ERP — Electron main process
 * Standalone offline: boots local mongod + Express, then loads the React UI.
 */
const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, shell, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let localStack = null;
const isDev = !app.isPackaged;

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
  return process.env.VITE_API_URL || 'http://127.0.0.1:5050/api';
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

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: 'deny' };
  });

  mainWindow.on('close', (e) => {
    if (app.isQuiting) return;
    e.preventDefault();
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
          label: 'Toggle Developer Tools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => mainWindow?.webContents.toggleDevTools(),
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: `Version ${app.getVersion()}`, enabled: false },
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

ipcMain.handle('desktop:version', () => app.getVersion());
ipcMain.handle('desktop:platform', () => process.platform);
ipcMain.handle('desktop:api-url', () => resolveApiBaseUrl());
ipcMain.on('desktop:api-url-sync', (event) => {
  event.returnValue = resolveApiBaseUrl();
});
ipcMain.handle('desktop:is-local', () => {
  const mode = localStack?.mode || 'local';
  return mode === 'local' || mode === 'hybrid';
});
ipcMain.on('desktop:is-local-sync', (event) => {
  const mode = localStack?.mode || 'local';
  event.returnValue = mode === 'local' || mode === 'hybrid';
});
ipcMain.handle('desktop:mode', () => localStack?.mode || 'local');
ipcMain.on('desktop:mode-sync', (event) => {
  event.returnValue = localStack?.mode || 'local';
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
  // Remote API (existing SaaS / shared Mongo) — no provisioning pack required
  const mode = localStack?.mode || readJsonSafe(path.join(app.getPath('userData'), 'config.json'))?.mode || 'local';
  if (String(mode).toLowerCase() === 'remote') return false;

  // Prefer local API activation status (Mongo) over legacy setup.done file
  try {
    const base = resolveApiBaseUrl();
    if (base) {
      const res = await fetch(`${String(base).replace(/\/$/, '')}/desktop/activation-status`);
      if (res.ok) {
        const json = await res.json();
        const activated = !!(json?.data?.activated ?? json?.activated);
        if (activated) return false;
        return true;
      }
    }
  } catch {
    /* fall through */
  }
  const flag = path.join(app.getPath('userData'), 'setup.done');
  return !fs.existsSync(flag);
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

ipcMain.handle('desktop:backup', async () => {
  await runBackupDialog();
  return true;
});

app.whenReady().then(async () => {
  const userData = app.getPath('userData');
  fs.mkdirSync(userData, { recursive: true });

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
        <div style="margin-top:12px;opacity:.7;font-size:13px">Starting local database…</div></div></body></html>`
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
      `${err.message}\n\nInstall MongoDB locally or run desktop/scripts/fetch-mongodb.cjs, then retry.\nData folder: ${userData}`
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

  buildMenu();
  createWindow();
  createTray();
  try {
    require('./updater').setupAutoUpdater();
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

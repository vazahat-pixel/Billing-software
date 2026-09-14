/**
 * Textile ERP — Electron main process (user desktop shell)
 * Loads the packaged React UI and talks to the remote/local MERN API.
 */
const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, shell, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

let mainWindow = null;
let tray = null;
const isDev = !app.isPackaged;

function readJsonSafe(file) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    /* ignore */
  }
  return null;
}

/** Runtime API base — userData overrides packaged default. */
function resolveApiBaseUrl() {
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
  // Dev default: Vite proxy path won't work in Electron — hit backend directly
  return process.env.VITE_API_URL || 'http://localhost:5050/api';
}

function resolveStartUrl() {
  if (process.env.ERP_DESKTOP_URL) return { type: 'url', value: process.env.ERP_DESKTOP_URL };

  const rendererIndex = path.join(__dirname, 'renderer', 'index.html');

  // Dev hot-reload: Vite. Set ERP_USE_RENDERER=1 to test the packaged UI without NSIS.
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
      sandbox: false, // machineId + sync IPC need non-sandbox preload
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

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Reload', role: 'reload' },
        { label: 'Force Reload', role: 'forceReload' },
        { type: 'separator' },
        {
          label: 'API Settings…',
          click: () => {
            const cfgPath = path.join(app.getPath('userData'), 'config.json');
            const current = resolveApiBaseUrl();
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'API Settings',
              message: 'Server API URL',
              detail:
                `Current: ${current}\n\n` +
                `Edit this file and restart the app:\n${cfgPath}\n\n` +
                `Example:\n{\n  "apiBaseUrl": "https://your-api.example.com/api"\n}`,
              buttons: ['Open config folder', 'OK'],
            }).then((r) => {
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
        {
          label: 'Open in Browser (web)',
          click: () => {
            const api = resolveApiBaseUrl().replace(/\/api\/?$/, '');
            shell.openExternal(api || 'http://localhost:5173');
          },
        },
        { label: `Version ${app.getVersion()}`, enabled: false },
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

ipcMain.handle('desktop:machine-id', () => {
  try {
    const { getMachineIdentity } = require('./machineId');
    return getMachineIdentity(app.getPath('userData'));
  } catch (err) {
    return { error: err.message, deviceId: null, fingerprint: null };
  }
});

app.whenReady().then(() => {
  // Seed default config for first run
  const userCfg = path.join(app.getPath('userData'), 'config.json');
  if (!fs.existsSync(userCfg)) {
    try {
      fs.mkdirSync(app.getPath('userData'), { recursive: true });
      fs.writeFileSync(
        userCfg,
        JSON.stringify(
          {
            apiBaseUrl: resolveApiBaseUrl(),
            note: 'Change apiBaseUrl to your MERN backend /api URL, then restart the app.',
          },
          null,
          2
        ),
        'utf8'
      );
    } catch {
      /* ignore */
    }
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    /* keep tray alive on Windows */
  }
});

process.on('uncaughtException', (err) => {
  console.error('[desktop] crash', err);
  if (!app.isQuiting) {
    app.relaunch();
    app.isQuiting = true;
    app.exit(1);
  }
});

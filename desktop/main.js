/**
 * Textile ERP — Electron main process (Stage 8.4)
 * Loads the web ERP UI; no business logic here.
 */
const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, shell, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
const isDev = !app.isPackaged;

function resolveStartUrl() {
  if (process.env.ERP_DESKTOP_URL) return process.env.ERP_DESKTOP_URL;
  if (isDev) return process.env.VITE_DEV_URL || 'http://localhost:5173';
  const indexHtml = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
  if (fs.existsSync(indexHtml)) return `file://${indexHtml}`;
  return 'http://localhost:5173';
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
      sandbox: true,
    },
  });

  const url = resolveStartUrl();
  mainWindow.loadURL(url);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (process.env.ERP_OPEN_DEVTOOLS === '1') mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
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
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => shell.openExternal('https://localhost/docs'),
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
    : nativeImage.createEmpty();
  tray = new Tray(icon.isEmpty() ? nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  ) : icon);
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

app.whenReady().then(() => {
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
  // Crash recovery: relaunch once
  if (!app.isQuiting) {
    app.relaunch();
    app.isQuiting = true;
    app.exit(1);
  }
});

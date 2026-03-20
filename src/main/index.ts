import { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, dialog } from 'electron';
import * as path from 'path';
import { registerWindowHandlers, applyPresetFromMain } from './window-manager';
import { registerPresetHandlers, loadSettings, loadPresets } from './preset-store';
import type { MonitorInfo } from '../shared/types';
import { IPC } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0E1116',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, '../../build/icon.png'),
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('close', (e) => {
    // Minimize to tray instead of closing
    e.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('MonCOM - Monitor Commander');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show MonCOM', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => { mainWindow?.destroy(); app.quit(); } },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => mainWindow?.show());
}

function getMonitors(): MonitorInfo[] {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();

  return displays.map((d, i) => ({
    id: `monitor-${d.id}`,
    name: `Monitor ${i + 1}${d.id === primary.id ? ' (Primary)' : ''}`,
    x: d.bounds.x,
    y: d.bounds.y,
    width: d.bounds.width,
    height: d.bounds.height,
    scaleFactor: d.scaleFactor,
    isPrimary: d.id === primary.id,
  }));
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  // Monitor detection
  ipcMain.handle(IPC.GET_MONITORS, () => getMonitors());

  // Window title bar controls
  ipcMain.on('window-minimize', () => mainWindow?.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window-close', () => mainWindow?.hide());

  // File picker for selecting executables
  ipcMain.handle('pick-executable', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Application',
      filters: [
        { name: 'Executables', extensions: ['exe', 'bat', 'cmd', 'lnk'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
      defaultPath: 'C:\\Program Files',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // Register other IPC handlers
  registerWindowHandlers(ipcMain);
  registerPresetHandlers(ipcMain);

  // Auto-launch preset on startup
  try {
    const settings = loadSettings();
    if (settings.autoLaunchPreset && settings.autoLaunchPresetId) {
      const presets = loadPresets();
      const preset = presets.find(p => p.id === settings.autoLaunchPresetId);
      if (preset) {
        console.log(`[MonCOM] Auto-launching preset: ${preset.name}`);
        // Small delay to let monitors settle after boot
        setTimeout(() => {
          applyPresetFromMain(preset, screen);
        }, 3000);
      }
    }
  } catch (e) {
    console.error('[MonCOM] Auto-launch failed:', e);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

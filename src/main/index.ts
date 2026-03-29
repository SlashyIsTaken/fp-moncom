import { app, BrowserWindow, ipcMain, screen, shell, Tray, Menu, nativeImage, dialog } from 'electron';
import * as path from 'path';
import { execSync } from 'child_process';
import { registerWindowHandlers, applyPresetFromMain } from './window-manager';
import { registerPresetHandlers, loadSettings, loadPresets } from './preset-store';
import { startRecording, stopRecording, playActions } from './automation-manager';
import type { MonitorInfo } from '../shared/types';
import { IPC } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const isDev = !app.isPackaged;

/**
 * Check if the current process is running with administrator privileges.
 */
function isProcessElevated(): boolean {
  try {
    execSync('net session', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}


/**
 * Show identification overlays on all monitors. Click anywhere to dismiss.
 */
let identifyOverlays: BrowserWindow[] = [];

function closeIdentifyOverlays(): void {
  for (const win of identifyOverlays) {
    if (!win.isDestroyed()) win.close();
  }
  identifyOverlays = [];
}

function identifyMonitors(): void {
  // Close any existing overlays first
  closeIdentifyOverlays();

  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();

  for (let i = 0; i < displays.length; i++) {
    const d = displays[i];
    const isPrimary = d.id === primary.id;
    const name = `Monitor ${i + 1}${isPrimary ? ' (Primary)' : ''}`;

    const overlay = new BrowserWindow({
      x: d.bounds.x,
      y: d.bounds.y,
      width: d.bounds.width,
      height: d.bounds.height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: true,
      resizable: false,
      webPreferences: { contextIsolation: true },
    });

    const html = `
      <html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:rgba(14,17,22,0.92);font-family:system-ui,sans-serif;cursor:pointer;user-select:none;" onclick="window.close()">
        <div style="text-align:center;animation:fadeIn 0.2s ease-out">
          <div style="font-size:140px;font-weight:800;color:#2A7FFF;line-height:1">${i + 1}</div>
          <div style="font-size:24px;color:#8B949E;margin-top:16px">${name}</div>
          <div style="font-size:16px;color:#484F58;margin-top:6px">${d.bounds.width} × ${d.bounds.height}</div>
          <div style="font-size:14px;color:#484F58;margin-top:24px">Click anywhere to dismiss</div>
        </div>
        <style>@keyframes fadeIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}</style>
      </body></html>
    `;

    overlay.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    // When any overlay is closed, close all of them
    overlay.on('closed', () => {
      closeIdentifyOverlays();
    });

    identifyOverlays.push(overlay);
  }
}

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
  const icon = nativeImage.createFromPath(path.join(__dirname, '../../build/icon.png'));
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

  // Open external URLs in default browser
  ipcMain.handle('open-external', (_event, url: string) => {
    if (url.startsWith('https://')) return shell.openExternal(url);
  });

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

  // Automation: recording & playback
  ipcMain.handle(IPC.START_RECORDING, (_event, zone, monitors) => {
    return startRecording(zone, monitors);
  });
  ipcMain.handle(IPC.STOP_RECORDING, () => {
    return stopRecording();
  });
  ipcMain.handle(IPC.PLAY_ACTIONS, async (_event, actions, zone, monitors) => {
    return playActions(actions, zone, monitors);
  });

  // Elevation check
  ipcMain.handle(IPC.IS_ELEVATED, () => {
    return isProcessElevated();
  });

  // Monitor identification
  ipcMain.handle(IPC.IDENTIFY_MONITOR, () => {
    identifyMonitors();
  });

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

import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/types';

contextBridge.exposeInMainWorld('moncom', {
  // Monitor detection
  getMonitors: () => ipcRenderer.invoke(IPC.GET_MONITORS),

  // Window management
  launchZone: (zone: any) => ipcRenderer.invoke(IPC.LAUNCH_ZONE, zone),
  moveWindow: (windowTitle: string, x: number, y: number, w: number, h: number) =>
    ipcRenderer.invoke(IPC.MOVE_WINDOW, windowTitle, x, y, w, h),
  closeAllZones: () => ipcRenderer.invoke(IPC.CLOSE_ALL_ZONES),
  findWindows: () => ipcRenderer.invoke(IPC.FIND_WINDOWS),

  // Presets
  getPresets: () => ipcRenderer.invoke(IPC.GET_PRESETS),
  savePreset: (preset: any) => ipcRenderer.invoke(IPC.SAVE_PRESET, preset),
  deletePreset: (id: string) => ipcRenderer.invoke(IPC.DELETE_PRESET, id),

  // Settings
  getSettings: () => ipcRenderer.invoke(IPC.GET_SETTINGS),
  saveSettings: (settings: any) => ipcRenderer.invoke(IPC.SAVE_SETTINGS, settings),

  // Apply preset (launch all zones)
  applyPreset: (preset: any) => ipcRenderer.invoke(IPC.APPLY_PRESET, preset),

  // File picker
  pickExecutable: () => ipcRenderer.invoke('pick-executable'),

  // Window controls
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
});

import { IpcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { IPC } from '../shared/types';
import type { Preset, AppSettings } from '../shared/types';

function getDataDir(): string {
  const dir = path.join(app.getPath('userData'), 'moncom-data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getPresetsPath(): string {
  return path.join(getDataDir(), 'presets.json');
}

function getSettingsPath(): string {
  return path.join(getDataDir(), 'settings.json');
}

export function loadPresets(): Preset[] {
  try {
    const data = fs.readFileSync(getPresetsPath(), 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function savePresets(presets: Preset[]): void {
  fs.writeFileSync(getPresetsPath(), JSON.stringify(presets, null, 2));
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  launchOnStartup: false,
  minimizeToTray: true,
  autoLaunchPreset: false,
  autoLaunchPresetId: null,
  runAsAdmin: false,
  hotkeys: {},
};

export function loadSettings(): AppSettings {
  try {
    const data = fs.readFileSync(getSettingsPath(), 'utf-8');
    const saved = JSON.parse(data);
    // Merge with defaults so new fields added in future versions get their defaults
    // while existing user values are preserved
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettingsFile(settings: AppSettings): void {
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2));
}

export function registerPresetHandlers(ipcMain: IpcMain) {
  ipcMain.handle(IPC.GET_PRESETS, () => loadPresets());

  ipcMain.handle(IPC.SAVE_PRESET, (_event, preset: Preset) => {
    const presets = loadPresets();
    const idx = presets.findIndex(p => p.id === preset.id);
    if (idx >= 0) {
      presets[idx] = preset;
    } else {
      presets.push(preset);
    }
    savePresets(presets);
    return presets;
  });

  ipcMain.handle(IPC.DELETE_PRESET, (_event, id: string) => {
    const presets = loadPresets().filter(p => p.id !== id);
    savePresets(presets);
    return presets;
  });

  ipcMain.handle(IPC.GET_SETTINGS, () => loadSettings());

  ipcMain.handle(IPC.SAVE_SETTINGS, (_event, settings: AppSettings) => {
    saveSettingsFile(settings);
    return settings;
  });
}

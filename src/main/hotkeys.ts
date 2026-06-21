import { app, globalShortcut, screen, IpcMain } from 'electron';
import { IPC } from '../shared/types';
import { loadSettings, loadPresets } from './preset-store';
import { applyPresetFromMain } from './window-manager';

/** An accelerator that could not be registered (already taken by Windows or another app). */
export interface HotkeyConflict {
  presetId: string;
  accelerator: string;
}

export interface HotkeyReport {
  failed: HotkeyConflict[];
}

/**
 * (Re)register all global shortcuts from settings.hotkeys (presetId -> accelerator).
 *
 * Clears everything first, then binds each accelerator to apply its preset. The
 * preset is looked up fresh at trigger time so edits to a preset's layout take
 * effect without re-binding. Returns the accelerators that failed to register so
 * the UI can flag conflicts.
 */
export function registerHotkeys(): HotkeyReport {
  globalShortcut.unregisterAll();

  const { hotkeys } = loadSettings();
  const presets = loadPresets();
  const failed: HotkeyConflict[] = [];

  for (const [presetId, accelerator] of Object.entries(hotkeys || {})) {
    if (!accelerator) continue;
    // Skip bindings whose preset was deleted.
    if (!presets.some((p) => p.id === presetId)) continue;

    try {
      const ok = globalShortcut.register(accelerator, () => {
        const preset = loadPresets().find((p) => p.id === presetId);
        if (!preset) return;
        applyPresetFromMain(preset, screen).catch((err) =>
          console.error('[MonCOM] Hotkey apply failed:', err),
        );
      });
      if (!ok) failed.push({ presetId, accelerator });
    } catch {
      // register() throws on a malformed accelerator string.
      failed.push({ presetId, accelerator });
    }
  }

  return { failed };
}

export function unregisterAllHotkeys(): void {
  globalShortcut.unregisterAll();
}

export function registerHotkeyHandlers(ipcMain: IpcMain): void {
  // Called by the renderer after it saves a hotkey change.
  ipcMain.handle(IPC.REGISTER_HOTKEYS, () => registerHotkeys());
}

// Free shortcuts on quit so they don't linger if the process is replaced.
app.on('will-quit', () => globalShortcut.unregisterAll());

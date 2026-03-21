import type { MonitorInfo, Preset, AppSettings, Zone, AutomationAction } from '../shared/types';

export interface MonCOMAPI {
  getMonitors(): Promise<MonitorInfo[]>;
  launchZone(zone: Zone, monitors: MonitorInfo[]): Promise<boolean>;
  moveWindow(title: string, x: number, y: number, w: number, h: number): Promise<boolean>;
  closeAllZones(): Promise<boolean>;
  findWindows(): Promise<{ title: string; pid: number }[]>;
  getPresets(): Promise<Preset[]>;
  savePreset(preset: Preset): Promise<Preset[]>;
  deletePreset(id: string): Promise<Preset[]>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<AppSettings>;
  applyPreset(preset: Preset): Promise<boolean>;
  pickExecutable(): Promise<string | null>;
  startRecording(zone: Zone, monitors: MonitorInfo[]): Promise<boolean>;
  stopRecording(): Promise<AutomationAction[]>;
  playActions(actions: AutomationAction[], zone: Zone, monitors: MonitorInfo[]): Promise<boolean>;
  openExternal(url: string): Promise<void>;
  windowMinimize(): void;
  windowMaximize(): void;
  windowClose(): void;
}

declare global {
  interface Window {
    moncom: MonCOMAPI;
  }
}

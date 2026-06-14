import type {
  ApplyPresetResult,
  AppProfile,
  AppSettings,
  AutomationAction,
  CloseAllZonesReport,
  LaunchZoneResult,
  MonitorInfo,
  Preset,
  Zone,
} from '../shared/types';

export interface ProfileEntry {
  profile: AppProfile;
  bundled: boolean;
}

export interface MonCOMAPI {
  getMonitors(): Promise<MonitorInfo[]>;
  launchZone(zone: Zone, monitors: MonitorInfo[]): Promise<LaunchZoneResult>;
  moveWindow(title: string, x: number, y: number, w: number, h: number): Promise<boolean>;
  closeAllZones(): Promise<CloseAllZonesReport>;
  findWindows(): Promise<{ title: string; pid: number; exe: string; className: string }[]>;
  getPresets(): Promise<Preset[]>;
  savePreset(preset: Preset): Promise<Preset[]>;
  deletePreset(id: string): Promise<Preset[]>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<AppSettings>;
  applyPreset(preset: Preset): Promise<ApplyPresetResult>;
  pickExecutable(): Promise<string | null>;
  startRecording(zone: Zone, monitors: MonitorInfo[]): Promise<boolean>;
  stopRecording(): Promise<AutomationAction[]>;
  playActions(actions: AutomationAction[], zone: Zone, monitors: MonitorInfo[]): Promise<boolean>;
  isElevated(): Promise<boolean>;
  identifyMonitors(): Promise<void>;
  hasLaunchedWindows(): Promise<boolean>;
  getProfiles(): Promise<ProfileEntry[]>;
  saveProfile(profile: AppProfile): Promise<ProfileEntry[]>;
  deleteProfile(id: string): Promise<ProfileEntry[]>;
  openProfilesFolder(): Promise<string>;
  openExternal(url: string): Promise<void>;
  windowMinimize(): void;
  windowMaximize(): void;
  windowClose(): void;
}

declare global {
  // Injected at build time via Vite/esbuild `define` from package.json version.
  // Must live inside `declare global` because this file is a module (it imports
  // types), so a bare top-level `declare const` would be module-scoped, not global.
  const __APP_VERSION__: string;
  interface Window {
    moncom: MonCOMAPI;
  }
}

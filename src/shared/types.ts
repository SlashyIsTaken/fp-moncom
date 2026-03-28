/** Represents a physical monitor detected by the system */
export interface MonitorInfo {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
  isPrimary: boolean;
}

/** A zone is a rectangular region within a monitor where content is displayed */
export interface Zone {
  id: string;
  monitorId: string;
  /** Position relative to the monitor's top-left (0-1 normalized) */
  x: number;
  y: number;
  width: number;
  height: number;
  content: ZoneContent | null;
}

/** A recorded automation action to replay after zone content launches */
export interface AutomationAction {
  type: 'click' | 'right-click' | 'key' | 'type';
  /** X position relative to zone (0-1), for click actions */
  x?: number;
  /** Y position relative to zone (0-1), for click actions */
  y?: number;
  /** Virtual key code, for key actions */
  vkCode?: number;
  /** Text to type, for type actions */
  text?: string;
  /** Delay in ms before this action executes */
  delay: number;
}

/** Content that can be assigned to a zone */
export interface ZoneContent {
  type: 'url' | 'application';
  /** URL to open or path to executable */
  target: string;
  /** Display name */
  label: string;
  /** Whether to open in kiosk/borderless mode */
  kiosk?: boolean;
  /** Extra delay in ms to wait after content launches before playing automation (default 0) */
  launchDelay?: number;
  /** Recorded automation actions to replay after launch */
  actions?: AutomationAction[];
}

/** A layout defines how monitors are split into zones */
export interface Layout {
  id: string;
  zones: Zone[];
}

/** A preset is a named, saveable configuration */
export interface Preset {
  id: string;
  name: string;
  icon?: string;
  layout: Layout;
  createdAt: string;
  updatedAt: string;
}

/** Application settings */
export interface AppSettings {
  theme: 'dark';
  launchOnStartup: boolean;
  minimizeToTray: boolean;
  autoLaunchPreset: boolean;
  autoLaunchPresetId: string | null;
  /** Launch MonCOM with administrator privileges (needed for apps that require elevation) */
  runAsAdmin: boolean;
  hotkeys: Record<string, string>;
}

/** IPC channel names */
export const IPC = {
  GET_MONITORS: 'get-monitors',
  APPLY_PRESET: 'apply-preset',
  LAUNCH_ZONE: 'launch-zone',
  CLOSE_ALL_ZONES: 'close-all-zones',
  GET_PRESETS: 'get-presets',
  SAVE_PRESET: 'save-preset',
  DELETE_PRESET: 'delete-preset',
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',
  MOVE_WINDOW: 'move-window',
  FIND_WINDOWS: 'find-windows',
  START_RECORDING: 'start-recording',
  STOP_RECORDING: 'stop-recording',
  PLAY_ACTIONS: 'play-actions',
  CHECK_ELEVATION: 'check-elevation',
  IS_ELEVATED: 'is-elevated',
  IDENTIFY_MONITOR: 'identify-monitor',
  HAS_LAUNCHED_WINDOWS: 'has-launched-windows',
} as const;

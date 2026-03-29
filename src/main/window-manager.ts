import { IpcMain, BrowserWindow, screen } from 'electron';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { IPC } from '../shared/types';
import type { Zone, ZoneContent } from '../shared/types';
import { playActions } from './automation-manager';
import { loadSettings } from './preset-store';

const execAsync = promisify(exec);

/** Track launched Electron BrowserWindows (for URLs) */
const launchedWindows: BrowserWindow[] = [];

/** Track launched app PIDs (for executables) */
const launchedAppPIDs: Set<number> = new Set();

/** Win32 type definition for PowerShell — only needed for app window management */
const WIN32_TYPE = `
Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public class Win32 {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern int GetWindowTextLength(IntPtr hWnd);

  [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool SetForegroundWindow(IntPtr hWnd);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  [DllImport("dwmapi.dll")]
  public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out bool pvAttribute, int cbAttribute);

  public static List<IntPtr> GetVisibleWindows() {
    var windows = new List<IntPtr>();
    EnumWindows((hWnd, lParam) => {
      if (IsWindowVisible(hWnd) && GetWindowTextLength(hWnd) > 0) {
        bool isCloaked = false;
        DwmGetWindowAttribute(hWnd, 14, out isCloaked, Marshal.SizeOf(typeof(bool)));
        if (!isCloaked) {
          windows.Add(hWnd);
        }
      }
      return true;
    }, IntPtr.Zero);
    return windows;
  }
}
"@
`;

/**
 * Run a PowerShell script via stdin.
 */
function runPS(script: string, timeout = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '-'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('PowerShell timeout'));
    }, timeout);

    child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(`PowerShell exit ${code}: ${stderr.trim()}`));
      } else {
        resolve(stdout.trim());
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.stdin.write(script);
    child.stdin.end();
  });
}

// ─── URL zones: use Electron BrowserWindow ───

/**
 * Launch a URL in a frameless Electron BrowserWindow positioned exactly on the target zone.
 * No PID/HWND detection needed — we own the window.
 */
function launchURLZone(url: string, x: number, y: number, w: number, h: number): void {
  const win = new BrowserWindow({
    x, y,
    width: w,
    height: h,
    frame: false,
    thickFrame: false,
    resizable: false,
    minimizable: true,
    maximizable: false,
    skipTaskbar: false,
    alwaysOnTop: false,
    enableLargerThanScreen: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Force exact bounds — Windows can adjust the initial position
  win.setBounds({ x, y, width: w, height: h });

  const actual = win.getBounds();
  console.log(`[MonCOM] Requested bounds: (${x}, ${y}, ${w}, ${h})`);
  console.log(`[MonCOM] Actual bounds:    (${actual.x}, ${actual.y}, ${actual.width}, ${actual.height})`);

  const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  win.loadURL(normalizedUrl);
  win.removeMenu();

  // Hide scrollbars once page loads
  win.webContents.on('did-finish-load', () => {
    win.webContents.insertCSS(`
      ::-webkit-scrollbar { display: none !important; }
      html, body { overflow: hidden !important; }
    `);
  });
  // Also inject on navigation within the page
  win.webContents.on('did-navigate', () => {
    win.webContents.insertCSS(`
      ::-webkit-scrollbar { display: none !important; }
      html, body { overflow: hidden !important; }
    `);
  });

  launchedWindows.push(win);

  win.on('closed', () => {
    const idx = launchedWindows.indexOf(win);
    if (idx >= 0) launchedWindows.splice(idx, 1);
  });

  console.log(`[MonCOM] Opened URL zone: ${url} at (${x}, ${y}, ${w}, ${h})`);
}

// ─── App zones: launch exe + move via Win32 ───

/**
 * Get all visible HWNDs as a Set of strings.
 */
async function getVisibleHWNDs(): Promise<Set<string>> {
  const ps = `
${WIN32_TYPE}
$windows = [Win32]::GetVisibleWindows()
if ($windows.Count -eq 0) {
  Write-Output "[]"
} else {
  $arr = $windows | ForEach-Object { $_.ToInt64() }
  $arr | ConvertTo-Json -Compress
}
`;
  try {
    const stdout = await runPS(ps);
    if (!stdout || stdout === '[]') return new Set();
    const data = JSON.parse(stdout);
    const arr: number[] = Array.isArray(data) ? data : [data];
    return new Set(arr.map(h => h.toString()));
  } catch (e) {
    console.error('[MonCOM] getVisibleHWNDs failed:', e);
    return new Set();
  }
}

/**
 * Move a window by HWND.
 */
async function moveWindowByHWND(hwnd: string, x: number, y: number, width: number, height: number): Promise<boolean> {
  const ps = `
${WIN32_TYPE}
$h = [IntPtr]::new(${hwnd})
[Win32]::ShowWindow($h, 9) | Out-Null
[Win32]::MoveWindow($h, ${x}, ${y}, ${width}, ${height}, $true) | Out-Null
[Win32]::SetForegroundWindow($h) | Out-Null
Write-Output "OK"
`;
  try {
    const result = await runPS(ps);
    return result.includes('OK');
  } catch (e) {
    console.error(`[MonCOM] moveWindowByHWND(${hwnd}) failed:`, e);
    return false;
  }
}

/**
 * Move a window by partial title match.
 */
async function moveWindowByTitle(titleHint: string, x: number, y: number, width: number, height: number): Promise<boolean> {
  const safe = titleHint.replace(/'/g, "''");
  const ps = `
${WIN32_TYPE}
$windows = [Win32]::GetVisibleWindows()
foreach ($h in $windows) {
  $len = [Win32]::GetWindowTextLength($h)
  if ($len -gt 0) {
    $sb = New-Object System.Text.StringBuilder($len + 1)
    [Win32]::GetWindowText($h, $sb, $sb.Capacity) | Out-Null
    $title = $sb.ToString()
    if ($title -like '*${safe}*') {
      [Win32]::ShowWindow($h, 9) | Out-Null
      [Win32]::MoveWindow($h, ${x}, ${y}, ${width}, ${height}, $true) | Out-Null
      [Win32]::SetForegroundWindow($h) | Out-Null
      Write-Output "OK"
      return
    }
  }
}
Write-Output "NOT_FOUND"
`;
  try {
    const result = await runPS(ps);
    return result.includes('OK');
  } catch {
    return false;
  }
}

/**
 * Launch an application and try to position its window.
 */
async function launchAppZone(target: string, label: string | undefined, x: number, y: number, w: number, h: number): Promise<void> {
  // Snapshot HWNDs before launch
  const hwndsBefore = await getVisibleHWNDs();
  console.log(`[MonCOM] Launching app: ${target} (${hwndsBefore.size} existing windows)`);

  try {
    const settings = loadSettings();
    if (settings.runAsAdmin) {
      // Use PowerShell Start-Process with -Verb RunAs for elevated launch
      const child = spawn('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-Command',
        `Start-Process -FilePath '${target.replace(/'/g, "''")}' -Verb RunAs`,
      ], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.unref();
    } else {
      const child = spawn('cmd.exe', ['/c', 'start', '', target], {
        detached: true,
        stdio: 'ignore',
        shell: false,
      });
      child.unref();
    }
  } catch (e) {
    console.error('[MonCOM] App launch failed:', e);
    return;
  }

  // Poll for new window (every 500ms, up to 8 seconds)
  let newHWNDs: string[] = [];
  for (let attempt = 0; attempt < 16; attempt++) {
    await new Promise(r => setTimeout(r, 500));
    const hwndsAfter = await getVisibleHWNDs();
    newHWNDs = [];
    for (const hwnd of hwndsAfter) {
      if (!hwndsBefore.has(hwnd)) newHWNDs.push(hwnd);
    }
    if (newHWNDs.length > 0) {
      console.log(`[MonCOM] Found ${newHWNDs.length} new app window(s) after ${(attempt + 1) * 500}ms`);
      break;
    }
  }

  if (newHWNDs.length > 0) {
    for (const hwnd of newHWNDs) {
      console.log(`[MonCOM] Moving app HWND ${hwnd}`);
      const moved = await moveWindowByHWND(hwnd, x, y, w, h);
      console.log(`[MonCOM] Move result: ${moved}`);
      if (moved) return;
    }
  }

  // Fallback: title match using label or exe name
  const hints: string[] = [];
  if (label) hints.push(label);
  // Extract exe name without extension
  const parts = target.replace(/\\/g, '/').split('/');
  const exeName = parts[parts.length - 1]?.replace(/\.exe$/i, '');
  if (exeName) hints.push(exeName);

  for (const hint of hints) {
    console.log(`[MonCOM] App fallback: title match "${hint}"`);
    const result = await moveWindowByTitle(hint, x, y, w, h);
    if (result) {
      console.log(`[MonCOM] App title match succeeded for "${hint}"`);
      return;
    }
  }
  console.log('[MonCOM] App positioning failed');
}

// ─── Main orchestration ───

/**
 * Launch a zone's content and position it.
 */
async function launchZoneContent(zone: Zone, monitors: any[]): Promise<void> {
  if (!zone.content) return;
  const content = zone.content;

  const monitor = monitors.find((m: any) => m.id === zone.monitorId);
  if (!monitor) {
    console.error(`[MonCOM] Monitor not found: ${zone.monitorId}`);
    return;
  }

  const absX = Math.round(monitor.x + zone.x * monitor.width);
  const absY = Math.round(monitor.y + zone.y * monitor.height);
  const absW = Math.round(zone.width * monitor.width);
  const absH = Math.round(zone.height * monitor.height);

  console.log(`[MonCOM] Zone: ${content.type} "${content.target}" → (${absX}, ${absY}, ${absW}, ${absH})`);

  if (content.type === 'url') {
    launchURLZone(content.target, absX, absY, absW, absH);
  } else if (content.type === 'application') {
    await launchAppZone(content.target, content.label, absX, absY, absW, absH);
  }

  // Play automation actions if configured
  if (content.actions && content.actions.length > 0) {
    // Wait for content to load, then add any configured extra buffer
    await new Promise(r => setTimeout(r, 1500));
    const extraDelay = content.launchDelay ?? 0;
    if (extraDelay > 0) {
      console.log(`[MonCOM] Waiting extra ${extraDelay}ms buffer for content to settle`);
      await new Promise(r => setTimeout(r, extraDelay));
    }
    console.log(`[MonCOM] Playing ${content.actions.length} automation actions`);
    await playActions(content.actions, zone, monitors);
  }
}

/**
 * Close all launched zones.
 */
async function closeAllZones(): Promise<void> {
  // Close Electron windows
  for (const win of [...launchedWindows]) {
    if (!win.isDestroyed()) win.close();
  }
  launchedWindows.length = 0;

  // Kill tracked app PIDs
  for (const pid of launchedAppPIDs) {
    try {
      await execAsync(`taskkill /PID ${pid} /F /T`, { shell: 'cmd.exe' });
    } catch {}
  }
  launchedAppPIDs.clear();
}

/**
 * Get list of open windows with titles.
 */
async function findWindows(): Promise<{ title: string; pid: number }[]> {
  const ps = `Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object Id, MainWindowTitle | ConvertTo-Json`;
  try {
    const { stdout } = await execAsync(`powershell -NoProfile -Command "${ps}"`, { timeout: 5000 });
    const data = JSON.parse(stdout);
    const arr = Array.isArray(data) ? data : [data];
    return arr.map((p: any) => ({ title: p.MainWindowTitle, pid: p.Id }));
  } catch {
    return [];
  }
}

function hasLaunchedWindows(): boolean {
  const hasElectronWindows = launchedWindows.some(w => !w.isDestroyed());
  return hasElectronWindows || launchedAppPIDs.size > 0;
}

export function registerWindowHandlers(ipcMain: IpcMain) {
  ipcMain.handle(IPC.LAUNCH_ZONE, async (_event, zone: Zone, monitors: any[]) => {
    await launchZoneContent(zone, monitors);
    return true;
  });

  ipcMain.handle(IPC.MOVE_WINDOW, async (_event, titleHint: string, x: number, y: number, w: number, h: number) => {
    return moveWindowByTitle(titleHint, x, y, w, h);
  });

  ipcMain.handle(IPC.CLOSE_ALL_ZONES, async () => {
    await closeAllZones();
    return true;
  });

  ipcMain.handle(IPC.FIND_WINDOWS, async () => {
    return findWindows();
  });

  ipcMain.handle(IPC.APPLY_PRESET, async (_event, preset: any) => {
    return applyPresetFromMain(preset, screen);
  });

  ipcMain.handle(IPC.HAS_LAUNCHED_WINDOWS, () => {
    return hasLaunchedWindows();
  });
}

/**
 * Apply a preset directly from the main process (used by IPC and auto-launch).
 */
export async function applyPresetFromMain(preset: any, screenModule: Electron.Screen): Promise<boolean> {
  const displays = screenModule.getAllDisplays();
  const monitors = displays.map((d, i) => ({
    id: `monitor-${d.id}`,
    x: d.bounds.x,
    y: d.bounds.y,
    width: d.bounds.width,
    height: d.bounds.height,
  }));

  for (const zone of preset.layout.zones) {
    if (zone.content) {
      await launchZoneContent(zone, monitors);
    }
  }
  return true;
}

import { IpcMain, BrowserWindow, screen } from 'electron';
import { exec, execSync, spawn } from 'child_process';
import { promisify } from 'util';
import { IPC } from '../shared/types';
import type { ApplyPresetResult, CloseAllZonesReport, LaunchZoneResult, Zone } from '../shared/types';
import { playActions } from './automation-manager';
import { loadSettings } from './preset-store';

function isProcessElevated(): boolean {
  try { execSync('net session', { stdio: 'ignore' }); return true; }
  catch { return false; }
}

const execAsync = promisify(exec);

/** Track launched Electron BrowserWindows (for URLs) */
const launchedWindows: BrowserWindow[] = [];

/** Track launched app HWNDs (for executables — used to close them later) */
const launchedAppHWNDs: Set<string> = new Set();

type AppCloseResult = {
  hwnd: string;
  status: 'closed' | 'killed' | 'gone' | 'failed';
  reason?: string;
};

type VisibleWindowInfo = {
  hwnd: string;
  pid: number;
  processName: string;
  title: string;
};

/**
 * Run a PowerShell command passed as an argument (not stdin).
 */
function runPS(script: string, timeout = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
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
      if (stderr.trim()) {
        console.error(`[MonCOM] PowerShell stderr: ${stderr.trim()}`);
      }
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

  // Hide scrollbars visually but keep scrolling functional
  const scrollbarCSS = `::-webkit-scrollbar { display: none !important; }
    html, body { scrollbar-width: none !important; }`;
  win.webContents.on('did-finish-load', () => { win.webContents.insertCSS(scrollbarCSS); });
  win.webContents.on('did-navigate', () => { win.webContents.insertCSS(scrollbarCSS); });

  launchedWindows.push(win);

  win.on('closed', () => {
    const idx = launchedWindows.indexOf(win);
    if (idx >= 0) launchedWindows.splice(idx, 1);
  });

  console.log(`[MonCOM] Opened URL zone: ${url} at (${x}, ${y}, ${w}, ${h})`);
}

// ─── App zones: launch exe + move via Win32 ───

/**
 * Get all visible window MainWindowHandles via Get-Process (pure PowerShell, no Add-Type).
 */
async function getVisibleWindows(): Promise<VisibleWindowInfo[]> {
  const ps = `Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -ne '' } | Select-Object @{Name='Hwnd';Expression={$_.MainWindowHandle.ToInt64()}}, Id, ProcessName, MainWindowTitle | ConvertTo-Json -Compress`;
  try {
    const stdout = await runPS(ps);
    console.log(`[MonCOM] getVisibleWindows raw output: "${stdout.substring(0, 200)}"`);
    if (!stdout || stdout === '[]') return [];
    const data = JSON.parse(stdout);
    const arr: any[] = Array.isArray(data) ? data : [data];
    return arr.map((entry: any) => ({
      hwnd: String(entry.Hwnd),
      pid: Number(entry.Id ?? 0),
      processName: String(entry.ProcessName ?? ''),
      title: String(entry.MainWindowTitle ?? ''),
    }));
  } catch (e) {
    console.error('[MonCOM] getVisibleWindows failed:', e);
    return [];
  }
}

/**
 * Move a window by title match using PowerShell UIAutomation-free approach.
 * Uses Get-Process to find, then .NET interop inline for MoveWindow only.
 */
async function moveWindowByTitle(titleHint: string, x: number, y: number, width: number, height: number): Promise<boolean> {
  const safe = titleHint.replace(/'/g, "''").replace(/"/g, '`"');
  // Compensate for Windows 10/11 invisible DWM borders (~8px on left/right/bottom)
  const border = 8;
  const ax = x - border;
  const ay = y;
  const aw = width + border * 2;
  const ah = height + border;
  const ps = `
$p = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like '*${safe}*' } | Select-Object -First 1
if ($p) {
  $hwnd = $p.MainWindowHandle
  $sig = '[DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int ht, bool r);'
  $sig2 = '[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);'
  $sig3 = '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);'
  $t = Add-Type -MemberDefinition ($sig + $sig2 + $sig3) -Name WinMove -Namespace MonCOM -PassThru -ErrorAction SilentlyContinue
  if (-not $t) { $t = [MonCOM.WinMove] }
  $t::ShowWindow($hwnd, 9) | Out-Null
  $t::MoveWindow($hwnd, ${ax}, ${ay}, ${aw}, ${ah}, $true) | Out-Null
  $t::SetForegroundWindow($hwnd) | Out-Null
  Write-Output "OK:$($p.MainWindowTitle)"
} else {
  Write-Output "NOT_FOUND"
}
`;
  try {
    const result = await runPS(ps);
    console.log(`[MonCOM] moveWindowByTitle("${titleHint}"): ${result}`);
    return result.includes('OK');
  } catch (e) {
    console.error(`[MonCOM] moveWindowByTitle("${titleHint}") failed:`, e);
    return false;
  }
}

/**
 * Move a window by HWND.
 */
async function moveWindowByHWND(hwnd: string, x: number, y: number, width: number, height: number): Promise<boolean> {
  // Compensate for Windows 10/11 invisible DWM borders (~8px on left/right/bottom)
  const border = 8;
  const ax = x - border;
  const ay = y;
  const aw = width + border * 2;
  const ah = height + border;
  const ps = `
$sig = '[DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int ht, bool r);'
$sig2 = '[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);'
$sig3 = '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);'
$t = Add-Type -MemberDefinition ($sig + $sig2 + $sig3) -Name WinMoveH -Namespace MonCOM -PassThru -ErrorAction SilentlyContinue
if (-not $t) { $t = [MonCOM.WinMoveH] }
$h = [IntPtr]::new(${hwnd})
$t::ShowWindow($h, 9) | Out-Null
$t::MoveWindow($h, ${ax}, ${ay}, ${aw}, ${ah}, $true) | Out-Null
$t::SetForegroundWindow($h) | Out-Null
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
 * Launch an application and try to position its window.
 */
async function launchAppZone(
  target: string,
  label: string | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
): Promise<{ success: boolean; error?: string }> {
  // Snapshot windows before launch to detect "new window" vs "already-running/single-instance reuse".
  const windowsBefore = await getVisibleWindows();
  const hwndsBefore = new Set(windowsBefore.map(wi => wi.hwnd));
  console.log(`[MonCOM] Launching app: ${target} (${windowsBefore.length} existing windows)`);

  const parts = target.replace(/\\/g, '/').split('/');
  const exeName = (parts[parts.length - 1]?.replace(/\.(exe|lnk|bat|cmd)$/i, '') || '').toLowerCase();

  try {
    const settings = loadSettings();
    const elevated = isProcessElevated();

    if (settings.runAsAdmin && !elevated) {
      // MonCOM is not elevated but user wants admin launch — use RunAs (triggers UAC)
      const child = spawn('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-Command',
        `Start-Process -FilePath '${target.replace(/'/g, "''")}' -Verb RunAs`,
      ], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.unref();
      console.log('[MonCOM] Launched with RunAs (UAC prompt expected — MonCOM is not elevated)');
    } else {
      // Either runAsAdmin is off, or MonCOM is already elevated (child inherits elevation)
      const child = spawn('cmd.exe', ['/c', 'start', '', target], {
        detached: true,
        stdio: 'ignore',
        shell: false,
      });
      child.unref();
    }
  } catch (e) {
    console.error('[MonCOM] App launch failed:', e);
    return { success: false, error: `Application launch failed: ${target}` };
  }

  // Poll for new window (every 500ms, up to 16 seconds when RunAs is used to account for UAC delay)
  const settings = loadSettings();
  const maxAttempts = (settings.runAsAdmin && !isProcessElevated()) ? 32 : 16;
  let latestWindows: VisibleWindowInfo[] = windowsBefore;
  let newWindows: VisibleWindowInfo[] = [];
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, 500));
    latestWindows = await getVisibleWindows();
    newWindows = latestWindows.filter(win => !hwndsBefore.has(win.hwnd));
    if (newWindows.length > 0) {
      console.log(`[MonCOM] Found ${newWindows.length} new app window(s) after ${(attempt + 1) * 500}ms`);
      break;
    }
  }

  if (newWindows.length > 0) {
    for (const windowInfo of newWindows) {
      console.log(`[MonCOM] Moving new app HWND ${windowInfo.hwnd} (${windowInfo.processName})`);
      launchedAppHWNDs.add(windowInfo.hwnd);
      const moved = await moveWindowByHWND(windowInfo.hwnd, x, y, w, h);
      console.log(`[MonCOM] Move result: ${moved}`);
      if (moved) return { success: true };
    }
  }

  // Predictable single-instance strategy:
  // if no new HWND was detected, try to reuse a visible window belonging to the target process.
  if (exeName) {
    const candidates = latestWindows
      .filter(win => win.processName.toLowerCase() === exeName)
      .sort((a, b) => {
        const aWasPresentBeforeLaunch = hwndsBefore.has(a.hwnd) ? 0 : 1;
        const bWasPresentBeforeLaunch = hwndsBefore.has(b.hwnd) ? 0 : 1;
        if (aWasPresentBeforeLaunch !== bWasPresentBeforeLaunch) {
          return aWasPresentBeforeLaunch - bWasPresentBeforeLaunch;
        }
        return a.pid - b.pid || Number(a.hwnd) - Number(b.hwnd);
      });

    for (const candidate of candidates) {
      console.log(`[MonCOM] Reusing existing app window for single-instance flow: ${candidate.processName} (${candidate.hwnd})`);
      const moved = await moveWindowByHWND(candidate.hwnd, x, y, w, h);
      if (moved) {
        if (!hwndsBefore.has(candidate.hwnd)) {
          launchedAppHWNDs.add(candidate.hwnd);
        } else {
          console.log(`[MonCOM] Reused pre-existing HWND ${candidate.hwnd}; leaving it unmanaged for close-all.`);
        }
        return { success: true };
      }
    }
  }

  // Fallback: title match using label or exe name
  const hints: string[] = [];
  if (label) hints.push(label);
  if (exeName) hints.push(exeName);

  for (const hint of hints) {
    console.log(`[MonCOM] App fallback: title match "${hint}"`);
    const result = await moveWindowByTitle(hint, x, y, w, h);
    if (result) {
      console.log(`[MonCOM] App title match succeeded for "${hint}"`);
      return { success: true };
    }
  }
  console.log('[MonCOM] App positioning failed');
  return {
    success: false,
    error: `Application launched but MonCOM could not find/position its window: ${target}`,
  };
}

// ─── Main orchestration ───

/**
 * Launch a zone's content and position it.
 */
async function launchZoneContent(zone: Zone, monitors: any[]): Promise<LaunchZoneResult> {
  if (!zone.content) {
    return {
      success: false,
      zoneId: zone.id,
      error: 'Zone has no content assigned',
    };
  }
  const content = zone.content;

  const monitor = monitors.find((m: any) => m.id === zone.monitorId);
  if (!monitor) {
    console.error(`[MonCOM] Monitor not found: ${zone.monitorId}`);
    return {
      success: false,
      zoneId: zone.id,
      contentType: content.type,
      target: content.target,
      error: `Monitor not found for zone: ${zone.monitorId}`,
    };
  }

  const absX = Math.round(monitor.x + zone.x * monitor.width);
  const absY = Math.round(monitor.y + zone.y * monitor.height);
  const absW = Math.round(zone.width * monitor.width);
  const absH = Math.round(zone.height * monitor.height);

  console.log(`[MonCOM] Zone: ${content.type} "${content.target}" → (${absX}, ${absY}, ${absW}, ${absH})`);

  if (content.type === 'url') {
    launchURLZone(content.target, absX, absY, absW, absH);
  } else if (content.type === 'application') {
    const appLaunch = await launchAppZone(content.target, content.label, absX, absY, absW, absH);
    if (!appLaunch.success) {
      return {
        success: false,
        zoneId: zone.id,
        contentType: content.type,
        target: content.target,
        error: appLaunch.error ?? 'Application launch failed',
      };
    }
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
    const playbackOk = await playActions(content.actions, zone, monitors);
    if (!playbackOk) {
      return {
        success: false,
        zoneId: zone.id,
        contentType: content.type,
        target: content.target,
        error: 'Content launched but automation playback failed',
      };
    }
  }

  return {
    success: true,
    zoneId: zone.id,
    contentType: content.type,
    target: content.target,
  };
}

/**
 * Close a launched app window: send WM_CLOSE gracefully, then force-kill if it won't close.
 */
async function closeAppWindow(hwnd: string): Promise<AppCloseResult> {
  // 1) Send WM_CLOSE gracefully
  try {
    const result = await runPS(`
$sig = '[DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);'
$sig2 = '[DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);'
$sig3 = '[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);'
$t = Add-Type -MemberDefinition ($sig + $sig2 + $sig3) -Name WinClose -Namespace MonCOM -PassThru -ErrorAction SilentlyContinue
if (-not $t) { $t = [MonCOM.WinClose] }
$h = [IntPtr]::new(${hwnd})
if ($t::IsWindow($h)) {
  $t::PostMessage($h, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
  Start-Sleep -Milliseconds 1000
  if ($t::IsWindow($h)) {
    $pid = [uint32]0
    $t::GetWindowThreadProcessId($h, [ref]$pid) | Out-Null
    if ($pid -ne 0) { taskkill /PID $pid /F /T 2>$null }
    Write-Output "KILLED:$pid"
  } else { Write-Output "CLOSED" }
} else { Write-Output "GONE" }
`, 10000);

    if (result.startsWith('CLOSED')) {
      return { hwnd, status: 'closed' };
    }
    if (result.startsWith('KILLED:')) {
      return { hwnd, status: 'killed' };
    }
    if (result.startsWith('GONE')) {
      return { hwnd, status: 'gone' };
    }

    return {
      hwnd,
      status: 'failed',
      reason: `Unexpected close result: ${result}`,
    };
  } catch (e) {
    console.error(`[MonCOM] closeAppWindow(${hwnd}) failed:`, e);
    return {
      hwnd,
      status: 'failed',
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Close all launched zones.
 */
async function closeAllZones(): Promise<CloseAllZonesReport> {
  const report: CloseAllZonesReport = {
    electronWindowsClosed: 0,
    appWindowsAttempted: launchedAppHWNDs.size,
    appWindowsClosedGracefully: 0,
    appWindowsForceKilled: 0,
    appWindowsAlreadyGone: 0,
    appWindowsFailed: [],
  };

  // Close Electron windows (URLs)
  for (const win of [...launchedWindows]) {
    if (!win.isDestroyed()) {
      win.close();
      report.electronWindowsClosed += 1;
    }
  }
  launchedWindows.length = 0;

  // Close tracked app windows (graceful then force)
  const closePromises = [...launchedAppHWNDs].map(hwnd => closeAppWindow(hwnd));
  const closeResults = await Promise.all(closePromises);
  for (const result of closeResults) {
    if (result.status === 'closed') report.appWindowsClosedGracefully += 1;
    else if (result.status === 'killed') report.appWindowsForceKilled += 1;
    else if (result.status === 'gone') report.appWindowsAlreadyGone += 1;
    else {
      report.appWindowsFailed.push({
        hwnd: result.hwnd,
        reason: result.reason ?? 'Unknown close failure',
      });
    }
  }
  launchedAppHWNDs.clear();
  return report;
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
  return hasElectronWindows || launchedAppHWNDs.size > 0;
}

export function registerWindowHandlers(ipcMain: IpcMain) {
  ipcMain.handle(IPC.LAUNCH_ZONE, async (_event, zone: Zone, monitors: any[]) => {
    return launchZoneContent(zone, monitors);
  });

  ipcMain.handle(IPC.MOVE_WINDOW, async (_event, titleHint: string, x: number, y: number, w: number, h: number) => {
    return moveWindowByTitle(titleHint, x, y, w, h);
  });

  ipcMain.handle(IPC.CLOSE_ALL_ZONES, async () => {
    return closeAllZones();
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
export async function applyPresetFromMain(preset: any, screenModule: Electron.Screen): Promise<ApplyPresetResult> {
  let closeReport: CloseAllZonesReport | undefined;
  // Close any existing launched windows first
  if (hasLaunchedWindows()) {
    closeReport = await closeAllZones();
  }

  const displays = screenModule.getAllDisplays();
  const monitors = displays.map((d, i) => ({
    id: `monitor-${d.id}`,
    x: d.bounds.x,
    y: d.bounds.y,
    width: d.bounds.width,
    height: d.bounds.height,
  }));

  const results: LaunchZoneResult[] = [];
  for (const zone of preset.layout.zones) {
    if (zone.content) {
      const launchResult = await launchZoneContent(zone, monitors);
      results.push(launchResult);
    }
  }
  const failedZones = results.filter(r => !r.success);
  const closeFailed = (closeReport?.appWindowsFailed.length ?? 0) > 0;

  return {
    success: failedZones.length === 0 && !closeFailed,
    results,
    failedZones,
    closeReport,
  };
}

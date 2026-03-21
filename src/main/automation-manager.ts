import { ChildProcess, spawn } from 'child_process';
import type { AutomationAction, Zone } from '../shared/types';

let recordingProcess: ChildProcess | null = null;
let recordedActions: AutomationAction[] = [];

/** Calculate absolute pixel bounds for a zone given its monitor info */
function getZoneBounds(zone: Zone, monitors: any[]): { x: number; y: number; w: number; h: number } {
  const monitor = monitors.find((m: any) => m.id === zone.monitorId);
  if (!monitor) throw new Error(`Monitor not found: ${zone.monitorId}`);
  return {
    x: Math.round(monitor.x + zone.x * monitor.width),
    y: Math.round(monitor.y + zone.y * monitor.height),
    w: Math.round(zone.width * monitor.width),
    h: Math.round(zone.height * monitor.height),
  };
}

/**
 * Run a PowerShell script via stdin and return stdout.
 */
function runPS(script: string, timeout = 30000): Promise<string> {
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

// ─── C# type for input recording (global mouse + keyboard hooks) ───

const RECORDER_TYPE = `
Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public class InputRecorder {
    private const int WH_MOUSE_LL = 14;
    private const int WH_KEYBOARD_LL = 13;
    private const int WM_LBUTTONDOWN = 0x0201;
    private const int WM_RBUTTONDOWN = 0x0204;
    private const int WM_KEYDOWN = 0x0100;

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int x; public int y; }

    [StructLayout(LayoutKind.Sequential)]
    public struct MSLLHOOKSTRUCT {
        public POINT pt;
        public uint mouseData;
        public uint flags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct KBDLLHOOKSTRUCT {
        public uint vkCode;
        public uint scanCode;
        public uint flags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MSG {
        public IntPtr hwnd;
        public uint message;
        public IntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public POINT pt;
    }

    public delegate IntPtr LowLevelProc(int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr SetWindowsHookEx(int idHook, LowLevelProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll")]
    public static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll")]
    public static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll")]
    public static extern IntPtr GetModuleHandle(string lpModuleName);

    [DllImport("user32.dll")]
    public static extern bool GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT lpPoint);

    private static IntPtr mouseHook = IntPtr.Zero;
    private static IntPtr keyHook = IntPtr.Zero;
    private static LowLevelProc mouseDelegate;
    private static LowLevelProc keyDelegate;
    private static long lastEventTime;
    private static int bX, bY, bW, bH;

    private static bool InBounds(int px, int py) {
        return px >= bX && px < bX + bW && py >= bY && py < bY + bH;
    }

    private static void Emit(string json) {
        Console.WriteLine(json);
        Console.Out.Flush();
    }

    private static IntPtr MouseCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0) {
            int msg = wParam.ToInt32();
            if (msg == WM_LBUTTONDOWN || msg == WM_RBUTTONDOWN) {
                var info = Marshal.PtrToStructure<MSLLHOOKSTRUCT>(lParam);
                int px = info.pt.x;
                int py = info.pt.y;
                if (InBounds(px, py)) {
                    double relX = (double)(px - bX) / bW;
                    double relY = (double)(py - bY) / bH;
                    long now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                    long delay = now - lastEventTime;
                    lastEventTime = now;
                    string clickType = msg == WM_RBUTTONDOWN ? "right-click" : "click";
                    Emit("{\\"type\\":\\"" + clickType + "\\",\\"x\\":" + relX.ToString("F6") + ",\\"y\\":" + relY.ToString("F6") + ",\\"delay\\":" + delay + "}");
                }
            }
        }
        return CallNextHookEx(mouseHook, nCode, wParam, lParam);
    }

    private static IntPtr KeyCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0 && wParam.ToInt32() == WM_KEYDOWN) {
            POINT cursorPos;
            GetCursorPos(out cursorPos);
            if (InBounds(cursorPos.x, cursorPos.y)) {
                var info = Marshal.PtrToStructure<KBDLLHOOKSTRUCT>(lParam);
                long now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                long delay = now - lastEventTime;
                lastEventTime = now;
                Emit("{\\"type\\":\\"key\\",\\"vkCode\\":" + info.vkCode + ",\\"delay\\":" + delay + "}");
            }
        }
        return CallNextHookEx(keyHook, nCode, wParam, lParam);
    }

    public static void Start(int x, int y, int w, int h) {
        bX = x; bY = y; bW = w; bH = h;
        lastEventTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        mouseDelegate = new LowLevelProc(MouseCallback);
        keyDelegate = new LowLevelProc(KeyCallback);

        using (var proc = Process.GetCurrentProcess())
        using (var mod = proc.MainModule) {
            IntPtr hMod = GetModuleHandle(mod.ModuleName);
            mouseHook = SetWindowsHookEx(WH_MOUSE_LL, mouseDelegate, hMod, 0);
            keyHook = SetWindowsHookEx(WH_KEYBOARD_LL, keyDelegate, hMod, 0);
        }

        // Signal ready
        Emit("{\\"type\\":\\"ready\\"}");

        // Message pump — keeps hooks alive
        MSG msg;
        while (GetMessage(out msg, IntPtr.Zero, 0, 0)) { }
    }
}
"@
`;

// ─── C# type for input playback ───

const PLAYER_TYPE = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Threading;

public class InputPlayer {
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, IntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, IntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP = 0x0004;
    public const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    public const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    public const uint KEYEVENTF_KEYUP = 0x0002;
    public const uint KEYEVENTF_UNICODE = 0x0004;
    public const uint INPUT_KEYBOARD = 1;

    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT {
        public uint type;
        public INPUTUNION U;
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct INPUTUNION {
        [FieldOffset(0)] public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct KEYBDINPUT {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    public static void Click(int x, int y) {
        SetCursorPos(x, y);
        Thread.Sleep(30);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, IntPtr.Zero);
        Thread.Sleep(20);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, IntPtr.Zero);
    }

    public static void RightClick(int x, int y) {
        SetCursorPos(x, y);
        Thread.Sleep(30);
        mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, IntPtr.Zero);
        Thread.Sleep(20);
        mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, IntPtr.Zero);
    }

    public static void KeyPress(byte vk) {
        keybd_event(vk, 0, 0, IntPtr.Zero);
        Thread.Sleep(20);
        keybd_event(vk, 0, KEYEVENTF_KEYUP, IntPtr.Zero);
    }

    public static void TypeText(string text) {
        foreach (char c in text) {
            var inputs = new INPUT[2];

            inputs[0].type = INPUT_KEYBOARD;
            inputs[0].U.ki.wVk = 0;
            inputs[0].U.ki.wScan = c;
            inputs[0].U.ki.dwFlags = KEYEVENTF_UNICODE;

            inputs[1].type = INPUT_KEYBOARD;
            inputs[1].U.ki.wVk = 0;
            inputs[1].U.ki.wScan = c;
            inputs[1].U.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;

            SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
            Thread.Sleep(15);
        }
    }
}
"@
`;

// ─── Recording ───

/**
 * Start recording input events within a zone's bounds.
 * Returns true if recording started successfully.
 */
export function startRecording(zone: Zone, monitors: any[]): boolean {
  if (recordingProcess) {
    console.log('[MonCOM] Recording already in progress');
    return false;
  }

  const bounds = getZoneBounds(zone, monitors);
  recordedActions = [];

  const script = `${RECORDER_TYPE}\n[InputRecorder]::Start(${bounds.x}, ${bounds.y}, ${bounds.w}, ${bounds.h})`;

  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '-'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let buffer = '';

  child.stdout.on('data', (data: Buffer) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const event = JSON.parse(trimmed);
        if (event.type === 'ready') {
          console.log('[MonCOM] Recording started');
          continue;
        }
        // First real action gets delay set to 0
        if (recordedActions.length === 0) {
          event.delay = 0;
        }
        recordedActions.push(event as AutomationAction);
        console.log(`[MonCOM] Recorded: ${event.type} (${recordedActions.length} actions)`);
      } catch (e) {
        console.error('[MonCOM] Failed to parse recording event:', trimmed);
      }
    }
  });

  child.stderr.on('data', (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.error('[MonCOM] Recorder stderr:', msg);
  });

  child.on('close', (code) => {
    console.log(`[MonCOM] Recorder process exited with code ${code}`);
    recordingProcess = null;
  });

  child.on('error', (err) => {
    console.error('[MonCOM] Recorder process error:', err);
    recordingProcess = null;
  });

  child.stdin.write(script);
  child.stdin.end();

  recordingProcess = child;
  return true;
}

/**
 * Stop recording and return the captured actions.
 */
export function stopRecording(): AutomationAction[] {
  if (!recordingProcess) {
    console.log('[MonCOM] No recording in progress');
    return [];
  }

  recordingProcess.kill();
  recordingProcess = null;

  const actions = [...recordedActions];
  recordedActions = [];

  // Drop the last action if it's a click — that's the user clicking "Stop Recording"
  if (actions.length > 0) {
    const last = actions[actions.length - 1];
    if (last.type === 'click' || last.type === 'right-click') {
      actions.pop();
    }
  }

  console.log(`[MonCOM] Recording stopped, captured ${actions.length} actions`);
  return actions;
}

/**
 * Check if recording is currently active.
 */
export function isRecording(): boolean {
  return recordingProcess !== null;
}

// ─── Playback ───

/**
 * Build a PowerShell script that replays the given actions within the given bounds.
 */
function buildPlaybackScript(actions: AutomationAction[], bounds: { x: number; y: number; w: number; h: number }): string {
  const lines: string[] = [PLAYER_TYPE, ''];

  for (const action of actions) {
    if (action.delay > 0) {
      lines.push(`Start-Sleep -Milliseconds ${action.delay}`);
    }

    switch (action.type) {
      case 'click': {
        const absX = Math.round(bounds.x + (action.x || 0) * bounds.w);
        const absY = Math.round(bounds.y + (action.y || 0) * bounds.h);
        lines.push(`[InputPlayer]::Click(${absX}, ${absY})`);
        break;
      }
      case 'right-click': {
        const absX = Math.round(bounds.x + (action.x || 0) * bounds.w);
        const absY = Math.round(bounds.y + (action.y || 0) * bounds.h);
        lines.push(`[InputPlayer]::RightClick(${absX}, ${absY})`);
        break;
      }
      case 'key': {
        lines.push(`[InputPlayer]::KeyPress(${action.vkCode || 0})`);
        break;
      }
      case 'type': {
        const safe = (action.text || '').replace(/'/g, "''");
        lines.push(`[InputPlayer]::TypeText('${safe}')`);
        break;
      }
    }
  }

  lines.push('Write-Output "DONE"');
  return lines.join('\n');
}

/**
 * Play back a list of automation actions within a zone's bounds.
 */
export async function playActions(actions: AutomationAction[], zone: Zone, monitors: any[]): Promise<boolean> {
  if (!actions || actions.length === 0) return true;

  const bounds = getZoneBounds(zone, monitors);
  const script = buildPlaybackScript(actions, bounds);

  try {
    const result = await runPS(script, 120000); // 2 min timeout for long sequences
    console.log(`[MonCOM] Playback completed: ${result}`);
    return result.includes('DONE');
  } catch (e) {
    console.error('[MonCOM] Playback failed:', e);
    return false;
  }
}

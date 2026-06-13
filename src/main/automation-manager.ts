import { ChildProcess, spawn } from 'child_process';
import type { AutomationAction, KeyModifier, Zone } from '../shared/types';
import * as input from './input';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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
 * Play back automation actions within a zone's bounds using the native input
 * module. `startIndex` supports "test from step N" (skips earlier actions).
 */
export async function playActions(
  actions: AutomationAction[],
  zone: Zone,
  monitors: any[],
  startIndex = 0,
): Promise<boolean> {
  if (!actions || actions.length === 0) return true;
  const bounds = getZoneBounds(zone, monitors);

  try {
    for (let i = Math.max(0, startIndex); i < actions.length; i++) {
      const a = actions[i];
      if (a.delay > 0) await sleep(a.delay);

      const absX = Math.round(bounds.x + (a.x ?? 0) * bounds.w);
      const absY = Math.round(bounds.y + (a.y ?? 0) * bounds.h);

      switch (a.type) {
        case 'click':
        case 'right-click': {
          const button = a.type === 'right-click' ? 'right' : 'left';
          input.setCursorPos(absX, absY);
          await sleep(25);
          input.mouseButton(button, true);
          await sleep(20);
          input.mouseButton(button, false);
          break;
        }
        case 'scroll': {
          input.setCursorPos(absX, absY);
          input.mouseWheel(a.deltaY ?? 0);
          break;
        }
        case 'key': {
          input.keyTap(a.vkCode ?? 0, (a.modifiers ?? []) as KeyModifier[]);
          break;
        }
        case 'type': {
          input.typeText(a.text ?? '');
          break;
        }
      }
    }
    console.log('[MonCOM] Playback completed');
    return true;
  } catch (e) {
    console.error('[MonCOM] Playback failed:', e);
    return false;
  }
}

/**
 * Native input injection via koffi `SendInput`. Replaces the PowerShell + C#
 * `Add-Type` player in automation-manager.ts — no per-playback compile latency
 * on the unattended boot path, and clean support for modifier combos and scroll.
 *
 * Low-level primitives only; the player (automation-manager.ts) sequences them
 * with awaited delays.
 */
import koffi from 'koffi';

const user32 = koffi.load('user32.dll');

// INPUT is a tagged union; on x64 sizeof(INPUT) = 40 (DWORD type + 4 pad + 32 union).
const MOUSEINPUT = koffi.struct('MOUSEINPUT', {
  dx: 'long', dy: 'long', mouseData: 'uint32', dwFlags: 'uint32', time: 'uint32', dwExtraInfo: 'uintptr',
});
const KEYBDINPUT = koffi.struct('KEYBDINPUT', {
  wVk: 'uint16', wScan: 'uint16', dwFlags: 'uint32', time: 'uint32', dwExtraInfo: 'uintptr',
});
const INPUT_UNION = koffi.union('INPUT_UNION', { mi: MOUSEINPUT, ki: KEYBDINPUT });
const INPUT = koffi.struct('INPUT', { type: 'uint32', u: INPUT_UNION });
const INPUT_SIZE = koffi.sizeof(INPUT);

const SendInput = user32.func('uint32 SendInput(uint32 n, INPUT *inputs, int cbSize)');
const SetCursorPos = user32.func('bool SetCursorPos(int x, int y)');

// ── constants ──
const INPUT_MOUSE = 0;
const INPUT_KEYBOARD = 1;
const MOUSEEVENTF_LEFTDOWN = 0x0002;
const MOUSEEVENTF_LEFTUP = 0x0004;
const MOUSEEVENTF_RIGHTDOWN = 0x0008;
const MOUSEEVENTF_RIGHTUP = 0x0010;
const MOUSEEVENTF_WHEEL = 0x0800;
const WHEEL_DELTA = 120;
const KEYEVENTF_KEYUP = 0x0002;
const KEYEVENTF_UNICODE = 0x0004;

export type MouseButton = 'left' | 'right';
export type Modifier = 'ctrl' | 'alt' | 'shift' | 'win';

const MOD_VK: Record<Modifier, number> = { ctrl: 0x11, alt: 0x12, shift: 0x10, win: 0x5b };

function mouseInput(dwFlags: number, mouseData = 0) {
  return { type: INPUT_MOUSE, u: { mi: { dx: 0, dy: 0, mouseData: mouseData >>> 0, dwFlags, time: 0, dwExtraInfo: 0 } } };
}
function keyInput(wVk: number, wScan: number, dwFlags: number) {
  return { type: INPUT_KEYBOARD, u: { ki: { wVk, wScan, dwFlags, time: 0, dwExtraInfo: 0 } } };
}
function send(inputs: any[]): number {
  if (inputs.length === 0) return 0;
  return SendInput(inputs.length, inputs, INPUT_SIZE);
}

export function setCursorPos(x: number, y: number): void {
  SetCursorPos(Math.round(x), Math.round(y));
}

export function mouseButton(button: MouseButton, down: boolean): void {
  const flag = button === 'right'
    ? (down ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_RIGHTUP)
    : (down ? MOUSEEVENTF_LEFTDOWN : MOUSEEVENTF_LEFTUP);
  send([mouseInput(flag)]);
}

/** Scroll the wheel by `notches` (positive = up, negative = down) at the current cursor. */
export function mouseWheel(notches: number): void {
  send([mouseInput(MOUSEEVENTF_WHEEL, Math.round(notches) * WHEEL_DELTA)]);
}

/** Press and release a virtual key, optionally holding modifiers around it (e.g. Ctrl+T). */
export function keyTap(vkCode: number, modifiers: Modifier[] = []): void {
  const mods = modifiers.map((m) => MOD_VK[m]).filter((v) => v !== undefined);
  const seq: any[] = [];
  for (const m of mods) seq.push(keyInput(m, 0, 0));            // modifier down
  seq.push(keyInput(vkCode, 0, 0));                             // key down
  seq.push(keyInput(vkCode, 0, KEYEVENTF_KEYUP));              // key up
  for (const m of [...mods].reverse()) seq.push(keyInput(m, 0, KEYEVENTF_KEYUP)); // modifier up
  send(seq);
}

/** Type a unicode string via scan-code unicode events (layout-independent). */
export function typeText(text: string): void {
  // One SendInput per character (down+up). Larger batched arrays were observed to
  // corrupt under koffi's struct-array marshalling (tail elements repeated).
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    send([
      keyInput(0, code, KEYEVENTF_UNICODE),
      keyInput(0, code, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP),
    ]);
  }
}

/**
 * Runs an App Profile's launch recipe. This is the generic engine that makes the
 * DSS-style multi-window flow work without any app-specific code: step through
 * the profile, waiting for each window, optionally acting on it (click/key/wait)
 * and waiting for it to close, and return the window the recipe designates for
 * positioning. Built on the Phase 1 `waitForWindow` primitive + native input.
 */
import type { AppProfile, ProfileAction, WindowMatch, KeyModifier } from '../shared/types';
import { enumWindows, waitForWindow, isWindow, focusWindow, type WindowInfo, type WindowMatcher } from './win32';
import * as input from './input';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function matches(w: WindowInfo, m: WindowMatch): boolean {
  if (!m.exe && !m.titleContains && !m.className) return false; // empty matcher never matches
  if (m.exe && w.processName !== m.exe.toLowerCase()) return false;
  if (m.titleContains && !w.title.toLowerCase().includes(m.titleContains.toLowerCase())) return false;
  if (m.className && w.className.toLowerCase() !== m.className.toLowerCase()) return false;
  return true;
}

async function waitForClose(hwnd: number, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!isWindow(hwnd)) return;
    await sleep(250);
  }
}

async function runAction(act: ProfileAction, win: WindowInfo): Promise<void> {
  if (act.type === 'wait') {
    await sleep(act.ms ?? 0);
    return;
  }
  if (act.type === 'click') {
    // Re-read the window's current rect so clicks land correctly even if it moved.
    const fresh = enumWindows({ requireTitle: false }).find((w) => w.hwnd === win.hwnd) ?? win;
    const r = fresh.rect;
    const ax = Math.round(r.left + (act.x ?? 0.5) * (r.right - r.left));
    const ay = Math.round(r.top + (act.y ?? 0.5) * (r.bottom - r.top));
    input.setCursorPos(ax, ay);
    await sleep(25);
    const button = act.right ? 'right' : 'left';
    input.mouseButton(button, true);
    await sleep(20);
    input.mouseButton(button, false);
    return;
  }
  if (act.type === 'key') {
    input.keyTap(act.vkCode ?? 0, (act.modifiers ?? []) as KeyModifier[]);
  }
}

/**
 * Execute a profile against the window set present before the app launched.
 * Returns the window the recipe designated for positioning, or null.
 */
export async function runProfile(profile: AppProfile, before: Set<number>): Promise<WindowInfo | null> {
  const seen = new Set<number>(before); // windows already present or already handled
  let positionTarget: WindowInfo | null = null;

  for (const step of profile.steps) {
    const matcher: WindowMatcher = (w) => !seen.has(w.hwnd) && matches(w, step.waitFor);
    const win = await waitForWindow(matcher, { timeoutMs: step.timeoutMs ?? 15000, intervalMs: 250 });
    if (!win) {
      console.warn('[MonCOM] profile step waitFor timed out:', JSON.stringify(step.waitFor));
      if (step.optional) continue;
      break;
    }
    console.log(`[MonCOM] profile matched window hwnd=${win.hwnd} "${win.title}"`);
    seen.add(win.hwnd);
    if (step.position) positionTarget = win;

    if (step.do && step.do.length > 0) {
      focusWindow(win.hwnd);
      await sleep(150);
      for (const act of step.do) await runAction(act, win);
    }
    if (step.waitClose) await waitForClose(win.hwnd, step.timeoutMs ?? 15000);
  }
  return positionTarget;
}

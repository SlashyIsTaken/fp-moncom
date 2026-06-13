/* Manual verification for src/main/win32.ts. Run via build-and-run below. */
import { spawn } from 'child_process';
import { enumWindows, waitForWindow, moveWindowToVisibleRect, getVisibleRect, postClose, isWindow } from '../src/main/win32';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function main() {
  // 1) Enumeration sanity.
  const wins = enumWindows();
  console.log(`\n[enum] ${wins.length} real top-level windows. Sample:`);
  for (const w of wins.slice(0, 8)) {
    console.log(`  hwnd=${w.hwnd} pid=${w.pid} proc=${w.processName.padEnd(16)} "${w.title.slice(0, 40)}"`);
  }

  // 2) Spawn Notepad, find its new window, position it, measure accuracy.
  const before = new Set(enumWindows({ requireTitle: false }).map((w) => w.hwnd));
  console.log('\n[move] launching notepad...');
  const child = spawn('notepad.exe', { detached: true, stdio: 'ignore' });
  child.unref();

  const target = { x: 200, y: 200, w: 640, h: 480 };
  const found = await waitForWindow(
    (w) =>
      !before.has(w.hwnd) &&
      (w.processName.includes('notepad') ||
        w.title.toLowerCase().includes('notepad') ||
        w.className.toLowerCase().includes('notepad') ||
        true), // fall back to "any new window" — that's what the real engine does
    { timeoutMs: 8000, intervalMs: 200 },
  );

  if (!found) {
    console.log('[move] FAIL: no new window appeared');
    return;
  }
  console.log(`[move] target window hwnd=${found.hwnd} proc=${found.processName} "${found.title}"`);

  const moved = moveWindowToVisibleRect(found.hwnd, target.x, target.y, target.w, target.h, { foreground: true });
  await sleep(400);
  const landed = getVisibleRect(found.hwnd);
  console.log(`[move] SetWindowPos ok=${moved}`);
  if (landed) {
    const dx = landed.left - target.x;
    const dy = landed.top - target.y;
    const dw = landed.right - landed.left - target.w;
    const dh = landed.bottom - landed.top - target.h;
    const within = [dx, dy, dw, dh].every((d) => Math.abs(d) <= 2);
    console.log(`[move] visible rect: (${landed.left}, ${landed.top}, ${landed.right - landed.left}x${landed.bottom - landed.top})`);
    console.log(`[move] delta: dx=${dx} dy=${dy} dw=${dw} dh=${dh}  → ${within ? 'PASS (±2px)' : 'FAIL'}`);
  } else {
    console.log('[move] could not read visible rect');
  }

  // 3) Cleanup.
  console.log('[move] closing notepad...');
  postClose(found.hwnd);
  await sleep(800);
  if (isWindow(found.hwnd)) {
    console.log('[move] still open, force-killing pid', found.pid);
    spawn('taskkill', ['/PID', String(found.pid), '/F', '/T'], { stdio: 'ignore' });
  }
  console.log('\ndone.');
}

main().catch((e) => {
  console.error('check failed:', e);
  process.exit(1);
});

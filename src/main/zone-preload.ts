import { ipcRenderer } from 'electron';
import { IPC } from '../shared/types';

// Ctrl+wheel → step zoom. Capture-phase + preventDefault so the page can't swallow it.
window.addEventListener(
  'wheel',
  (e: WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 1 : -1;
    ipcRenderer.send(IPC.ZONE_ZOOM_STEP, delta);
  },
  { passive: false, capture: true },
);

// Ctrl+= / Ctrl++ / Ctrl+- / Ctrl+0 and F12 for devtools.
window.addEventListener(
  'keydown',
  (e: KeyboardEvent) => {
    if (e.key === 'F12') {
      e.preventDefault();
      ipcRenderer.send(IPC.ZONE_TOGGLE_DEVTOOLS);
      return;
    }
    if (!e.ctrlKey) return;
    if (e.key === '=' || e.key === '+') {
      e.preventDefault();
      ipcRenderer.send(IPC.ZONE_ZOOM_STEP, 1);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      ipcRenderer.send(IPC.ZONE_ZOOM_STEP, -1);
    } else if (e.key === '0') {
      e.preventDefault();
      ipcRenderer.send(IPC.ZONE_ZOOM_RESET);
    }
  },
  { capture: true },
);

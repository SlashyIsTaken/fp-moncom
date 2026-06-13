import type { Screen } from 'electron';
import type { MonitorInfo } from '../shared/types';
import { enumPhysicalMonitors } from './win32';

/**
 * Position-derived fallback id, used when a display can't be matched to a
 * physical monitor (e.g. EDID enumeration unavailable). Stable as long as the
 * monitor arrangement doesn't change — the previous scheme, kept as a backstop.
 */
export function monitorIdFromBounds(bounds: { x: number; y: number }): string {
  return `monitor-${bounds.x}_${bounds.y}`;
}

/**
 * Turn a device interface path like
 *   \\?\DISPLAY#AOC2401#5&1fe8d944&0&UID28931#{guid}
 * into a stable, filesystem/JSON-safe id like
 *   monitor-aoc2401-5-1fe8d944-0-uid28931
 * The hardware id + connector UID survive reboots and rearrangement.
 */
export function stableMonitorId(deviceId: string): string {
  const m = deviceId.match(/DISPLAY#([^#]+)#([^#]+)/i);
  const core = m ? `${m[1]}-${m[2]}` : deviceId;
  const clean = core.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return `monitor-${clean || hash(deviceId)}`;
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * Canonical monitor list with stable hardware-based ids. Every id-generating
 * path (renderer save via GET_MONITORS, preset apply, and migration) MUST go
 * through this so saved ids and apply-time ids always agree.
 *
 * Maps each Electron display to a physical monitor by converting the monitor's
 * physical top-left to DIP (`screenToDipPoint`) and matching display bounds.
 * Falls back to a position-derived id per display when no physical match exists.
 */
export function getStableMonitors(screen: Screen): MonitorInfo[] {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();

  let physical: ReturnType<typeof enumPhysicalMonitors> = [];
  try { physical = enumPhysicalMonitors(); } catch { physical = []; }

  const toDip = (x: number, y: number) =>
    typeof screen.screenToDipPoint === 'function' ? screen.screenToDipPoint({ x, y }) : { x, y };

  return displays.map((d, i) => {
    let id: string | null = null;
    for (const pm of physical) {
      const dip = toDip(pm.rect.left, pm.rect.top);
      if (Math.abs(dip.x - d.bounds.x) <= 2 && Math.abs(dip.y - d.bounds.y) <= 2 && pm.deviceId) {
        id = stableMonitorId(pm.deviceId);
        break;
      }
    }
    if (!id) id = monitorIdFromBounds(d.bounds);

    return {
      id,
      name: `Monitor ${i + 1}${d.id === primary.id ? ' (Primary)' : ''}`,
      x: d.bounds.x,
      y: d.bounds.y,
      width: d.bounds.width,
      height: d.bounds.height,
      scaleFactor: d.scaleFactor,
      isPrimary: d.id === primary.id,
    };
  });
}

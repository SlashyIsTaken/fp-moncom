/**
 * App Profiles: data-driven launch recipes for stubborn, multi-window apps.
 *
 * Profiles are JSON files — *data, not code*. They load from two places:
 *   - bundled examples (read-only, shipped with the app) — e.g. the DSS example,
 *   - the user's `userData/moncom-data/profiles/` (their own, authored in the UI
 *     or dropped in as files).
 * A profile attaches to a launch automatically by matching the launched exe.
 */
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { AppProfile } from '../shared/types';

export function userProfilesDir(): string {
  const dir = path.join(app.getPath('userData'), 'moncom-data', 'profiles');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Candidate locations for bundled example profiles (dev + packaged). */
function bundledProfileDirs(): string[] {
  const dirs = [
    path.join(__dirname, '../../examples/profiles'),                 // dev: dist/main → repo root
    path.join(process.resourcesPath || '', 'examples/profiles'),     // packaged: extraResources
    path.join(app.getAppPath(), 'examples/profiles'),
  ];
  return [...new Set(dirs)];
}

function readProfilesFromDir(dir: string): AppProfile[] {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.json'))
      .map((f) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as AppProfile;
        } catch (e) {
          console.error(`[MonCOM] Skipping bad profile ${f}:`, e);
          return null;
        }
      })
      .filter((p): p is AppProfile => !!p && !!p.id && !!p.match && Array.isArray(p.steps));
  } catch {
    return [];
  }
}

/** All profiles; a user profile overrides a bundled one with the same id. */
export function loadProfiles(): AppProfile[] {
  const byId = new Map<string, AppProfile>();
  for (const dir of bundledProfileDirs()) {
    for (const p of readProfilesFromDir(dir)) byId.set(p.id, p);
  }
  for (const p of readProfilesFromDir(userProfilesDir())) byId.set(p.id, p);
  return [...byId.values()];
}

/** The profile whose `match.exe` equals this exe base name, if any. */
export function findProfileForExe(exe: string): AppProfile | null {
  if (!exe) return null;
  const target = exe.toLowerCase();
  for (const p of loadProfiles()) {
    if (p.match.exe && p.match.exe.toLowerCase() === target) return p;
  }
  return null;
}

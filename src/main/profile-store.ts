/**
 * App Profiles: data-driven launch recipes for stubborn, multi-window apps.
 *
 * Profiles are JSON files — *data, not code*. They load from two places:
 *   - bundled examples (read-only, shipped with the app) — e.g. the DSS example,
 *   - the user's `userData/moncom-data/profiles/` (their own, authored in the UI
 *     or dropped in as files).
 * A profile attaches to a launch automatically by matching the launched exe.
 */
import { app, shell, IpcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { IPC } from '../shared/types';
import type { AppProfile } from '../shared/types';
import { normalizeExe } from '../shared/exe';

export interface ProfileEntry {
  profile: AppProfile;
  /** True if this profile comes only from the bundled examples (no user override). */
  bundled: boolean;
}

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
  const target = normalizeExe(exe);
  if (!target) return null;
  for (const p of loadProfiles()) {
    if (p.match.exe && normalizeExe(p.match.exe) === target) return p;
  }
  return null;
}

/** All profiles tagged with whether they're bundled examples or user-authored. */
export function loadProfileEntries(): ProfileEntry[] {
  const userIds = new Set(readProfilesFromDir(userProfilesDir()).map((p) => p.id));
  return loadProfiles().map((profile) => ({ profile, bundled: !userIds.has(profile.id) }));
}

function profileFilePath(id: string): string {
  const safe = (id || 'profile').replace(/[^a-z0-9_-]/gi, '-').toLowerCase().slice(0, 64) || 'profile';
  return path.join(userProfilesDir(), `${safe}.json`);
}

export function saveProfile(p: AppProfile): void {
  // Normalize every exe field so matching never depends on perfect user input.
  const normalized: AppProfile = {
    ...p,
    match: { ...p.match, exe: p.match.exe ? normalizeExe(p.match.exe) : p.match.exe },
    steps: p.steps.map((s) => ({
      ...s,
      waitFor: { ...s.waitFor, exe: s.waitFor.exe ? normalizeExe(s.waitFor.exe) : s.waitFor.exe },
    })),
  };
  fs.writeFileSync(profileFilePath(normalized.id), JSON.stringify(normalized, null, 2));
}

/** Remove a user profile file. A bundled profile of the same id (if any) reappears. */
export function deleteUserProfile(id: string): void {
  const file = profileFilePath(id);
  if (fs.existsSync(file)) fs.rmSync(file);
}

export function registerProfileHandlers(ipcMain: IpcMain) {
  ipcMain.handle(IPC.GET_PROFILES, () => loadProfileEntries());
  ipcMain.handle(IPC.SAVE_PROFILE, (_e, p: AppProfile) => { saveProfile(p); return loadProfileEntries(); });
  ipcMain.handle(IPC.DELETE_PROFILE, (_e, id: string) => { deleteUserProfile(id); return loadProfileEntries(); });
  ipcMain.handle(IPC.OPEN_PROFILES_FOLDER, () => shell.openPath(userProfilesDir()));
}

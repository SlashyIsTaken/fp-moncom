# MonCOM — Context for Claude

MonCOM (Monitor Commander) is a Windows Electron desktop app for splitting monitors into zones, launching apps/URLs into those zones, and managing multi-monitor workspaces via named presets.

## Stack
- Electron 41 + TypeScript 5.9
- React 19 + Tailwind CSS 4 renderer
- Vite 8 (renderer) + esbuild (`esbuild.main.mjs`) for main process
- Node >= 20.19 required (use `nvm use 20`)
- Packaging: electron-builder (NSIS + portable). Icon: `build/icon.png` (+ `build/icon.ico` for installer). `build/icon.png` is bundled via `package.json` → `build.files`.

## Layout
- `src/main/index.ts` — app entry, tray, BrowserWindow, IPC registration, monitor-identify overlays, elevation relaunch, auto-launch preset on startup.
- `src/main/win32.ts` — native Win32 engine via **koffi** FFI (no PowerShell): `enumWindows`, `moveWindowToVisibleRect` (per-window DWM border correction via `DWMWA_EXTENDED_FRAME_BOUNDS`), `postClose`, `isWindow`, the `waitForWindow(matcher)` primitive, and `enumPhysicalMonitors` (EnumDisplayMonitors + EnumDisplayDevices for stable EDID identity). koffi is N-API so the same binary loads under Node (dev scripts) and Electron. Marked `external` in `esbuild.main.mjs`.
- `src/main/monitors.ts` — canonical monitor list with **stable hardware ids** (`getStableMonitors`). Maps each Electron display to a physical monitor (`enumPhysicalMonitors` → `screenToDipPoint` bounds match) and derives an EDID-based id (`stableMonitorId`, e.g. `monitor-aoc2401-…-uid28931`), falling back to position-based `monitorIdFromBounds`. ALL id-generating paths (GET_MONITORS save, preset apply, migration) go through this so saved ids and apply-time ids always agree.
- `src/main/window-manager.ts` — window positioning/closing built on `win32.ts`. Launches apps/URLs, resolves the target window through a `WindowMatcher` + `resolveTargetWindow` seam (default: first new window of the launched exe; App Profiles will swap in a multi-step matcher), positions it, gracefully closes via native WM_CLOSE then `taskkill /F /T` fallback. Tracks `launchedAppWindows: Map<hwnd, pid>`. Exports `applyPresetFromMain` (used by auto-launch).
- `src/main/preset-store.ts` — JSON persistence under `app.getPath('userData')/moncom-data/`. `SAVE_SETTINGS` also calls `app.setLoginItemSettings` for startup registration.
- `src/main/automation-manager.ts` — record/replay user input for a zone.
- `src/main/preload.ts` — contextBridge exposing `window.moncom`.
- `src/shared/types.ts` — shared types + `IPC` channel enum.
- `src/renderer/` — React UI: `App.tsx`, `pages/` (DashboardPage, PresetsPage, LayoutEditorPage, SettingsPage), `components/Sidebar.tsx`.
- `__APP_VERSION__` injected via Vite/esbuild `define` from package.json version.

## Native Win32 engine (win32.ts)
- All window ops go through koffi FFI in `win32.ts` — **do not reintroduce PowerShell** for enumerate/move/close (it was the source of the multi-second launch latency).
- DWM border compensation is **measured per window** (`GetWindowRect` vs `DWMWA_EXTENDED_FRAME_BOUNDS`), not a hard-coded offset. `moveWindowToVisibleRect` lands the *visible* frame exactly on the zone (verified 0px on Notepad).
- Window handles are marshalled as `intptr_t` → plain JS numbers (real HWNDs fit in 2^53). Wide strings: pass a `Buffer`, read with `buf.toString('ucs2', 0, len*2)`.
- `enumWindows()` filters to visible, non-tool-window, non-DWM-cloaked, titled top-level windows; process names resolved via `QueryFullProcessImageNameW` and cached per pid.
- Close flow: native `PostMessageW(WM_CLOSE)` → poll `IsWindow` ~1.2s → `taskkill /PID $pid /F /T` tree-kill fallback (still a `spawn`, rare path).
- UIPI: a non-elevated MonCOM cannot move/close windows of elevated processes — `SetWindowPos` just returns false. Solution is unchanged: the `runAsAdmin` setting self-relaunches elevated on startup. Keep the static elevation note in the editor.
- koffi packaging: it ships a prebuilt `.node`; electron-builder must keep it unpacked from asar (verify in Phase 3).

## Elevation
- `isProcessElevated()` uses `execSync('net session', { stdio: 'ignore' })` — throws when not elevated.
- When `settings.runAsAdmin` is true and not already elevated and not dev, `app.whenReady` relaunches self via `powershell Start-Process -Verb RunAs` then `app.exit(0)`. Only prompts UAC in packaged builds (skipped when `isDev`).
- The layout editor shows a static note for app-type zones advising users to enable the setting if the target needs admin.

## Presets / Zones
- A Preset holds monitor id + array of Zones (rect + optional target: url/application + launchDelay + optional recorded automation).
- Switching presets: `applyPresetFromMain` first calls `closeAllZones()` if any launched windows exist, to avoid leftovers.
- Auto-launch: on startup, if `settings.autoLaunchPreset` and id resolves, waits 3s (monitor settle) then applies.
- Editing a preset: `LayoutEditorPage` accepts `editingPreset` prop; save preserves `id` + `createdAt`, updates `updatedAt`. Button label toggles "Save Preset" / "Update Preset".

## UI conventions
- Dark theme, background `#0E1116`, accent blue `#2A7FFF`, Flarepoint red `#FF2A2A` (used for hover on "by Flarepoint" link → flarepoint.nl).
- Frameless window (`frame: false`, `titleBarStyle: 'hidden'`), custom titlebar buttons via IPC `window-minimize/maximize/close`. Close minimizes to tray (preventDefault + hide). Quit only via tray menu.
- Pre-release banner visible while major version < 1.
- Settings auto-save (no Save button) — `useRef` skips the initial load; subsequent state changes trigger `saveSettings`.
- URLs are normalized: if no protocol, `https://` is prepended before launch.

## Known quirks / gotchas
- Monitor ids are **stable hardware (EDID) ids** from `monitors.ts` — never reintroduce per-path id generation; always go through `getStableMonitors`. Presets saved before this scheme (old Electron `display.id`, or position-only ids) that also lack `monitorBounds` can't auto-migrate — they must be recreated. New presets store `monitorBounds`, so they rematch by bounds if an id ever drifts.
- Don't re-introduce runtime elevation detection per-zone — it was removed by user request; use the static note instead.
- Don't add `overflow: hidden` on scroll containers for webview-based zones — it blocks scrolling. Use `::-webkit-scrollbar { display: none }` + `scrollbar-width: none`.
- When the target field (app/url) changes, clear the label so stale hints don't stick (both text input and Browse button).
- electron-builder symlink extraction fails unless Windows Developer Mode is enabled (winCodeSign cache contains macOS symlinks).
- Tray icon: resolved via `resolveIconPath()` in `index.ts` which tries `__dirname/../../build`, `process.resourcesPath/build`, and `app.getAppPath()/build`. Icon is resized to 16×16 for the tray.

## Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Package (Windows): `npm run pack` → `release/`

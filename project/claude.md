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
- `src/main/window-manager.ts` — PowerShell-driven window positioning/closing. Launches apps/URLs, polls for new HWNDs, moves them with 7px DWM-border compensation, gracefully closes via WM_CLOSE then `taskkill /F /T`. Tracks `launchedAppHWNDs: Set<string>`. Exports `applyPresetFromMain` (used by auto-launch).
- `src/main/preset-store.ts` — JSON persistence under `app.getPath('userData')/moncom-data/`. `SAVE_SETTINGS` also calls `app.setLoginItemSettings` for startup registration.
- `src/main/automation-manager.ts` — record/replay user input for a zone.
- `src/main/preload.ts` — contextBridge exposing `window.moncom`.
- `src/shared/types.ts` — shared types + `IPC` channel enum.
- `src/renderer/` — React UI: `App.tsx`, `pages/` (DashboardPage, PresetsPage, LayoutEditorPage, SettingsPage), `components/Sidebar.tsx`.
- `__APP_VERSION__` injected via Vite/esbuild `define` from package.json version.

## PowerShell conventions in window-manager.ts
- Don't use `Add-Type` C# compilation in a heredoc — it silently fails. Either:
  - Use `Get-Process | Where MainWindowHandle -ne 0` for HWND enumeration, OR
  - Use `Add-Type -MemberDefinition` with P/Invoke sigs concatenated, called with `-ExecutionPolicy Bypass -Command <script>` as an argument (not stdin).
- Window move compensates for Windows 10/11 invisible DWM borders: `x-7, y, w+14, h+7`.
- Close flow mirrors the user's reference Python: PostMessage WM_CLOSE (0x0010) → wait 1s → `taskkill /PID $pid /F /T`.
- UIPI: a non-elevated MonCOM cannot move/close windows belonging to elevated processes. Solution is the `runAsAdmin` setting which self-relaunches elevated on startup.

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
- Don't re-introduce runtime elevation detection per-zone — it was removed by user request; use the static note instead.
- Don't add `overflow: hidden` on scroll containers for webview-based zones — it blocks scrolling. Use `::-webkit-scrollbar { display: none }` + `scrollbar-width: none`.
- When the target field (app/url) changes, clear the label so stale hints don't stick (both text input and Browse button).
- electron-builder symlink extraction fails unless Windows Developer Mode is enabled (winCodeSign cache contains macOS symlinks).
- Tray icon: resolved via `resolveIconPath()` in `index.ts` which tries `__dirname/../../build`, `process.resourcesPath/build`, and `app.getAppPath()/build`. Icon is resized to 16×16 for the tray.

## Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Package (Windows): `npm run pack` → `release/`

# MonCOM Roadmap

This document tracks where MonCOM is today and what's left before it can call itself **v1.0.0**.

It is meant to give a realistic, public-facing picture of the project — where the rough edges are, what's deliberately out of scope, and where new contributors can usefully jump in. It is **not** a promise about timelines.

---

## Where we are: v0.1.0

The core loop works. You can detect monitors, split them into zones using one of six templates, assign URLs or applications to those zones, save the layout as a preset, and apply it again later in one click. The app lives in the system tray, can launch on Windows boot, and can apply a chosen preset automatically when it starts.

The more ambitious pieces are also in place: per-zone action recording and playback (mouse clicks, key presses, typed text), the elevation-aware app launching path, and the monitor identification overlay.

What that means in practice: the app is **usable end-to-end for the primary use case**, but it has not yet been hardened for distribution. There are no tests, no signed builds, no release pipeline, and a number of UX rough edges that are easy to forgive in a personal tool but obvious to anyone trying it for the first time.

The version banner in the top of the app reflects this — it shows the alpha warning until the major version hits 1.

---

## The road to v1.0.0

Roughly in priority order. The stretch items at the bottom are nice-to-haves that may or may not make the cut.

### 1. Reliability of the core launch flow

Before anything new gets added, the existing launch path needs to be more predictable.

- [ ] App-window positioning currently uses PowerShell + inline C# Win32 calls. It works, but it is slow (sometimes several seconds) and depends on title matching when HWND tracking misses. We should evaluate moving the hot path to a small native helper (Node addon, or a tiny C# CLI shipped alongside) so launches feel instant.
- [ ] Compensation for the invisible DWM window borders is currently a hard-coded 8px. This is correct on most Win11 builds but not all — needs to be measured per-window or made configurable.
- [ ] When a launched application is already running (a single-instance app like Spotify, Discord, etc.), MonCOM treats the existing window as "new" or fails to find one. We need a predictable strategy for these cases.
- [ ] Errors during launch currently land in the console. They should surface in the UI (toast, status badge on the zone) so the user knows when a zone failed to position.
- [ ] `closeAllZones` should report which apps it could not close gracefully.

### 2. Distribution & releases

The whole point of v1.0.0 is that someone can download an installer and use it without cloning the repo.

- [ ] Set up a GitHub Actions workflow that builds the NSIS installer and the portable `.exe` on every tag.
- [ ] Generate a proper Windows icon set (`.ico` with 16/24/32/48/64/128/256 px) — currently only a single PNG ships in `build/`.
- [ ] Code-sign the installer. Either a real certificate or, at minimum, a documented self-signed build so SmartScreen warnings have an explanation.
- [ ] Add an auto-updater (likely `electron-updater`) so users do not have to re-download the installer for every patch.
- [ ] Write a `CHANGELOG.md` and start enforcing semver from the first tagged release.

### 3. Global hotkeys

The settings type already declares `hotkeys: Record<string, string>` but nothing is wired up. This is one of the highest-value missing features — being able to apply a preset from anywhere in Windows without touching the MonCOM window.

- [ ] Wire up `globalShortcut` registration in the main process.
- [ ] UI in the settings page (or a new section in the preset editor) to bind a hotkey to a specific preset.
- [ ] Detect and surface conflicts with existing shortcuts.
- [ ] Persist the bindings in `settings.json` and re-register them on startup.

### 4. Layout editor improvements

The six built-in templates cover most cases but do not feel like enough for v1.0.0.

- [ ] Drag handles on zone edges so users can fine-tune a template after applying it.
- [ ] A "custom split" mode where the user draws zones directly on the monitor preview.
- [ ] Save user-made layouts as named templates that show up alongside the built-ins.
- [ ] Show the actual preview content (a screenshot, favicon for URLs, exe icon for apps) inside the zone preview rather than just the label.

### 5. Preset management

Right now presets live only in the user's `%APPDATA%`. That's fine for one machine but limits sharing and recovery.

- [ ] Export a preset to a `.json` file from the Presets page.
- [ ] Import a preset from a file (with a preview of monitor mapping before committing).
- [ ] Duplicate / rename actions on the preset card.
- [ ] Handle the "monitor IDs changed" case gracefully — if a saved preset references a monitor that no longer exists, offer to remap it instead of silently dropping zones.

### 6. Automation editor

The recording and playback foundation is solid, but editing a recorded sequence is currently limited to deleting individual actions and adding a "type" action.

- [ ] Inline editing of recorded delays and click coordinates.
- [ ] Reorder actions by drag.
- [ ] Add support for scroll events and modifier keys (currently keys are recorded as raw VK codes, but combos like Ctrl+T are not handled cleanly).
- [ ] A "test from action N" button so debugging a long sequence does not require replaying it from the start.

### 7. Tests & quality gates

There are currently no tests at all. v1.0.0 needs at least a thin safety net.

- [ ] Unit tests for the pure logic in `preset-store.ts`, the zone-bounds math, and the playback script generation.
- [ ] An integration test that boots Electron headlessly and verifies the IPC contract in `preload.ts` matches what the renderer expects.
- [ ] Lint + typecheck in CI on every PR.

### 8. Documentation & onboarding

- [ ] Add screenshots of the dashboard, layout editor, and a recorded automation to the README.
- [ ] A short `CONTRIBUTING.md` covering the dev loop (`npm run dev`), the main/renderer split, and how to add a new IPC channel.
- [ ] A `SECURITY.md` so people know where to report issues responsibly.
- [ ] Issue and PR templates under `.github/`.

---

## Stretch goals (probably post-1.0)

Things that would be great to have but are not blockers for tagging v1.0.0:

- A "scenes" concept that switches presets based on a trigger (time of day, plugged-in monitor count, focused app).
- CLI flags to apply a preset from the command line, so it can be wired into other automation tools.
- Linux and macOS builds. The architecture currently leans hard on Windows-specific Win32 calls, so this would mean a real abstraction layer.
- A plugin / scripting hook for users who want to extend zone behavior beyond URL and app launching.
- Cloud-optional preset sync (opt-in, no telemetry).

---

## Where to help

If you are reading this and want to contribute, the easiest places to start are:

- **Anything in section 1 or 7** — these are the unsexy but high-impact areas that need eyes from people who didn't write the original code.
- **Section 8 documentation** — particularly the screenshots, since the author of this repo keeps forgetting to take them.
- **Filing issues** with reproducible steps when something does not position correctly. Window positioning is the kind of feature where edge cases (ultrawide monitors, fractional scaling, unusual DPI combos) are best found by other people's setups.

Open an issue first if you are planning anything more involved than a small fix — the scope of the project is intentionally narrow and it is worth a quick alignment before writing a lot of code.

---

*This roadmap will be updated as items land or priorities shift. Last meaningful revision: April 2026.*

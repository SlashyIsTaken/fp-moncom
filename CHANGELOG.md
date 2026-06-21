# Changelog

All notable changes to MonCOM are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While MonCOM is pre-1.0, minor versions may include breaking changes; these are
called out explicitly when they happen.

## [Unreleased]

### Added
- Multi-size Windows icon (`build/icon.ico`, 16–256px), generated reproducibly by
  `tools/make-icon.mjs`.
- Release pipeline: a GitHub Actions workflow builds the NSIS installer and portable
  `.exe` on every `v*` tag, publishes SHA256 checksums, and drafts a GitHub release.
- Published SHA256 checksums and SmartScreen guidance so unsigned downloads can be
  verified and explained.

### Fixed
- Packaged builds now load the native Win32 layer correctly — koffi and its native
  module ship in the package and the `.node` is unpacked from the asar.
- The bundled app-profile examples now ship with packaged builds.
- The window/tray icon now appears in packaged builds (the icon file is included).
- Portable build no longer fails to start when "Run as administrator" is enabled: it
  relaunches the real portable executable for elevation instead of a temp copy that
  the wrapper deletes on exit.
- Startup self-elevation now reliably shows the UAC prompt. The elevation request no
  longer races a hard exit, and if elevation is declined the app opens unelevated
  instead of silently doing nothing.
- "Minimize to tray" is now respected on close. With the setting off, closing the
  window quits the app instead of always hiding to the tray.

## [0.1.1] - 2026-06

Pre-release baseline. The core loop works end-to-end: detect monitors, split them
into zones, assign URLs or apps, save and re-apply presets, system-tray + launch on
boot, per-zone record/replay automation, DOM-aware web auto-login, and data-driven
App Profiles for stubborn multi-window apps. See the git history for details prior to
this changelog.

[Unreleased]: https://github.com/SlashyIsTaken/fp-moncom/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/SlashyIsTaken/fp-moncom/releases/tag/v0.1.1

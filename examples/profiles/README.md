# App Profiles

An **app profile** is a small JSON file that tells MonCOM how to bring up a
stubborn, multi-window app — one that throws a warning dialog, passes through an
intermediate login window, or spawns its real window late — and which window to
finally position in the zone.

Profiles are **data, not code**. MonCOM loads them from:
- this bundled `examples/` folder (read-only), and
- your own `…/MonCOM/moncom-data/profiles/` folder (drop a `.json` here, or author one in the app).

A profile attaches to a launch **automatically** by matching the launched exe
(`match.exe`, the lowercased exe name without `.exe`).

## Format

```jsonc
{
  "id": "dss-client",
  "name": "DSS Client (example)",
  "match": { "exe": "dssclient" },          // applies when you launch dssclient.exe
  "steps": [
    {
      "waitFor": { "titleContains": "Warning" }, // wait for the warning dialog
      "optional": true,                          // ...but don't fail if it never shows
      "do": [{ "type": "key", "vkCode": 13 }],   // press Enter to acknowledge (VK 13 = Enter)
      "waitClose": true                          // wait for it to close before continuing
    },
    { "waitFor": { "titleContains": "Login" }, "optional": true, "waitClose": true }, // auto-login window
    { "waitFor": { "exe": "dssclient" }, "position": true }                           // the real window → position it
  ]
}
```

### `waitFor` — a window matcher (all provided fields must match)
- `exe` — process exe base name, lowercase, no extension
- `titleContains` — case-insensitive substring of the title
- `className` — exact window class name

### Step fields
- `timeoutMs` — how long to wait for the window (default 15000)
- `optional` — continue instead of aborting if the window never appears
- `do` — actions once matched: `{ "type": "key", "vkCode": N, "modifiers": ["ctrl"] }`, `{ "type": "click", "x": 0.5, "y": 0.8, "right": false }` (x/y are 0–1 relative to that window), `{ "type": "wait", "ms": 500 }`
- `waitClose` — wait for the matched window to close before the next step
- `position` — mark the matched window as the one to place in the zone

## When every window shares the same title (e.g. DSS Client)

Some apps name *every* window the same (the warning dialog, the login window, and
the main window are all titled "DSS Client") and run them under one exe — and the
"Warning" text lives inside the dialog body, not the window title. The title can't
tell them apart, but they appear **in order, one at a time**. So match each step by
`exe` alone and use `waitClose` to wait for each window to close before the next:
step 1 matches the first window, step 2 the next, and so on. MonCOM never
re-matches a window it already handled, so ordering is enough.

That's exactly what the bundled `dss-client.json` does: match `dss client`, press
Enter to accept the warning, wait through the auto-login window, then position the
main window.

> Tips: the exe base name is lowercased with `.exe` removed — `DSS Client.exe`
> becomes `dss client` (keep the space). If a dialog's default button isn't the one
> you want (so Enter won't hit it), use a `click` with the button's relative
> position instead of a `key`.

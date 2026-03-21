<h1 align="center">Flarepoint MonCOM | Monitor Commander</h1>

<p align="center">
  <strong>Organize your monitors. Command your workspace.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#building-from-source">Building from Source</a> •
  <a href="#project-structure">Project Structure</a> •
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows-blue?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/node-%3E%3D20.19-339933?style=flat-square&logo=nodedotjs" alt="Node" />
  <img src="https://img.shields.io/badge/electron-41-47848f?style=flat-square&logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/react-19-61dafb?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" />
</p>

> **Note:** MonCOM is currently in pre-release (v0.x). Features may be incomplete, unstable, or subject to change. There will be no downloadable release until the project reaches a stable version. Until then, follow the [Building from Source](#building-from-source) instructions to run it.

---

## What is MonCOM?

MonCOM (Monitor Commander) is a desktop application for Windows that lets you split your monitors into zones, assign content to each zone, and save those layouts as reusable presets. Whether you have a dual-monitor dev setup or a six-screen command center, MonCOM gives you instant, one-click control over what goes where.

Assign URLs or applications to specific regions of any connected display, then apply your entire layout in one click. Combine it with auto-launch on startup to have your workspace fully configured the moment your PC boots.

---

## Features

### Monitor Detection
MonCOM automatically detects all connected displays and reads their resolution, position, scale factor, and primary status — no manual configuration needed.

### Layout Editor
Split any monitor into zones using built-in templates:

| Template | Description |
|----------|-------------|
| **Full Screen** | Entire monitor as a single zone |
| **2 Columns** | Vertical 50/50 split |
| **2 Rows** | Horizontal 50/50 split |
| **2×2 Grid** | Four equal quadrants |
| **3×3 Grid** | Nine equal cells |
| **Main + Side** | 70/30 split for a primary + sidebar workflow |

Each zone can be assigned either:
- **A URL** — opens in a frameless, positioned browser window
- **An application** — launches the executable and moves it into position

### Action Recording & Playback
After assigning content to a zone, you can record a click and keyboard sequence that MonCOM will replay automatically every time that zone launches. This is useful for:
- Logging into a web dashboard
- Clicking through a startup dialog
- Navigating to a specific tab or view
- Typing into search fields or forms

Click **Record** in the Automation section of the zone editor. MonCOM will close any active zone windows, run a countdown, then launch the zone's content — so the real startup time is naturally captured. Once the content is loaded and recording begins, switch to the launched window and perform your actions, then return to MonCOM and click **Stop** — the stop click itself is not captured. If the content needs extra time to settle, you can add a **launch delay** buffer (default 0 ms) per zone. Recorded actions include mouse clicks (left and right), keyboard input, and timing between each step. You can also manually add "type text" actions for entering text strings. All coordinates are stored relative to the zone so that sequences remain valid across resolution changes.

### Presets
Save any layout as a named preset. Apply it later with a single click from the dashboard or presets page. MonCOM tracks how many zones each preset has and when it was created.

### Dashboard
A central overview of your monitors and presets with quick-action buttons:
- **New Layout** — jump straight to the editor
- **Close All** — kill every launched zone window at once
- **Refresh Monitors** — re-detect displays after plugging in or rearranging

### Settings
- **Launch on startup** — register MonCOM to start with Windows
- **Minimize to tray** — keep it running in the background via the system tray
- **Auto-launch preset** — automatically apply a saved preset when MonCOM starts (with a short delay to let displays stabilize)

### System Tray Integration
MonCOM lives in your system tray. Double-click the icon or use the context menu to show or hide the main window without closing the app.

---

## Installation

### From a Release

1. Head to the [Releases](../../releases) page.
2. Download the latest `.exe` installer or the portable build.
3. Run the installer and follow the prompts — or extract the portable build and run `MonCOM.exe`.

### From Source

See [Building from Source](#building-from-source) below.

---

## Getting Started

### 1. Launch MonCOM
Open the app. The **Dashboard** shows every monitor connected to your system along with any presets you've saved.

### 2. Create a Layout
Click **New Layout** (or navigate to the **Layout Editor** from the sidebar).

1. Select a monitor from the monitor map at the top of the editor.
2. Choose a split template (e.g., 2 Columns).
3. Click on a zone to configure it:
   - Pick **URL** and enter a web address, or
   - Pick **App** and browse for an executable.
4. Repeat for additional monitors or zones.

### 3. Test It
Click **Quick Apply** to launch all configured zones immediately. MonCOM positions each window pixel-perfect inside its zone. Use **Close All** to tear everything down.

### 4. Save as a Preset
Give your layout a name and click **Save Preset**. It now appears on the Dashboard and the Presets page for one-click access.

### 5. Record Actions (Optional)
With a zone selected that has content assigned, scroll down to the **Automation** section:

1. Click **Record** — MonCOM closes any active zone windows and starts a 3-second countdown.
2. After the countdown, the zone's content launches so the real startup delay is captured.
3. Interact with the launched content — click buttons, type text, navigate menus.
4. Return to MonCOM and click **Stop Recording** — the stop click is automatically excluded.
5. Your actions appear in a list. Use **Play** to test them, or **Clear** to start over.
6. You can also manually add "type text" actions for entering text strings.

Actions are saved with the preset and replay automatically after the zone content launches.

### 6. Automate
In **Settings**, enable **Launch on startup** and pick your preset under **Auto-launch preset**. Your entire workspace will be set up automatically every time Windows starts — including action sequences.

---

## Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/) 20.19+ or 22.12+
- npm (bundled with Node.js)
- Windows 10/11

### Setup

```bash
# Clone the repository
git clone https://github.com/flarepoint/fp-moncom.git
cd fp-moncom

# Install dependencies
npm install
```

### Development

```bash
# Start the dev environment (Vite dev server + Electron)
npm run dev
```

This launches the Vite dev server for the renderer on `http://localhost:5173`, builds the main process with esbuild, and opens the Electron window with hot-reload enabled.

### Production Build

```bash
# Build both renderer and main process
npm run build

# Package as a Windows installer (.exe)
npm run pack
```

The installer is output to the `release/` directory.

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the full development environment |
| `npm run dev:renderer` | Start the Vite dev server only |
| `npm run dev:main` | Build the main process and launch Electron |
| `npm run build` | Build renderer and main for production |
| `npm run build:renderer` | Build the React renderer with Vite |
| `npm run build:main` | Bundle the main process with esbuild |
| `npm run start` | Build and launch the packaged app |
| `npm run pack` | Package as a Windows NSIS installer |

---

## Project Structure

```
fp-moncom/
├── src/
│   ├── main/                        # Electron main process
│   │   ├── index.ts                 # App init, window & tray management
│   │   ├── preload.ts               # Secure IPC bridge (context isolation)
│   │   ├── window-manager.ts        # Window positioning & zone launching
│   │   └── preset-store.ts          # Preset & settings persistence
│   │
│   ├── renderer/                    # React frontend
│   │   ├── main.tsx                 # React entry point
│   │   ├── App.tsx                  # App shell & page routing
│   │   ├── index.html               # HTML template
│   │   ├── components/
│   │   │   ├── TitleBar.tsx         # Custom frameless window controls
│   │   │   ├── Sidebar.tsx          # Navigation menu
│   │   │   └── Tooltip.tsx          # Reusable tooltip
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx    # Overview & quick actions
│   │   │   ├── LayoutEditorPage.tsx # Zone configuration UI
│   │   │   ├── PresetsPage.tsx      # Preset management
│   │   │   └── SettingsPage.tsx     # App settings
│   │   └── styles/
│   │       └── globals.css          # Theme tokens & animations
│   │
│   └── shared/
│       └── types.ts                 # Shared TypeScript interfaces
│
├── build/                           # App icons
├── esbuild.main.mjs                 # Main process build config
├── vite.config.ts                   # Renderer build config
├── tsconfig.json                    # TypeScript config
└── package.json                     # Dependencies & scripts
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Desktop Runtime** | Electron 41 |
| **UI** | React 19, TypeScript 5.9, Tailwind CSS 4 |
| **Bundling** | Vite 8 (renderer), esbuild (main process) |
| **Persistence** | electron-store (JSON-based, per-user) |
| **Packaging** | electron-builder (NSIS installer + portable) |
| **Icons** | Lucide React |

---

## Data Storage

MonCOM stores its data in your user application data directory:

```
%APPDATA%\MonCOM\moncom-data\
├── presets.json      # Saved layout presets
└── settings.json     # App settings
```

No cloud services, no telemetry, no accounts. Everything stays on your machine.

---

## Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m "Add my feature"`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built by <strong>Flarepoint</strong>
</p>

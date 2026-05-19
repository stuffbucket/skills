---
name: tauri-setup
description: Use when scaffolding a Tauri v2 app, fixing missing system prerequisites (Rust, WebView2, webkit2gtk, Xcode CLT), integrating a JS framework (especially Vite) with Tauri, or migrating an existing Tauri v1 project to v2.
---

# Tauri v2 Setup

Tauri v2 wraps a web frontend in a Rust shell that uses the OS native webview (WebKit on
macOS/Linux, WebView2 on Windows). A project is two halves: a frontend (any framework or vanilla)
plus a Cargo project at `src-tauri/`.

Docs: <https://v2.tauri.app/start/>

## Prerequisites

Install in order: **system deps → Rust → Node (if JS frontend) → mobile targets (optional)**.

### macOS

```sh
# Desktop-only is enough for most cases:
xcode-select --install
# iOS targets: install full Xcode from the App Store and launch it once.
```

### Windows

1. Microsoft C++ Build Tools — install from
   <https://visualstudio.microsoft.com/visual-cpp-build-tools/> and check "Desktop development with
   C++".
2. WebView2 — preinstalled on Windows 10 1803+ and Windows 11. Otherwise grab the Evergreen
   Bootstrapper: <https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download-section>
3. Building MSI installers also requires the **VBSCRIPT** optional Windows feature (Settings → Apps
   → Optional features → More Windows features).

### Linux

Debian/Ubuntu:

```sh
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

Fedora:

```sh
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel libxdo-devel
sudo dnf group install "c-development"
```

Arch:

```sh
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl \
  appmenu-gtk-module libappindicator-gtk3 librsvg xdotool
```

Other distros: <https://v2.tauri.app/start/prerequisites/#linux>

### Rust (all OSes)

```sh
# Linux / macOS
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh

# Windows (PowerShell)
winget install --id Rustlang.Rustup
rustup default stable-msvc   # MSVC toolchain required
```

Restart your terminal so `cargo` is on `PATH`.

### Mobile targets (optional)

```sh
# Android
rustup target add aarch64-linux-android armv7-linux-androideabi \
  i686-linux-android x86_64-linux-android
# Plus Android Studio, JAVA_HOME, ANDROID_HOME, NDK_HOME — see docs.

# iOS (macOS only)
rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim
brew install cocoapods
```

## Scaffold a new project

Interactive wizard (recommended for greenfield):

```sh
# Pick one:
bun create tauri-app
npm create tauri-app@latest
pnpm create tauri-app
cargo install create-tauri-app --locked && cargo create-tauri-app
```

Prompts: project name, bundle identifier (`com.you.app`), frontend language (TS/JS, Rust, .NET),
package manager, UI template (Vanilla, Vue, Svelte, React, Solid, Angular, Preact, Yew, Leptos,
Sycamore, Blazor), UI flavor.

Then:

```sh
cd <name>
bun install
bun tauri dev
```

## Add Tauri to an existing frontend

```sh
cd my-existing-app
bun add -D @tauri-apps/cli@latest
bunx tauri init
```

The `init` wizard asks:

```text
✔ What is your app name?
✔ What should the window title be?
✔ Where are your web assets located?            # e.g. ../dist
✔ What is the url of your dev server?           # e.g. http://localhost:5173
✔ What is your frontend dev command?            # e.g. bun run dev
✔ What is your frontend build command?          # e.g. bun run build
```

This creates `src-tauri/` next to your frontend. See `templates/tauri.conf.json` in this skill for a
known-good starting config.

## Project layout

```text
.
├── package.json
├── index.html                  # or framework entry
├── src/                        # frontend source
│   └── main.ts
├── dist/                       # frontend build output (gitignored)
└── src-tauri/
    ├── Cargo.toml
    ├── build.rs                # calls tauri_build::build()
    ├── tauri.conf.json         # main Tauri config (identifier, windows, bundle)
    ├── src/
    │   ├── main.rs             # desktop entry; just calls app_lib::run()
    │   └── lib.rs              # real entry; mobile_entry_point lives here
    ├── capabilities/
    │   └── default.json        # ACL: which commands the frontend may call
    └── icons/                  # tauri icon output, referenced by bundle.icon
```

Rules of thumb:

- Edit `lib.rs`, not `main.rs` — mobile builds compile the app as a library.
- `capabilities/*.json` is the v2 replacement for v1's `allowlist`. Every plugin command the
  frontend invokes must be permitted here. See <https://v2.tauri.app/security/capabilities/>
- Tauri ships the frontend as static files, so the JS project is built first then embedded.

Details: <https://v2.tauri.app/start/project-structure/>

## Dev and build

```sh
bun tauri dev      # runs beforeDevCommand, opens app, hot reloads
bun tauri build    # runs beforeBuildCommand, bundles installers
bun tauri icon     # regenerate icons from a source PNG
```

Wired up by these keys in `tauri.conf.json`:

```jsonc
{
  "build": {
    "beforeDevCommand": "bun run dev",
    "beforeBuildCommand": "bun run build",
    "devUrl": "http://localhost:1420",   // must match Vite server.port
    "frontendDist": "../dist"             // relative to src-tauri/
  }
}
```

## Vite integration

Tauri requires a **fixed port** and that the dev server not steal stdout from Rust errors. Copy
`templates/vite.config.ts` from this skill. Minimum required keys:

```ts
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  clearScreen: false,                    // don't hide Rust panics
  server: {
    port: 1420,
    strictPort: true,                    // fail fast if port taken
    host: host || false,                 // set for iOS-on-device
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],   // expose TAURI_ENV_* to import.meta.env
  build: {
    target: process.env.TAURI_ENV_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
```

Match `server.port` to `devUrl` in `tauri.conf.json`. Other frameworks (Next.js, Nuxt, SvelteKit,
Qwik, Leptos/Trunk): <https://v2.tauri.app/start/frontend/>

## v1 → v2 migration

Easiest path: run the automated migrator inside the v1 project, then audit.

```sh
cd my-v1-app
bunx @tauri-apps/cli@latest migrate
```

It updates `Cargo.toml`, rewrites `tauri.conf.json`, swaps `@tauri-apps/api/*` imports for plugin
packages, and writes a starter `capabilities/default.json`. Audit the diff before committing.

High-signal breaking changes (full list: <https://v2.tauri.app/start/migrate/from-tauri-1/>):

**Allowlist → Capabilities (ACL).** `tauri > allowlist` is gone. Each plugin command the frontend
uses must be enabled in `src-tauri/capabilities/default.json`, scoped per-window. There is no global
"allow everything" switch.

**Built-ins → opt-in plugins.** `fs`, `dialog`, `shell`, `http`, `clipboard`, `cli`, `notification`,
`os`, `process`, `global-shortcut`, `updater` are all separate crates and npm packages now. For each
one you use, add to `Cargo.toml`:

```toml
tauri-plugin-fs = "2"
```

register in `lib.rs`:

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .run(tauri::generate_context!())
```

and on the JS side `bun add @tauri-apps/plugin-fs`, importing from `@tauri-apps/plugin-fs` instead
of `@tauri-apps/api/fs`.

**`tauri.conf.json` schema reshuffle:**

- `tauri > allowlist` → removed (use capabilities).
- `tauri > cli` → `plugins > cli`.
- `tauri > updater` → `plugins > updater` (set `"active": "v1Compatible"` for already-shipped v1
  apps).
- `tauri > allowlist > protocol > assetScope` → `app > security > assetProtocol > scope`.
- `package > productName`, `tauri > windows`, `tauri > bundle` regrouped under `productName`,
  `app.windows`, `bundle`.

**Rust API split.** `tauri::api::*` is gone:

- `api::dialog` → `tauri-plugin-dialog`
- `api::http` → `tauri-plugin-http`
- `api::shell` / `api::process::Command` → `tauri-plugin-shell`
- `api::path` and `PathResolver` → `tauri::Manager::path()`
- `App::clipboard_manager` → `tauri-plugin-clipboard-manager`
- `App::global_shortcut_manager` → `tauri-plugin-global-shortcut`
- `updater` module → `tauri-plugin-updater`

**Multiwebview rename.** Rust `Window` → `WebviewWindow`; `Manager::get_window` →
`get_webview_window`.

**JS API trimmed.** `@tauri-apps/api` only exports `core` (was `tauri`), `path`, `event`, `window`.
Everything else is `@tauri-apps/plugin-*`.

**Cargo features removed:** `process-command-api`, `shell-open-api`, `windows7-compat`, `updater` —
all replaced by plugins.

## Troubleshooting checklist

- `tauri dev` hangs on "waiting for your frontend dev server" → `devUrl` port mismatches
  `vite.config.ts` server.port, or `strictPort: true` and port is busy.
- `error: linker 'cc' not found` (Linux) → missing `build-essential` / `base-devel`.
- `webkit2gtk-4.1 not found` (Linux) → install the `-dev` package for your distro.
- Frontend calls plugin command, gets `command not allowed` → add it to
  `src-tauri/capabilities/default.json`.
- Windows build complains about MSVC → `rustup default stable-msvc`.
- iOS build fails on `pod install` → `brew install cocoapods` and accept Xcode license: `sudo
  xcodebuild -license`.

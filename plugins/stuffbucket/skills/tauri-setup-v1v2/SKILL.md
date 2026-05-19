---
name: tauri-setup-v1v2
description: Use when migrating an existing Tauri 1.x app to Tauri 2.0 — running `tauri migrate`, rewriting `tauri.conf.json` (allowlist → capabilities, bundle moves, devPath/distDir renames), updating Rust APIs (Window → WebviewWindow, `tauri::api::*` → plugin crates), updating JS imports (`@tauri-apps/api/tauri` → `/core`, fs/dialog/shell/http moved to plugins), and bumping Cargo deps to `tauri = "2"` / `tauri-build = "2"`.
---

# Tauri 1.x → 2.0 Migration

Tauri 2.0 is **not** a drop-in upgrade. The allowlist is replaced by capabilities, dozens of APIs
moved to plugin crates, and the Rust `Window` type was renamed to `WebviewWindow` to make room for
multi-webview. Most of the mechanical work is handled by `tauri migrate`, but you must still: (a)
re-grant permissions via capabilities, (b) add the plugin crates you actually use, (c) rename JS
imports.

Work through `templates/migration-checklist.md` — it's the same list seasoned Tauri maintainers walk
top-to-bottom.

## Step 0 — Automated migration

```sh
# pick the package manager you use:
npm  install @tauri-apps/cli@latest && npm run tauri migrate
pnpm update  @tauri-apps/cli@latest && pnpm tauri migrate
bun  add -d  @tauri-apps/cli@latest && bunx tauri migrate
cargo install tauri-cli --version "^2.0.0" --locked && cargo tauri migrate
```

`tauri migrate` rewrites `tauri.conf.json`, converts the v1 allowlist into a `default.json`
capability file, bumps Cargo deps, and adds the plugin crates that map to allowlist entries. **It
does not** touch your Rust source or JS imports — those are manual.

> The CLI prints a TODO list at the end. Read it; treat it as additive to this skill, not redundant.

## Step 1 — `tauri.conf.json` schema diff

Key moves (run after `migrate` to verify):

```diff
- "package": { "productName": "MyApp", "version": "0.1.0" }
+ "productName": "MyApp",
+ "version": "0.1.0",
+ "mainBinaryName": "MyApp",
+ "identifier": "com.example.myapp",

- "tauri": {
-   "allowlist": { "fs": { "all": true }, "shell": { "open": true } },
-   "bundle": { "identifier": "com.example.myapp", "dmg": {...} },
-   "windows": [ { "fileDropEnabled": true } ],
-   "updater": { "active": true, "endpoints": [...] },
-   "systemTray": { "iconPath": "icons/tray.png" }
- },
+ "app": {
+   "windows": [ { "dragDropEnabled": true } ],
+   "withGlobalTauri": true,
+   "trayIcon": { "iconPath": "icons/tray.png" },
+   "security": { "assetProtocol": { "scope": [...] } }
+ },
+ "bundle": {
+   "macOS": { "dmg": {...} },
+   "linux": { "deb": {...}, "appimage": {...} },
+   "createUpdaterArtifacts": true
+ },
+ "plugins": {
+   "updater": { "endpoints": [...] }
+ },

- "build": { "distDir": "../dist", "devPath": "http://localhost:1420" }
+ "build": { "frontendDist": "../dist", "devUrl": "http://localhost:1420" }
```

Renames at a glance:

- `package.productName`/`version` → top-level
- `tauri` → `app`
- `tauri.allowlist` → **deleted**, replaced by `src-tauri/capabilities/*.json`
- `tauri.bundle` → top-level `bundle`; `dmg`/`deb`/`appimage` nested under `macOS`/`linux`
- `tauri.windows[].fileDropEnabled` → `app.windows[].dragDropEnabled`
- `tauri.updater` → `plugins.updater`; also set `bundle.createUpdaterArtifacts: true` (use
  `"v1Compatible"` if your installed users came from v1)
- `tauri.systemTray` → `app.trayIcon`
- `build.distDir` → `build.frontendDist`
- `build.devPath` → `build.devUrl`
- `build.withGlobalTauri` → `app.withGlobalTauri`

## Step 2 — `Cargo.toml`

```diff
 [build-dependencies]
-tauri-build = { version = "1", features = [] }
+tauri-build = { version = "2", features = [] }

 [dependencies]
-tauri = { version = "1", features = ["api-all", "system-tray", "updater"] }
+tauri = { version = "2", features = [] }
+tauri-plugin-shell = "2"        # if you used shell.open / Command
+tauri-plugin-dialog = "2"       # if you used dialog
+tauri-plugin-fs = "2"           # if you used fs
+tauri-plugin-http = "2"         # if you used http
+tauri-plugin-notification = "2" # if you used notification
+tauri-plugin-updater = "2"      # if you used the updater
+tauri-plugin-clipboard-manager = "2"
+tauri-plugin-process = "2"
+tauri-plugin-os = "2"

 [lib]                           # required for mobile targets
 name = "app_lib"
 crate-type = ["staticlib", "cdylib", "rlib"]
```

Removed feature flags: `api-all`, `system-tray`, `updater`, `reqwest-client`, `process-command-api`,
`shell-open-api`. Each became a separate plugin crate.

## Step 3 — Mobile-ready Rust entrypoint

```rust
// src-tauri/src/lib.rs  (new file; rename of old main.rs)
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        // ... register each plugin you depend on
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

```rust
// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() { app_lib::run(); }
```

## Step 4 — Rust API renames

| v1                                                            | v2                                                                                      |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `tauri::Window`                                               | `tauri::WebviewWindow`                                                                  |
| `WindowBuilder`                                               | `WebviewWindowBuilder`                                                                  |
| `WindowUrl`                                                   | `WebviewUrl`                                                                            |
| `Manager::get_window(label)`                                  | `Manager::get_webview_window(label)`                                                    |
| `tauri::api::path::*` / `PathResolver`                        | `app.path()` (on `Manager`)                                                             |
| `tauri::api::dialog::*`                                       | `tauri_plugin_dialog::DialogExt`                                                        |
| `tauri::api::http::*`                                         | `tauri_plugin_http` (re-exports `reqwest`)                                              |
| `tauri::api::shell::*` / `api::process::Command`              | `tauri_plugin_shell::ShellExt`                                                          |
| `tauri::api::notification::*`                                 | `tauri_plugin_notification::NotificationExt`                                            |
| `tauri::api::os::*`                                           | `tauri_plugin_os::*`                                                                    |
| `tauri::api::process::{current_binary, restart}`              | `tauri::process::*` (`app.handle().restart()` / `.exit()` via process plugin)           |
| `App::clipboard_manager()`                                    | `tauri_plugin_clipboard_manager::ClipboardExt`                                          |
| `App::global_shortcut_manager()`                              | `tauri_plugin_global_shortcut::GlobalShortcutExt`                                       |
| `SystemTray` / `SystemTrayMenu`                               | `tauri::tray::TrayIconBuilder` + `tauri::menu::*`                                       |
| `Menu`, `CustomMenuItem`, `Submenu`, `Builder::on_menu_event` | `tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder}` + `app.on_menu_event(..)` |

`Builder::on_menu_event` is removed — use `app.on_menu_event(..)` or
`WebviewWindow::on_menu_event(..)`.

## Step 5 — JavaScript API renames

```diff
- import { invoke } from "@tauri-apps/api/tauri";
+ import { invoke } from "@tauri-apps/api/core";

- import { WebviewWindow } from "@tauri-apps/api/window";
+ import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
```

These plugins moved out of `@tauri-apps/api` — install the matching `@tauri-apps/plugin-*` package:

| v1 import                         | v2 package                             |
| --------------------------------- | -------------------------------------- |
| `@tauri-apps/api/fs`              | `@tauri-apps/plugin-fs`                |
| `@tauri-apps/api/dialog`          | `@tauri-apps/plugin-dialog`            |
| `@tauri-apps/api/shell`           | `@tauri-apps/plugin-shell`             |
| `@tauri-apps/api/http`            | `@tauri-apps/plugin-http`              |
| `@tauri-apps/api/notification`    | `@tauri-apps/plugin-notification`      |
| `@tauri-apps/api/clipboard`       | `@tauri-apps/plugin-clipboard-manager` |
| `@tauri-apps/api/global-shortcut` | `@tauri-apps/plugin-global-shortcut`   |
| `@tauri-apps/api/os`              | `@tauri-apps/plugin-os`                |
| `@tauri-apps/api/process`         | `@tauri-apps/plugin-process`           |
| `@tauri-apps/api/cli`             | `@tauri-apps/plugin-cli`               |
| `@tauri-apps/api/updater`         | `@tauri-apps/plugin-updater`           |

`fs` plugin also renamed functions: `createDir`→`mkdir`, `readBinaryFile`→`readFile`,
`removeDir`/`removeFile`→`remove`, `renameFile`→`rename`, `writeBinaryFile`→`writeFile`. `Dir` enum
→ `BaseDirectory`.

## Step 6 — Permissions (the big one)

The v1 `allowlist` is gone. v2 uses **capabilities** — files in `src-tauri/capabilities/` that list
which windows can call which plugin commands. `tauri migrate` generates `default.json` for you;
review it.

Minimum capability for a default app:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "default capability for main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-open",
    "dialog:default"
  ]
}
```

If you see runtime errors like `command shell|open not allowed by ACL`, that's a missing permission
— see the `tauri-security` skill for the full ACL model.

## Step 7 — Env vars

CLI/build env vars were renamed (most for consistency). Common ones:

- `TAURI_PRIVATE_KEY` → `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_KEY_PASSWORD` → `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `TAURI_PLATFORM` → `TAURI_ENV_PLATFORM`
- `TAURI_DEBUG` → `TAURI_ENV_DEBUG`

Update CI scripts and `.env` files accordingly.

## Step 8 — Windows origin URL

In production on Windows, frontend now loads from `http://tauri.localhost` (not `https://`).
IndexedDB / LocalStorage / Cookies that existed under the v1 https origin will appear **empty** to
v2 users. If you have shipped users, set:

```json
"app": { "windows": [{ "useHttpsScheme": true }] }
```

so their stored data survives the upgrade.

## Step 9 — Updater

Built-in updater dialog is gone. You must call `check()` / `downloadAndInstall()` yourself (JS or
Rust). Set `bundle.createUpdaterArtifacts: true` (or `"v1Compatible"` for existing v1 users). See
`tauri-updater` skill.

## Verifying the migration

```sh
cargo tauri info     # confirms plugin crates registered, env detected
cargo tauri dev      # boots the app; watch for ACL errors in devtools console
cargo tauri build    # bundles; confirm artifacts under src-tauri/target/release/bundle/
```

If `dev` errors with `command X not allowed`, add the permission to a capability file. If `build`
errors about `createUpdaterArtifacts`, add it under `bundle`. If JS imports throw `module not
found`, you missed a `@tauri-apps/plugin-*` install.

# Tauri 1.x → 2.0 Migration Checklist

Walk this top-to-bottom. Cross items off only after you have verified them — `tauri migrate` handles most of the mechanical work but leaves gaps in Rust source, JS imports, and capabilities.

## Phase 0 — Backup

- [ ] `git switch -c tauri-v2-migration` (don't migrate on `main`).
- [ ] Commit a clean baseline so you can `git diff` what `tauri migrate` did.

## Phase 1 — Run the migrator

- [ ] Upgrade CLI: `npm i -D @tauri-apps/cli@latest` (or pnpm/bun/cargo equivalent).
- [ ] `npm run tauri migrate` (or `cargo tauri migrate`).
- [ ] Read the printed TODO list at the end — record items here.

## Phase 2 — Config audit (`tauri.conf.json`)

- [ ] `package.productName`/`version` moved to top-level.
- [ ] `mainBinaryName` set, matches `productName`.
- [ ] `identifier` is top-level (not under `bundle`).
- [ ] `tauri` key renamed to `app`.
- [ ] `tauri.allowlist` is gone; capabilities exist under `src-tauri/capabilities/`.
- [ ] `tauri.bundle` moved to top-level `bundle` with `macOS`/`linux`/`windows` subkeys.
- [ ] `tauri.windows[].fileDropEnabled` → `app.windows[].dragDropEnabled`.
- [ ] `tauri.systemTray` → `app.trayIcon`.
- [ ] `tauri.updater` → `plugins.updater`; `bundle.createUpdaterArtifacts` set (`true` for new apps, `"v1Compatible"` for upgrades).
- [ ] `build.distDir` → `build.frontendDist`.
- [ ] `build.devPath` → `build.devUrl`.
- [ ] `build.withGlobalTauri` → `app.withGlobalTauri`.

## Phase 3 — Cargo deps (`src-tauri/Cargo.toml`)

- [ ] `tauri-build = "2"`.
- [ ] `tauri = "2"`; remove `api-all`, `system-tray`, `updater` features.
- [ ] Added a `tauri-plugin-<name> = "2"` line for every v1 allowlist module you actually used.
- [ ] `[lib]` block present with `crate-type = ["staticlib", "cdylib", "rlib"]` (mobile-ready).

## Phase 4 — Rust source

- [ ] `src/lib.rs` exists with `#[cfg_attr(mobile, tauri::mobile_entry_point)] pub fn run() {}`.
- [ ] `src/main.rs` calls `app_lib::run()`.
- [ ] Every plugin you added in Cargo is registered with `.plugin(tauri_plugin_X::init())`.
- [ ] `tauri::Window` → `tauri::WebviewWindow` (and builder/url types).
- [ ] `Manager::get_window` → `Manager::get_webview_window`.
- [ ] `tauri::api::path::*` calls replaced with `app.path()` (needs `use tauri::Manager`).
- [ ] `tauri::api::dialog`, `http`, `shell`, `notification`, `os`, `process` calls replaced with plugin `*Ext` traits.
- [ ] `App::clipboard_manager` / `App::global_shortcut_manager` replaced with plugin equivalents.
- [ ] `SystemTray*` types replaced with `tauri::tray::TrayIconBuilder` + `tauri::menu::*`.
- [ ] `Builder::on_menu_event` removed; uses `app.on_menu_event` instead.
- [ ] No remaining `use tauri::api::*` imports (`grep -r 'tauri::api' src-tauri/src/`).

## Phase 5 — JavaScript source

- [ ] `@tauri-apps/api/tauri` → `@tauri-apps/api/core` (invoke import).
- [ ] `@tauri-apps/api/window` → `@tauri-apps/api/webviewWindow` (WebviewWindow class).
- [ ] Each removed module (`fs`, `dialog`, `shell`, `http`, `notification`, `clipboard`, `global-shortcut`, `os`, `process`, `cli`, `updater`) replaced with `@tauri-apps/plugin-*` package + npm install.
- [ ] `fs` plugin renames applied: `createDir`→`mkdir`, `readBinaryFile`→`readFile`, `removeDir`/`removeFile`→`remove`, `renameFile`→`rename`, `writeBinaryFile`→`writeFile`, `Dir`→`BaseDirectory`.
- [ ] `grep -r '@tauri-apps/api/\(fs\|dialog\|shell\|http\|notification\|clipboard\|global-shortcut\|os\|process\|cli\|updater\)' src/` returns nothing.

## Phase 6 — Capabilities

- [ ] `src-tauri/capabilities/default.json` exists and lists your `main` window.
- [ ] Every plugin you registered has the right `<plugin>:default` (or specific) permission listed.
- [ ] No capability targets `["*"]` for windows unless you genuinely want every window to inherit (multi-window apps usually want per-window capabilities).
- [ ] Boot the app and watch devtools console — any `not allowed by ACL` error means add a permission.

## Phase 7 — Env vars

- [ ] CI updated: `TAURI_PRIVATE_KEY` → `TAURI_SIGNING_PRIVATE_KEY`.
- [ ] CI updated: `TAURI_KEY_PASSWORD` → `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- [ ] Any build script reading `TAURI_PLATFORM` / `TAURI_DEBUG` / `TAURI_ARCH` updated to `TAURI_ENV_*`.

## Phase 8 — Windows storage compatibility

- [ ] If you have existing v1 users on Windows: `app.windows[].useHttpsScheme: true` set (preserves `https://tauri.localhost` origin so cookies/localStorage/IndexedDB survive).
- [ ] If green-field: leave default (`http://tauri.localhost`).

## Phase 9 — Updater behavior change

- [ ] Replaced built-in dialog with explicit `check()` + `downloadAndInstall()` calls (the dialog is gone in v2).
- [ ] Generated new signing key pair if v1 key is unavailable; updated `pubkey` in `plugins.updater`.

## Phase 10 — Smoke tests

- [ ] `cargo tauri info` — verify all plugins registered.
- [ ] `cargo tauri dev` — boots, no ACL errors in devtools.
- [ ] `cargo tauri build` — produces bundle artifacts.
- [ ] Install the bundle on a clean OS image and confirm the app launches.
- [ ] If shipping to existing users: install the new bundle over a v1 install and confirm settings/data survive.

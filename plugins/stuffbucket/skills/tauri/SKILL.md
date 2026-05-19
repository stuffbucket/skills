---
name: tauri
description: Root index for Tauri v2 (desktop + mobile apps from a Rust core and a WebView frontend) — setup, architecture, commands, events, plugins, security, bundling, sidecars, windows, tray/menu, updater, plugin authoring, debug/test. Use when the user asks about Tauri, `tauri.conf.json`, `invoke()`, capabilities, `tauri build`, or migrating Tauri v1 → v2. Routes to more specific tauri-* sub-skills.
---

# Tauri v2

Family covering everything from scaffolding a new Tauri 2 project to shipping signed installers
with auto-updates. Tauri pairs a Rust Core process with an OS-provided WebView (WKWebView /
WebView2 / webkitgtk); most questions split along that boundary.

## Routing table

Pick the parent skill for an unfamiliar area; jump straight to a deep-dive when you already know the sub-topic.

### Setup and scaffolding

- `tauri-setup` — parent for new projects, prereqs, framework integration, v1→v2 migration.
  - `tauri-setup-prerequisites` — Rust / WebView2 / webkit2gtk / Xcode CLT install + Android/iOS targets.
  - `tauri-setup-scaffolding` — `create tauri-app`, `tauri init`, generated `src-tauri/` layout.
  - `tauri-setup-vite` — Vite config, `frontendDist` / `devUrl`, mobile HMR via `TAURI_DEV_HOST`.
  - `tauri-setup-v1v2` — `tauri migrate`, allowlist → capabilities, API rename map.

### Architecture and internals

- `tauri-architecture` — Core vs WebView boundary, IPC channel, picking commands/events/raw IPC.
  - `tauri-architecture-ipc-internals` — `invoke()` over `postMessage`, JSON vs raw vs `Channel`, throughput limits.
  - `tauri-architecture-isolation-pattern` — sandboxed iframe IPC rewrite, AES-GCM, XSS mitigation scope.
  - `tauri-architecture-size-optimization` — Cargo release profile, `removeUnusedCommands`, feature pruning, `cargo bloat`.

### Commands (JS → Rust)

- `tauri-commands` — `#[tauri::command]`, args, returns, async, `invoke_handler`.
  - `tauri-commands-async-patterns` — `async fn`, `tokio::spawn`, cancellation, `Channel` progress, mutex-across-await pitfalls.
  - `tauri-commands-error-handling` — `thiserror`, serialized `{ kind, message }`, JS discriminated unions, panic safety.
  - `tauri-commands-state-injection` — `app.manage()`, `State<T>`, `tokio::sync::Mutex`, `Arc`/`RwLock`, `AppHandle::state`.

### Events (Rust → JS)

- `tauri-events` — `emit`/`listen`, picking between events and command returns.
  - `tauri-events-channels-streaming` — `tauri::ipc::Channel` for ordered single-consumer streams, backpressure.
  - `tauri-events-targeted-emit` — `emit_to`, `emit_filter`, JS `listen` / `listenAny` / `target`.

### Plugins (official)

- `tauri-plugins` — picking the right plugin, install, register, capability wiring.
  - `tauri-plugins-fs` — file IO, scopes, `BaseDirectory`, `watch()`, dotfile glob gotcha.
  - `tauri-plugins-dialog` — `open()` / `save()` / `message()` / `ask()` / `confirm()`.
  - `tauri-plugins-http` — `fetch()` with URL-pattern allowlist, CORS bypass.
  - `tauri-plugins-shell` — `Command.create()` / `.sidecar()`, regex arg validators, opener migration.
  - `tauri-plugins-notification` — `sendNotification`, permission flow, Android channels, mobile actions.
  - `tauri-plugins-store` — JSON key-value persistence, `autoSave`, when to switch to SQL.
  - `tauri-plugins-sql` — SQLite/MySQL/Postgres via `sqlx`, placeholder syntax, migrations.
  - `tauri-plugins-deep-link` — URL schemes, Universal/App Links, `tauri-plugin-single-instance` pairing.

### Security and capabilities

- `tauri-security` — capability files, plugin permissions, "not allowed" debugging, hardening.
  - `tauri-security-capabilities-authoring` — identifiers, `windows`/`webviews` label matching, platform splits, merge semantics.
  - `tauri-security-csp` — `app.security.csp`, Tauri-specific directives, hash injection, dev-vs-prod CSP delta.
  - `tauri-security-scopes` — object-form `allow`/`deny`, FS/shell/HTTP scope grammar, deny-wins rule.
  - `tauri-security-asset-protocol` — `convertFileSrc`, `asset://` URLs, persisted scopes, vs base64-via-command.

### Bundling and signing

- `tauri-bundling` — per-OS installers, code signing, store submission, GH Actions pipeline.
  - `tauri-bundling-macos-signing` — Developer ID, notarytool, hardened runtime, universal `.app`, App Store path.
  - `tauri-bundling-windows-signing` — PFX / Azure Key Vault / Trusted Signing, SmartScreen, MSI vs NSIS.
  - `tauri-bundling-linux-packaging` — AppImage / deb / rpm / Flatpak / Snap / AUR, glibc baseline.
  - `tauri-bundling-mobile-stores` — App Store Connect, Play Console, AAB vs APK, Play Integrity.
  - `tauri-bundling-github-actions` — `tauri-action@v0` OS matrix, secrets, draft-publish, caching.

### Sidecars

- `tauri-sidecar` — bundling external binaries, `externalBin`, lifecycle.
  - `tauri-sidecar-lifecycle` — `CommandChild` in state, `CommandEvent` drain, supervised restart, kill on exit.
  - `tauri-sidecar-node-sidecar` — Node/Bun/Deno compilation, dev-loop proxy, HTTP-localhost model.
  - `tauri-sidecar-target-triples` — naming `bin-<triple>[.exe]`, universal `lipo`, build-script automation.

### Windows and views

- `tauri-windows` — decorations, transparency, multi-window, splashscreen.
  - `tauri-windows-custom-titlebar` — `decorations: false`, drag region, traffic-light buttons.
  - `tauri-windows-multi-window` — `WebviewWindowBuilder`, labels, cross-window `emit_to`, close vs hide.
  - `tauri-windows-splashscreen` — splash + main window pattern, Rust `setup` hook, readiness signaling.
  - `tauri-windows-transparency-vibrancy` — `transparent: true`, `window-vibrancy`, Mica/Acrylic, platform matrix.

### Tray and menus

- `tauri-tray-menu` — tray icon, macOS menu bar, window menus, context menus.
  - `tauri-tray-menu-bar-app` — popover-under-tray pattern, `tauri-plugin-positioner`, `LSUIElement`.
  - `tauri-tray-menu-context-menus` — `Menu::popup`, dynamic rebuilds, `on_menu_event`.
  - `tauri-tray-menu-dynamic-updates` — stashed `MenuItem` handles, `set_text` / `set_enabled` / `set_checked`.

### Updater

- `tauri-updater` — keys, plugin config, manifest hosting, check/download/install flow.
  - `tauri-updater-signing-keys` — Ed25519 keypair, CI secrets, rotation constraint.
  - `tauri-updater-github-releases` — `latest.json` on GH Releases, `{{target}}` placeholders, fallbacks.
  - `tauri-updater-install-flow` — `check()`, `downloadAndInstall`, progress UX, deferred install, version compare.

### Custom plugin authoring

- `tauri-plugin-dev` — scaffold a crate, expose commands, permissions, JS API, mobile native code.
  - `tauri-plugin-dev-guest-js` — `guest-js/index.ts`, typed Channel wrappers, dual ESM/CJS, lockstep versioning.
  - `tauri-plugin-dev-permissions-manifest` — `build.rs`, `permissions/autogenerated/`, default sets, `JsonSchema` scopes.
  - `tauri-plugin-dev-mobile-bridges` — `@TauriPlugin` Kotlin, Swift `Plugin`, `run_mobile_plugin`, native debug.

### Debug and test

- `tauri-debug-test` — devtools, lldb, logs, e2e, mocked IPC.
  - `tauri-debug-test-devtools-production` — `--debug` builds, `devtools` Cargo feature, App Store ban.
  - `tauri-debug-test-mock-ipc` — `mockIPC` / `mockWindows`, `shouldMockEvents`, jsdom polyfills.
  - `tauri-debug-test-webdriver-e2e` — `tauri-driver`, WebKitWebDriver + xvfb, msedgedriver, CI matrix.

## Cross-family edges

- **Frontend** — `react-best-practices`, `react-composition` for the JS half; `figma-make-to-vite` for bootstrapping the UI before bolting on Tauri.
- **Linux build reproduction** — `colima-docker-setup` when verifying `ubuntu-22.04` glibc baselines locally on macOS.
- **Design polish** — `design-frontend` / `design-polish` for the WebView side once functional.
- **Code review** — `code-analysis-skill`, `code-review-cycle` when reviewing capability files for over-broad scopes.

## Decision flow

1. New Tauri app from scratch → `tauri-setup-scaffolding` (or `tauri-setup` if multiple unknowns).
2. Existing Tauri 1.x → `tauri-setup-v1v2`.
3. "Where do I put this feature?" (command vs event vs raw IPC) → `tauri-architecture`.
4. Known sub-topic — drop straight to the deep-dive (e.g. CSP issue → `tauri-security-csp`).
5. Permission error at runtime ("not allowed") → `tauri-security` → `tauri-security-scopes`.
6. Release blocker (signing, store, updater) → `tauri-bundling` or `tauri-updater`.

## When NOT to use this skill

- General web-platform / WebView questions unrelated to Tauri (use a browser/WebKit reference).
- Electron-specific code paths — Tauri shares concepts but not APIs.
- Plain Rust questions with no Tauri surface — go to a Rust reference.
- Native macOS/iOS/Windows UI work outside the WebView — Tauri only helps where it embeds.

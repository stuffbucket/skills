# Stuffbucket Skills

[![GitHub stars](https://img.shields.io/github/stars/stuffbucket/skills?style=flat-square)](https://github.com/stuffbucket/skills/stargazers)
[![npm version](https://img.shields.io/npm/v/@stuffbucket/skills?style=flat-square)](https://www.npmjs.com/package/@stuffbucket/skills)
[![License: MIT](https://img.shields.io/github/license/stuffbucket/skills?style=flat-square)](LICENSE)

**On-demand skills for AI agents.** Instead of stuffing every capability into the context window, agents discover and load only what they need — via a 2-tool MCP server that scales to any number of
skills at constant cost.

Works with Claude, Copilot, and any MCP-compatible client.

## Quick Start

Add the MCP server to any client:

```json
{
  "mcpServers": {
    "skill-router": {
      "command": "npx",
      "args": ["-y", "@stuffbucket/skills"]
    }
  }
}
```

Or install as a plugin marketplace:

```sh
# Claude Code
/plugin marketplace add stuffbucket/skills

# Copilot CLI
/plugin marketplace add stuffbucket/skills
```

That's it. Your agent can now discover and load skills on demand.

## How It Works

The skill-router exposes two tools — `list_skills` and `get_skill` — instead of registering every skill separately. Agents search by intent, load what they need, and the context window cost stays
constant.

Each skill is a self-contained package: a `SKILL.md` with instructions plus optional `scripts/`, `references/`, and `assets/`. Skills are authored once by an expert and delivered automatically to
anyone whose agent needs them.

## Create a Skill in 5 Minutes

Anyone can contribute a skill. The entire workflow is scaffold → edit → validate → submit:

```bash
# 1. Scaffold
npm run new -- my-new-skill

# 2. Edit the generated SKILL.md
#    - Set `name` and `description` in the frontmatter (this is what triggers the skill)
#    - Write instructions in the body (what the agent needs to know)
#    - Add scripts/, references/, or assets/ if needed

# 3. Validate
npm run validate:one -- plugins/stuffbucket/skills/my-new-skill

# 4. Package and submit
npm run package -- plugins/stuffbucket/skills/my-new-skill
# Open a "New skill" issue and attach the .skill file — CI validates and opens a PR
```

**Key principles** (from the [skill-creator guide](plugins/stuffbucket/skills/skill-creator/SKILL.md)):

- **The agent is already smart.** Only include knowledge it doesn't have — specific workflows, schemas, tool integrations, domain expertise.
- **Context window is a public good.** Keep SKILL.md under 500 lines. Split large content into `references/` files.
- **Match freedom to fragility.** Text instructions for flexible tasks, executable scripts for brittle ones.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide, or read the [Best Practices](docs/best-practices.md).

<!-- BEGIN:SKILLS -->
## Available Skills

| Skill | Description |
| --- | --- |
| `azure-cli-setup` | Install and configure Azure CLI on macOS for local development |
| `boundary-domain-closure` | Structure code so that the set of representable states equals the set of valid states for a given domain, resolving the boundary condition d(S) → ∅ |
| `boundary-drift-detection` | Detect when code changes reopen closed domains or widen boundary conditions — expanding d(S) where it was resolved |
| `boundary-generation-control` | Constrain AI code generation to preserve or resolve boundary conditions — never expand them |
| `boundary-noise-model` | Characterize the stochastic noise envelope of LLM code generation to distinguish acceptable sampling variance from semantic drift |
| `boundary-scope-escape` | Enumerate values whose identity escapes their lexical scope — the first step of differential closure analysis |
| `boundary-seed-encoding` | Encode shared values as seeds in domain-native representations that toolchains enforce inescapably, resolving boundary conditions by closing domains in dependency order |
| `code-analysis-skill` | A skill for analyzing code quality, identifying patterns, and suggesting improvements |
| `code-review-cycle` | Run a full code review cycle on recent changes: lint auto-fix, three-agent quality review (reuse, quality, efficiency), boundary analysis with separate new-file and modified-file review tracks, code smell audit with deferred triggers, and error-contract review |
| `colima-docker-setup` | Set up Docker, docker compose, and docker buildx on macOS using Colima |
| `example-skill` | An example skill to demonstrate the structure and format for Agent Skills. |
| `figma-make-to-vite` | Initializes a Vite + React + TypeScript project and integrates a Figma Make exported ZIP prototype into it so it runs locally via `npm run dev` |
| `file-management-skill` | A skill for managing files and directories in a project |
| `ghostty-config` | Configure and optimize Ghostty terminal for any machine |
| `git-workflow-skill` | Git operations and workflows |
| `npm-trusted-publishing` | Publish npm packages from GitHub Actions using OIDC trusted publishing with provenance |
| `pages-build-vite` | Locally builds the Vite project and verifies the dist/ output before committing |
| `pages-commit-vite` | Stages and commits the GitHub Pages configuration files to the local git repo |
| `pages-prepare-vite` | Prepares a Vite project for GitHub Pages deployment via GitHub Actions |
| `pages-publish-vite` | Monitors the GitHub Actions deployment workflow and reports the live GitHub Pages URL |
| `pages-push-vite` | Pushes the current branch to the git remote, triggering the GitHub Actions workflow that builds and deploys the Vite project to GitHub Pages |
| `skill-creator` | Guide for creating effective skills |
| `tauri-architecture` | Use when reasoning about Tauri v2 internals — process boundaries (Core vs WebView), the IPC channel, binary-size tradeoffs, or deciding between commands/events/raw IPC for a given feature. |
| `tauri-architecture-ipc-internals` | Use when reasoning about how Tauri v2's `invoke()` actually crosses the process boundary — the postMessage bridge, `__TAURI_INTERNALS__`, request/response correlation, JSON vs raw-byte vs `Channel` serialization, sync-stringify cost, throughput limits (~1k JSON commands/sec/WebView), and when to bypass the JSON path with raw IPC. |
| `tauri-architecture-isolation-pattern` | Use when enabling Tauri v2's Isolation pattern — configuring `app.security.pattern: { use: "isolation", options: { dir } }`, authoring the sandboxed iframe app with `__TAURI_ISOLATION_HOOK__`, understanding the AES-GCM rewriting of IPC payloads, what XSS-class attacks it mitigates (and what Core-side bugs it does not), the one-isolation-app-per-Tauri-app constraint, and the Windows ESM-in-sandboxed-iframe caveat. |
| `tauri-architecture-size-optimization` | Use when shrinking a Tauri v2 release binary — tuning the Cargo release profile (`opt-level`, `lto`, `codegen-units`, `panic`, `strip`), enabling `build.removeUnusedCommands`, pruning default features on `tauri` and plugin crates, frontend tree-shaking via Vite `manualChunks` and dynamic imports, optional UPX compression with its platform caveats, and measuring with `cargo bloat` and `du`. |
| `tauri-bundling` | Use when packaging a Tauri v2 app for release — building per-OS installers (dmg, msi, nsis, appimage, deb, rpm), code signing (macOS notarization + Apple Developer ID, Windows Authenticode, Linux AppImage signing), store submission (App Store, MS Store, Google Play), or wiring a GitHub Actions release pipeline. |
| `tauri-bundling-github-actions` | Use when wiring a production GitHub Actions release pipeline for a Tauri v2 app — `tauri-apps/tauri-action@v0` matrix across `macos-latest` (Apple Silicon) / `macos-13` (Intel) / `windows-latest` / `ubuntu-22.04` / `ubuntu-22.04-arm`, declaring per-platform signing secrets (Apple notarization, Windows code-sign, Linux GPG, updater Ed25519, MS Store), tag-triggered vs manual `workflow_dispatch`, draft-release-then-publish, conditional updater artifact generation, and caching cargo + node_modules. |
| `tauri-bundling-linux-packaging` | Use when packaging a Tauri v2 app for Linux distribution — choosing between AppImage (portable, GPG-signed), deb (Debian/Ubuntu apt repos with postinst hooks), rpm (Fedora/RHEL with GPG signing via `TAURI_SIGNING_RPM_KEY`), Flatpak (Flathub submission), Snap (Snap Store), and an AUR PKGBUILD; picking the glibc baseline (build on Ubuntu 22.04 / Debian 12 for max compatibility); and deciding which format to ship for which audience. |
| `tauri-bundling-macos-signing` | Use when signing and notarizing a Tauri v2 macOS build for distribution outside the Mac App Store — provisioning a Developer ID Application cert, wiring `APPLE_SIGNING_IDENTITY` (or base64 `APPLE_CERTIFICATE` for CI), authoring hardened-runtime entitlements, choosing notarytool API-key vs Apple-ID auth, stapling the ticket, producing a universal-binary `.app`, and the parallel App Store Connect path (Apple Distribution cert + `.pkg` via `productbuild`). |
| `tauri-bundling-mobile-stores` | Use when submitting a Tauri v2 mobile build to the iOS App Store or Google Play — `tauri ios build --export-method app-store-connect` with Apple Distribution cert + provisioning profile, uploading via `xcrun altool` (or Transporter / TestFlight); `tauri android build -- --aab` with a `keystore.properties`-driven Gradle signingConfig, AAB vs APK choice, the first-upload-must-be-manual Play Console gotcha, and Play Integrity setup. |
| `tauri-bundling-windows-signing` | Use when signing a Tauri v2 Windows installer (MSI or NSIS) for SmartScreen reputation and trusted-installer UX — provisioning a code-signing cert (PFX, Azure Key Vault via relic, or Azure Trusted Signing), wiring `WINDOWS_CERTIFICATE` (base64 PFX) + `WINDOWS_CERTIFICATE_PASSWORD` env vars or a custom `signCommand`, choosing MSI vs NSIS, picking the right WebView2 install mode, warming up SmartScreen reputation, and submitting to the Microsoft Store. |
| `tauri-commands` | Use when wiring JavaScript→Rust calls in a Tauri v2 app — defining `#[tauri::command]` handlers, passing args, returning values/errors, async commands, accessing app state or the AppHandle, or registering commands in the invoke_handler. |
| `tauri-commands-async-patterns` | Use when writing async Tauri v2 commands — deciding when a command should be `async fn`, spawning background tasks that outlive the command via `tokio::spawn` + cloned `AppHandle`, cancellable long-running work with `tokio::select!` + `CancellationToken`, streaming progress via `Channel` instead of polling, and avoiding deadlock anti-patterns (std-mutex across `.await`, holding guards across awaits). |
| `tauri-commands-error-handling` | Use when designing production error handling for Tauri v2 commands — `thiserror` enums, manual `Serialize` impls emitting `{ kind, message }` for JS discriminated unions, `Result` returns, `?` propagation, panic safety at the IPC boundary, structured logging via `tracing`, and a typed `CommandError` union with exhaustiveness on the JS side. |
| `tauri-commands-state-injection` | Use when wiring managed state into Tauri v2 commands — registering state with `app.manage()` in `setup`, accessing it via `State`, async state with `tokio::sync::Mutex` (never std::sync::Mutex across `.await`), interior mutability (`Arc`, `RwLock`, `parking_lot`), `AppHandle::state::T()` outside commands, or composing multiple state types. |
| `tauri-debug-test` | Use when debugging or testing a Tauri v2 app — enabling devtools in production builds, attaching VS Code/RustRover/lldb to the Rust process, viewing Rust logs, running WebDriver e2e tests, or mocking `invoke()` calls in unit tests. |
| `tauri-debug-test-devtools-production` | Use when you need the WebView inspector in a shipped Tauri v2 build — `tauri build --debug` to keep the dev console enabled, the `devtools` Cargo feature on the `tauri` crate for opt-in release builds, programmatic `window.open_devtools()` behind a `#[cfg(feature = "devtools")]` shortcut, the **macOS App Store ban** (private API — strip the feature before submitting), `tauri-plugin-log` for routing logs to webview console + stdout + file, `RUST_LOG`/`RUST_BACKTRACE`, and the Chrome-DevTools-Protocol gap on macOS WKWebView vs Linux/Windows. |
| `tauri-debug-test-mock-ipc` | Use when unit-testing the frontend of a Tauri v2 app under jsdom/happy-dom — intercepting `invoke()` calls with `mockIPC`, faking multiple windows with `mockWindows`, spying on `__TAURI_INTERNALS__.invoke` for call-count assertions, simulating Rust→JS events with `shouldMockEvents` (Tauri 2.7+), wiring `clearMocks()` into `afterEach`, polyfilling `globalThis.crypto.subtle` under jsdom, and the Vitest-vs-bun-test compatibility notes. |
| `tauri-debug-test-webdriver-e2e` | Use when adding end-to-end tests to a Tauri v2 app via WebDriver — installing `tauri-driver` (cargo install), the Linux `WebKitWebDriver` + `xvfb-run` headless setup, the Windows `msedgedriver` version-must-match-Edge dance via `msedgedriver-tool`, the macOS-desktop gap (no WKWebView driver), WebdriverIO vs Selenium config (`capabilities: [{ 'tauri:options': { application } }]`, port 4444), spawning `tauri-driver` from `beforeSession`/`before` and killing it on shutdown, and the GitHub Actions matrix that runs the suite headless on `ubuntu-latest` + `windows-latest`. |
| `tauri-events` | Use when pushing data from Rust to JS in a Tauri v2 app — global events with `emit`/`listen`, targeted events with `emit_to`, streaming via `Channel`, or deciding between events and command return values for a feature. |
| `tauri-events-channels-streaming` | Use when streaming data from Rust to JS in a Tauri v2 app with `tauri::ipc::Channel` — download/upload progress, child-process tail, long-running parsers, or any single-consumer ordered stream |
| `tauri-events-targeted-emit` | Use when an event in a Tauri v2 app should reach only some windows/webviews — `emit_to` for one or many labels, `emit_filter` for predicate-based routing, and the JS-side `listen` / `listenAny` / `target` distinction |
| `tauri-plugin-dev` | Use when authoring a custom Tauri v2 plugin — scaffolding the crate (`tauri plugin new`), exposing commands, declaring permissions with auto-generated manifest, providing a JS API package, and handling mobile platform code (Swift/Kotlin) if needed. |
| `tauri-plugin-dev-guest-js` | Use when authoring the npm-package half of a Tauri v2 plugin — the `guest-js/index.ts` exporting friendly wrappers around `invoke('plugin:my-plugin/cmd_name', args)`, typed `Channel` streaming wrappers, `addPluginListener('plugin-name', 'event-name', cb)` for native-emitted events, the `package.json` `exports` map for dual ESM/CJS, bundling with `tsup` or `rollup`, lockstep versioning with the Rust crate, and the publish workflow. |
| `tauri-plugin-dev-mobile-bridges` | Use when adding iOS (Swift) or Android (Kotlin) native code to a Tauri v2 plugin — `tauri plugin android add` / `ios add` scaffolds, the `@TauriPlugin` Kotlin class with `@Command` methods, the Swift `Plugin` subclass with `@objc func cmd(_ invoke: Invoke)`, marshaling args via `@InvokeArg` / `Decodable`, calling native code from Rust with `PluginHandle::run_mobile_plugin("methodName", payload)`, the `checkPermissions` / `requestPermissions` UX, and debugging the native side in Xcode / Android Studio. |
| `tauri-plugin-dev-permissions-manifest` | Use when wiring the `permissions/` directory and autogenerated manifest of a Tauri v2 plugin — writing `build.rs` with `tauri_plugin::Builder::new(COMMANDS).build()`, the per-command `permissions/autogenerated/commands/*.toml` files, hand-written `permissions/default.toml` for the `plugin:default` set, permission sets that compose multiple `allow-*` entries, platform-specific manifest entries, and a `schemars::JsonSchema` scope struct so capability files get IDE autocomplete. |
| `tauri-plugins` | Use when adding an official Tauri v2 plugin — picking the right plugin (fs/dialog/shell/http/store/notification/clipboard/global-shortcut/logging/os/opener/process/single-instance/autostart/deep-link/sql/websocket/upload/stronghold/cli), installing it (Cargo + npm), registering it in Rust, and granting the required capability permissions. |
| `tauri-plugins-deep-link` | Use when registering custom URL schemes or universal/app links for a Tauri v2 app — schema declaration in `tauri.conf.json` under `plugins.deep-link`, iOS Associated Domains, Android ``intent-filter`` entries, `onOpenUrl` + `getCurrent` in JS, runtime `register()` on Linux/Windows, pairing with `tauri-plugin-single-instance` so a second launch routes the URL to the existing window, and dev-time testing per OS. |
| `tauri-plugins-dialog` | Use when showing native pickers or modal dialogs in a Tauri v2 app — `open()` / `save()` for files, `message()` / `ask()` / `confirm()` for prompts, multi-select, directory mode, file-type filters, the `dialog:allow-open` / `dialog:allow-save` / `dialog:allow-message` / `dialog:allow-ask` / `dialog:allow-confirm` permissions, and the `blocking_` vs async variants in Rust. |
| `tauri-plugins-fs` | Use when reading/writing files or directories from a Tauri v2 app — `@tauri-apps/plugin-fs` install, scope objects with `$HOME`/`$APPDATA`/`$RESOURCE` placeholders, the `fs:allow-*` permission identifiers (`fs:allow-read-text-file`, `fs:allow-write-binary-file`, `fs:scope`), `BaseDirectory` enum, `watch()` / `watchImmediate()` (needs `watch` feature), and the `requireLiteralLeadingDot` Unix dotfile gotcha. |
| `tauri-plugins-http` | Use when making HTTP requests from a Tauri v2 frontend — `fetch()` from `@tauri-apps/plugin-http`, the URL-pattern + method allowlist scope, why this exists (CORS bypass, no preflight, custom headers, proxy support), streaming responses, the `http:default` and per-method permissions, and when to use it instead of browser `fetch`. |
| `tauri-plugins-notification` | Use when sending native OS notifications from a Tauri v2 app — `sendNotification()`, the `isPermissionGranted()` / `requestPermission()` flow (mandatory on macOS first call), Android notification channels, mobile actions / inputs via `registerActionTypes()` + `onAction()`, attachments, custom icons/sounds, and the `notification:default` permission. |
| `tauri-plugins-shell` | Use when running an external command, spawning a sidecar, or opening a URL/file from a Tauri v2 app — `Command.create()` vs `Command.sidecar()`, `spawn`/`output`/`kill`/`write`, the `shell:allow-execute` scope with regex arg validators, `shell:allow-spawn`, `shell:allow-kill`, and the move from deprecated `shell.open()` to the modern `@tauri-apps/plugin-opener` (`openUrl` / `openPath` / `revealItemInDir`). |
| `tauri-plugins-sql` | Use when wiring a real database into a Tauri v2 app — SQLite / MySQL / Postgres via `sqlx`, `Database.load("sqlite:db.sqlite")`, `execute()` vs `select()`, the per-DB placeholder syntax (`<!-- BEGIN:SKILLS -->` for SQLite/Postgres, `?` for MySQL), migrations registered in Rust with `Builder::default().add_migrations(...)`, the `sqlite-bundled` Cargo feature, and mobile considerations. |
| `tauri-plugins-store` | Use when persisting key-value settings or small JSON state in a Tauri v2 app — `Store::load(app, "settings.json")` / `app.store(...)` in Rust, `load()`/`get()`/`set()`/`save()`/`has()`/`delete()`/`clear()` in JS, `autoSave` debounce, file location under `app_data_dir`, the JSON-only constraint, and when to reach for `tauri-plugin-sql` instead. |
| `tauri-security` | Use when configuring Tauri v2 access control — writing capability files, granting plugin permissions, scoping filesystem/shell/http access, debugging "not allowed" errors, or hardening CSP/asset protocol/http headers. |
| `tauri-security-asset-protocol` | Use when serving local files into a Tauri v2 WebView — enabling `app.security.assetProtocol`, scoping which paths it exposes, using `convertFileSrc` to produce `asset://` / `https://asset.localhost` URLs, the matching CSP `img-src`/`media-src` directives, persisting user-picked paths with `tauri-plugin-persisted-scope` (`protocol-asset` feature), and choosing the asset protocol over base64-via-command for performance. |
| `tauri-security-capabilities-authoring` | Use when hand-writing Tauri v2 capability JSON files — choosing identifiers, matching windows/webviews by label (never title), filtering by platform, distinguishing `local` vs `remote.urls`, merging multiple capability files with set-union semantics, naming platform-specific files (`-android.json`, `-ios.json`, `-desktop.json`), and understanding how `tauri build` validates them. |
| `tauri-security-csp` | Use when setting a Content-Security-Policy in a Tauri v2 app — configuring `app.security.csp` and `app.security.devCsp`, the Tauri-specific directives (`ipc:`, `http://ipc.localhost`, `asset:`, `https://asset.localhost`, `'wasm-unsafe-eval'`), automatic hash injection for inline scripts/styles, when to lift `dangerousDisableAssetCspModification`, frame-ancestors, nonces, and the dev-vs-prod delta (Vite HMR `ws://`, broader `connect-src` in dev). |
| `tauri-security-scopes` | Use when scoping Tauri v2 plugin permissions — writing object-form permissions with `allow`/`deny`, FS path scopes with `$HOME`/`$APPDATA`/`$RESOURCE` placeholders and glob rules, shell scopes that validate `name`/`command`/`args` (with regex args and `sidecar: true`), HTTP URL scopes with method filters, and the asset-protocol scope |
| `tauri-setup` | Use when scaffolding a Tauri v2 app, fixing missing system prerequisites (Rust, WebView2, webkit2gtk, Xcode CLT), integrating a JS framework (especially Vite) with Tauri, or migrating an existing Tauri v1 project to v2. |
| `tauri-setup-prerequisites` | Use when installing Tauri v2 system prerequisites on a specific OS (Linux distro, macOS, Windows, Windows Server), debugging "webkit2gtk not found" / "WebView2 missing" / "link.exe not found" / broken Xcode CLT, or preparing Android/iOS targets |
| `tauri-setup-scaffolding` | Use when standing up a new Tauri v2 project from scratch or bolting Tauri onto an existing JS app — running `bun create tauri-app` (or `npm create tauri-app@latest`), picking the framework/package-manager flags, understanding the generated `src-tauri/` layout (`Cargo.toml`, `tauri.conf.json`, `capabilities/`, `icons/`, `src/lib.rs` vs `main.rs`), or invoking `tauri init` to inject Tauri into a repo that already has a Vite/Next/SvelteKit/etc |
| `tauri-setup-v1v2` | Use when migrating an existing Tauri 1.x app to Tauri 2.0 — running `tauri migrate`, rewriting `tauri.conf.json` (allowlist → capabilities, bundle moves, devPath/distDir renames), updating Rust APIs (Window → WebviewWindow, `tauri::api::*` → plugin crates), updating JS imports (`@tauri-apps/api/tauri` → `/core`, fs/dialog/shell/http moved to plugins), and bumping Cargo deps to `tauri = "2"` / `tauri-build = "2"`. |
| `tauri-setup-vite` | Use when wiring Vite into a Tauri v2 project — writing `vite.config.ts`, setting `package.json` scripts, configuring `frontendDist`/`devUrl` in `tauri.conf.json`, exposing `TAURI_ENV_*` vars to the frontend, fixing iOS/Android HMR over `TAURI_DEV_HOST`, or diagnosing port/host mismatches between Vite and Tauri. |
| `tauri-sidecar` | Use when bundling an external binary (Go/Rust/Python/Node) with a Tauri v2 app and running it as a sidecar process — including target-triple naming, externalBin config, shell:allow-execute permissions, stdin/stdout piping, and lifecycle (kill on app exit). |
| `tauri-sidecar-lifecycle` | Use when managing the lifetime of a sidecar child in a Tauri v2 app — stashing `CommandChild` in `Mutex`Option...`` managed state, draining `CommandEvent::{Stdout,Stderr,Terminated,Error}` on a `tokio::spawn` receiver, supervised restart-on-crash with exponential backoff, killing on `RunEvent::ExitRequested` (and the Windows `taskkill /T /F /PID` escalation when grandchildren survive), choosing graceful SIGTERM vs immediate SIGKILL, and HTTP health-check polling against the sidecar's port. |
| `tauri-sidecar-node-sidecar` | Use when embedding a Node.js, Bun, or Deno program as a sidecar in a Tauri v2 app — picking the right single-binary compiler (`bun build --compile` / `@yao-pkg/pkg` / `deno compile` / `nexe`), naming the output for `externalBin`, running the dev loop without compiling each iteration (Vite UI on :1420 + `bun run dev` proxy on :4142 — the pattern this repo uses), the HTTP-server-as-sidecar model with capability-free localhost, the stdin/stdout pipe alternative, and making sure the child exits with the app. |
| `tauri-sidecar-target-triples` | Use when picking, naming, or automating per-target sidecar binaries in a Tauri v2 app — Rust target triples for macOS (incl |
| `tauri-tray-menu` | Use when building a Tauri v2 tray icon, system menu bar (macOS), window menu, or context menus — including click handlers, dynamic menu updates, and positioning a window relative to the tray. |
| `tauri-tray-menu-bar-app` | Use when building a Tauri v2 menu-bar / status-bar app — tray icon with a popover window anchored under the tray via `tauri-plugin-positioner`, left-click toggle, blur-to-hide, frameless+transparent+always-on-top window, hiding the macOS Dock icon (`LSUIElement` / `bundle.macOS.dockIcon`), and Windows tray-area differences. |
| `tauri-tray-menu-context-menus` | Use when building right-click context menus on Tauri v2 windows — `Menu::with_items(&app, &[...])`, `menu.popup(window)` / `popup_at(window, position)`, dynamic context-aware menus rebuilt per right-click, dispatching clicks via `on_menu_event` or per-item closures, accessing managed state from menu handlers, and the JS-side `oncontextmenu` bridge that triggers the popup. |
| `tauri-tray-menu-dynamic-updates` | Use when mutating Tauri v2 menus at runtime — stashing `MenuItem` / `CheckMenuItem` / `IconMenuItem` handles in managed state (`AppHandle::manage(MenuRefs { .. |
| `tauri-updater` | Use when adding auto-updates to a Tauri v2 app — generating signing keys, configuring the updater plugin, hosting the update manifest (static JSON or GitHub releases), and wiring the check/download/install flow in JS or Rust |
| `tauri-updater-github-releases` | Use when hosting Tauri v2 update artifacts and the `latest.json` manifest on GitHub Releases — wiring `tauri-apps/tauri-action` to build + sign + upload a multi-OS matrix (darwin-aarch64, darwin-x86_64, linux-x86_64, windows-x86_64), using the `latest/download/latest.json` redirect so installed apps always hit the current release, expanding the `{{target}}` / `{{arch}}` / `{{current_version}}` placeholders in `plugins.updater.endpoints`, providing fallback hosts via the endpoints array, and manually uploading + crafting `latest.json` if you're not using tauri-action |
| `tauri-updater-install-flow` | Use when wiring the Tauri v2 updater's check / download / install UX — `import { check } from '@tauri-apps/plugin-updater'`, `update.downloadAndInstall(handler)` with `Started` / `Progress` / `Finished` events, mapping those to a progress bar in the UI, calling `relaunch()` from `@tauri-apps/plugin-process` to restart, implementing skip-this-version with `version_comparator`, deferred install ("download now, install on next launch") by separating `download()` and `install()`, gating mandatory vs optional updates, and the equivalent Rust flow via `app.updater()?.check().await?` |
| `tauri-updater-signing-keys` | Use when managing the Tauri v2 updater's Ed25519 signing keypair — generating it with `bunx tauri signer generate -w ~/.tauri/myapp.key`, embedding the public key in `tauri.conf.json` `plugins.updater.pubkey`, wiring `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` into CI secrets without committing them, and understanding the rotation constraint (old clients can never validate a new public key, so a "rotation" actually means shipping a new app version first with the new key trusted, then phasing the old one out) |
| `tauri-windows` | Use when creating, customizing, or managing Tauri v2 windows — decorations, transparency, custom titlebar, multi-window, child webviews, splashscreen pattern, or mobile multi-window setups. |
| `tauri-windows-custom-titlebar` | Use when building a frameless Tauri v2 window with a custom HTML titlebar — setting `decorations: false`, wiring `data-tauri-drag-region`, implementing minimize/maximize/close traffic-light buttons via `getCurrentWindow()`, granting the `core:window:allow-*` capabilities, handling double-click-to-maximize, and bridging macOS traffic-light placement vs Windows snap-layouts (`core:window:allow-internal-toggle-maximize`). |
| `tauri-windows-multi-window` | Use when managing many Tauri v2 windows — declaring static windows in `app.windows[]`, spawning runtime windows via `WebviewWindowBuilder`, choosing between `WebviewUrl::App` (local route) and `WebviewUrl::External` (remote URL), labeling windows as identifiers, parent-child relationships, cross-window messaging via targeted emit (`emit_to`), focus management, and hiding instead of closing on the OS close button (`onCloseRequested`). |
| `tauri-windows-splashscreen` | Use when adding a splashscreen to a Tauri v2 app — declaring a visible splash window and a hidden main window in config, doing initialization work in the Rust `setup` hook with `tokio::spawn` (never `std::thread::sleep`), signaling readiness via a `splash://ready` event or directly via `get_webview_window("splash").close()` + main `.show()`, and choosing JS-driven vs pure-Rust orchestration. |
| `tauri-windows-transparency-vibrancy` | Use when building a transparent or vibrant Tauri v2 window — setting `transparent: true` in config, applying macOS NSVisualEffect via the `window-vibrancy` crate (`apply_vibrancy(window, NSVisualEffectMaterial::HudWindow, ...)`), Windows 11 `apply_mica` / `apply_acrylic`, the platform support matrix, CSS for transparent backgrounds with rounded corners, and the menubar-app combo (`alwaysOnTop` + `transparent: true` + `decorations: false`). |
| `testing-skill` | Writing and running tests |
| `update-skills` | Check for skill-router updates and apply them |
<!-- END:SKILLS -->

## Development Setup

```sh
npm run setup    # install deps, create MCP symlinks, build skill index
```

<!-- BEGIN:SCRIPTS -->
### Scripts

| Command | What it does |
| --- | --- |
| `npm run setup` | Install deps + create MCP symlinks + build index |
| `npm run build:index` | Rebuild the skill-router index |
| `npm run build:llms` | Regenerate llms.txt from template |
| `npm run build:readme` | Regenerate README.md auto-generated sections |
| `npm run bump` | Bump version across all manifests |
| `npm run test` | Build index + run MCP server smoke tests |
| `npm run test:repl` | Build index + launch interactive REPL |
| `npm run test:structure` | Run plugin structure tests only |
| `npm run lint` | Lint markdown + JS + JSON schemas |
| `npm run validate` | Validate all skills (frontmatter + content) |
| `npm run validate:one` | Validate a single skill |
| `npm run check:versions` | Verify version consistency across manifests |
| `npm run check:llms` | Verify llms.txt is up to date |
| `npm run check:readme` | Verify README.md auto-generated sections are up to date |
| `npm run new` | Scaffold a new skill |
| `npm run package` | Package a skill for submission |
| `npm run ci` | Run full CI pipeline (lint + validate + test) |
<!-- END:SCRIPTS -->

## Structure

```text
plugins/stuffbucket/
├── .mcp.json                          # MCP server config (canonical)
└── skills/
    └── <skill-name>/
        ├── SKILL.md                   # Skill definition (required)
        ├── scripts/                   # Executable scripts (optional)
        ├── references/                # Reference documents (optional)
        └── assets/                    # Static resources (optional)
.mcp.json                              # Symlink → plugins/stuffbucket/.mcp.json
.vscode/mcp.json                       # Symlink → same (VS Code discovery)
.claude-plugin/marketplace.json        # Claude Code plugin manifest
.github/plugin/marketplace.json        # Copilot plugin manifest
```

## Docs

- [Integration Status](docs/integration-status.md) — what's functional vs. aspirational
- [Best Practices](docs/best-practices.md) — skill authoring guidelines
- [Agent Skills Spec](spec/agent-skills-spec.md) — specification reference

---
name: tauri-debug-test
description: Use when debugging or testing a Tauri v2 app — enabling devtools in production builds, attaching VS Code/RustRover/lldb to the Rust process, viewing Rust logs, running WebDriver e2e tests, or mocking `invoke()` calls in unit tests.
---

# Tauri v2 — Debugging & Testing

Tauri apps fail in two halves: the **WebView** (frontend, like any web app)
and the **Core** (Rust). The skill below covers both, plus how to substitute
either half during tests.

## 1. DevTools (WebView inspector)

Tauri dev/debug builds ship with the platform's native web inspector
(WebKit on macOS/Linux, Edge DevTools on Windows).

- **Open in dev:** right-click → *Inspect Element*, or `Ctrl+Shift+I`
  (Linux/Windows), `Cmd+Option+I` (macOS).
- **Open programmatically** (debug only — never compile this into release):

  ```rust
  tauri::Builder::default().setup(|app| {
      #[cfg(debug_assertions)]
      {
          let win = app.get_webview_window("main").unwrap();
          win.open_devtools();
      }
      Ok(())
  });
  ```

- **`tauri build --debug`** produces a bundled app with DevTools enabled —
  use this when reproducing release-mode bugs that don't show up under
  `tauri dev`. Output: `src-tauri/target/debug/bundle/`.
- **Enable in true release builds:** opt in via Cargo feature.

  ```toml
  # src-tauri/Cargo.toml
  [dependencies]
  tauri = { version = "2", features = ["devtools"] }
  ```

  **macOS App Store warning:** the devtools API is private on macOS.
  Shipping `devtools` to the App Store will get the app rejected. Gate it
  behind a build flag or a separate "internal" release channel.

## 2. Rust-side debugging

### Console output & backtraces

- `println!`/`eprintln!` go to the terminal running `tauri dev`.
- Crash with a stack trace: `RUST_BACKTRACE=1 cargo tauri dev`
  (PowerShell: `$env:RUST_BACKTRACE=1`).
- Detect mode at runtime: `tauri::is_dev()`, or `#[cfg(debug_assertions)]`
  / `#[cfg(dev)]` at compile time. `debug_assertions` covers both
  `tauri dev` and `tauri build --debug`; `dev` is only `tauri dev`.

### Structured logging (`tauri-plugin-log`)

For anything beyond ad-hoc prints, install the log plugin so output is
filterable, persistable, and forwardable to the WebView console:

```rust
use tauri_plugin_log::{Builder, Target, TargetKind};

tauri::Builder::default()
    .plugin(
        Builder::new()
            .level(log::LevelFilter::Debug)
            .targets([
                Target::new(TargetKind::Stdout),
                Target::new(TargetKind::LogDir { file_name: None }),
                Target::new(TargetKind::Webview), // also forwards to JS console
            ])
            .build(),
    )
```

Tune verbosity per-run with `RUST_LOG=debug bun run tauri dev` (or
`info,my_crate=trace` for crate-scoped filters).

## 3. VS Code — attach the Rust debugger

Install **vscode-lldb** (macOS/Linux/Windows) or the **C/C++** extension
for `cppvsdbg` (Windows-only, faster, better enum support).

The configs in `templates/.vscode/launch.json` build via `cargo` directly,
which means the Tauri CLI's `beforeDevCommand` does **not** run — wire
that in via `preLaunchTask` pointing at a `tasks.json` entry:

```json
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "ui:dev",
      "type": "shell",
      "isBackground": true,
      "command": "bun",
      "args": ["run", "dev"]
    },
    { "label": "ui:build", "type": "shell", "command": "bun", "args": ["run", "build"] }
  ]
}
```

Note `--no-default-features` in the dev launch config: it tells Tauri to
read assets from the dev server URL instead of the bundled dist. The
Tauri CLI normally injects this; here you must do it explicitly.

## 4. RustRover / IntelliJ / CLion

If the workspace root isn't a Cargo project (typical for JS frontends),
either attach `src-tauri/Cargo.toml` via **View → Tool Windows → Cargo
→ +**, or create a top-level workspace `Cargo.toml`:

```toml
[workspace]
members = ["src-tauri"]
```

Then create **two** Run Configurations:

1. **Cargo** config targeting `src-tauri`, with `--no-default-features` in
   the args (same reason as VS Code).
2. **npm** (or shell-script) config running `beforeDevCommand` — e.g.
   `bun run dev` — so the dev server is up before the Cargo build attaches.

Start the dev server config first, then **Debug** the Cargo config.
Breakpoints in any Rust file just work.

## 5. WebDriver end-to-end tests

Tauri exposes the platform WebDriver through `tauri-driver`. **Supported:**
Linux (WebKitWebDriver), Windows (Edge Driver). **Not supported:** macOS
desktop (no WKWebView driver exists). Mobile works via Appium 2 but is
not streamlined.

```sh
cargo install tauri-driver --locked

# Linux deps (Debian/Ubuntu)
sudo apt install -y libwebkit2gtk-4.1-dev webkit2gtk-driver xvfb

# Windows: match Edge ↔ Edge Driver versions or the suite will hang
cargo install --git https://github.com/chippers/msedgedriver-tool
& "$HOME/.cargo/bin/msedgedriver-tool.exe"
```

`tauri-driver` is a bridge — your tests still use **WebdriverIO** or
**Selenium** as the client. Working example repo:
<https://github.com/tauri-apps/webdriver-example>.

### CI shape (GitHub Actions)

- Matrix `[ubuntu-latest, windows-latest]` (skip macOS).
- Linux: install `webkit2gtk-driver xvfb`, then run tests under
  `xvfb-run yarn test` for a headless display.
- Windows: install msedgedriver matching the runner's Edge version,
  add it to `$env:GITHUB_PATH`, run directly.
- Run `cargo test` **before** the e2e suite — there's no point WebDriver-ing
  a binary that doesn't compile.

## 6. Mocking IPC in unit tests

For frontend logic that calls `invoke()` or listens for events, mock
the Tauri runtime instead of spawning Rust. Module: `@tauri-apps/api/mocks`.

```ts
import { mockIPC, mockWindows, clearMocks } from '@tauri-apps/api/mocks';
import { invoke } from '@tauri-apps/api/core';

afterEach(() => clearMocks()); // MANDATORY — mocks patch globals

mockIPC((cmd, args) => {
  if (cmd === 'add') return (args.a as number) + (args.b as number);
});
await expect(invoke('add', { a: 1, b: 2 })).resolves.toBe(3);
```

Combine with a spy to assert call counts:

```ts
const spy = vi.spyOn(window.__TAURI_INTERNALS__, 'invoke');
await invoke('greet', { name: 'world' });
expect(spy).toHaveBeenCalledWith('greet', { name: 'world' }, undefined);
```

**Events** (api ≥ 2.7.0): `mockIPC(() => {}, { shouldMockEvents: true })`
enables `listen` / `emit` round-trips. `emitTo` and `emit_filter` are
not yet mocked.

**Windows:** `mockWindows('main', 'splash', 'settings')` — first label
is the "current" window; the rest exist for `getAll()`/multi-window code
paths. It only fakes labels, not properties — for `is_visible`/size/etc.
intercept the underlying command via `mockIPC`.

**jsdom note:** Tauri's mock layer needs `window.crypto.getRandomValues`.
jsdom doesn't ship it — shim with `node:crypto`'s `randomFillSync` in
`beforeAll`. See `templates/mock-ipc.test.ts`.

The template file covers: simple invoke, spy assertion, rejection path,
event round-trip, and `mockWindows`.

## 7. CrabNebula DevTools (optional)

Third-party deeper inspector — captures logs, spans, command payloads,
event flow with a web UI. Install via the `tauri-plugin-devtools` crate
and gate to debug builds:

```rust
#[cfg(debug_assertions)]
let devtools = tauri_plugin_devtools::init();

let mut builder = tauri::Builder::default();
#[cfg(debug_assertions)]
{ builder = builder.plugin(devtools); }
```

Free for Tauri apps. Useful when the built-in inspector + `tauri-plugin-log`
aren't enough — especially for IPC perf and command-call traces. Docs:
<https://docs.crabnebula.dev/devtools/get-started/>.

## 8. Common traps

- **`invoke` returns "command X not found"** — the handler is defined but
  never registered. Add it to `.invoke_handler(tauri::generate_handler![...])`.
  Tauri does **not** auto-discover `#[tauri::command]` functions.
- **Event listeners silently leak** — `listen()` returns an unlisten fn;
  call it on component teardown. In long-lived windows, repeated `listen`
  without cleanup multiplies handler invocations per event.
- **Async command deadlock with `std::sync::Mutex`** — holding a
  `std::sync::Mutex` across an `.await` blocks the async runtime.
  For async commands, use `tokio::sync::Mutex` (and put it in `State`).
- **`tauri dev` works, packaged build doesn't** — try `tauri build --debug`
  and open DevTools. Most often: a capability is missing in release
  (capabilities are checked at runtime), or an asset path is dev-server-only.
- **WebDriver tests hang on Windows** — Edge Driver and Edge versions
  drifted. Reinstall msedgedriver to match.
- **Mocks bleed between tests** — forgot `clearMocks()` in `afterEach`.
  Symptom: first test passes, rest fail with stale handler behavior.

## Templates

- `templates/.vscode/launch.json` — lldb + cppvsdbg launch configs.
- `templates/mock-ipc.test.ts` — Vitest mock-IPC, spy, events, windows.

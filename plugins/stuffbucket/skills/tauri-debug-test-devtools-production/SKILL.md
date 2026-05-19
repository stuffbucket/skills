---
name: tauri-debug-test-devtools-production
description: Use when you need the WebView inspector in a shipped Tauri v2 build — `tauri build --debug` to keep the dev console enabled, the `devtools` Cargo feature on the `tauri` crate for opt-in release builds, programmatic `window.open_devtools()` behind a `#[cfg(feature = "devtools")]` shortcut, the **macOS App Store ban** (private API — strip the feature before submitting), `tauri-plugin-log` for routing logs to webview console + stdout + file, `RUST_LOG`/`RUST_BACKTRACE`, and the Chrome-DevTools-Protocol gap on macOS WKWebView vs Linux/Windows.
---

# Tauri v2 — DevTools & Logs in Production Builds

By default DevTools are compiled in only for `tauri dev` and
`tauri build --debug`. Production `tauri build` strips them. This skill
covers the three escape hatches (debug build, devtools feature, plugin-log)
plus the macOS App Store landmine.

See [[tauri-debug-test]] for the wider debugging surface and
[[tauri-bundling]] for production packaging.

## Three ways to inspect a shipped app

| Goal                                          | Mechanism                             | Cost                                        |
| --------------------------------------------- | ------------------------------------- | ------------------------------------------- |
| Reproduce a bug in a debug copy               | `tauri build --debug`                 | Bigger binary, dev console on, target/debug |
| Customer-facing release with hidden inspector | `devtools` Cargo feature + keybinding | Banned on macOS App Store                   |
| No inspector, just logs                       | `tauri-plugin-log`                    | Always safe; no UI                          |

Pick by store policy first, then ergonomics.

## Path A — `tauri build --debug`

```sh
bun tauri build --debug
# Output: src-tauri/target/debug/bundle/<format>/<App>...
```

The bundle has the inspector enabled (right-click → Inspect Element,
`Ctrl+Shift+I` / `Cmd+Option+I`). Use for repro builds — never ship.

You can also run the raw binary directly to see `println!` output in the
terminal: `./src-tauri/target/debug/<app>`.

## Path B — the `devtools` Cargo feature

For shipping a release that quietly carries the inspector:

```toml title="src-tauri/Cargo.toml"
[dependencies]
tauri = { version = "2", features = ["devtools"] }
```

Then `tauri build` (no `--debug`) produces an optimised binary that still
exposes `WebviewWindow::open_devtools()`. You must call it yourself —
nothing wires up automatically.

### macOS App Store warning

> **The devtools API uses a private macOS API.** Apple will reject any
> submission that links against it.

Gate the dependency on a Cargo feature you flip off for store builds:

```toml
[features]
default = []
devtools = ["tauri/devtools"]   # local + non-store releases
appstore = []                   # CI: `cargo build --no-default-features --features appstore`
```

`templates/Cargo.toml.devtools-snippet` shows the full pattern.

## Path C — programmatic open

Combine the feature flag with a hidden keybinding so power users / support
can summon devtools without it appearing in the UI:

```rust
#[cfg(feature = "devtools")]
{
    use tauri::Manager;
    let window = app.get_webview_window("main").unwrap();
    // Wire a global shortcut, menu item, or invoke command — see
    // templates/devtools-toggle.rs for the full plugin-global-shortcut setup.
    window.open_devtools();
}
```

Pair with `#[cfg(debug_assertions)]` if you want the same shortcut to
fire automatically only in `--debug` builds.

## Logging — the safe-everywhere option

[`tauri-plugin-log`](https://v2.tauri.app/plugin/logging/) sends `log::*`
output to one or more targets: the webview console, stdout, a rotating
file under the app's log directory. Add it to every project that ships:

```rust
tauri::Builder::default()
    .plugin(
        tauri_plugin_log::Builder::new()
            .targets([
                tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir { file_name: None }),
                tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
            ])
            .level(log::LevelFilter::Info)
            .build(),
    )
```

Frontend side:

```ts
import { attachConsole } from '@tauri-apps/plugin-log'
await attachConsole()  // pipes Rust logs into the devtools console
```

Even without the inspector, the rotating log file is a goldmine for
"please send me your logs" support flows.

## `RUST_LOG` and `RUST_BACKTRACE`

Both env vars work on shipped binaries:

- `RUST_LOG=tauri=debug,my_app=trace ./MyApp` — verbose tracing.
- `RUST_BACKTRACE=1 ./MyApp` — stack trace on panic.

Document a "run from terminal with these env vars" recipe in your support
docs — far cheaper than building a debug bundle for every reported crash.

## Chrome DevTools Protocol (CDP)

If you want a remote debugger (VS Code, chrome://inspect) the situation
forks by platform:

- **Linux:** WebKitGTK supports remote inspector over a port via
  `WEBKIT_INSPECTOR_HTTP_SERVER=127.0.0.1:9229`.
- **Windows:** Edge WebView2 supports CDP on `--remote-debugging-port=...`
  — set `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` before app launch.
- **macOS:** WKWebView only exposes the Safari inspector and only with
  the `devtools` feature flipped. No CDP.

So cross-platform remote debugging is a non-starter; favour
plugin-log + structured tracing for production diagnosis.

## "Inspect Element" in dev

A reminder that you don't need any of this for `tauri dev` — right-click,
`Inspect Element`, done. The platform inspector is:

- Linux: WebKitWebInspector (Webkit2GTK).
- macOS: Safari Web Inspector.
- Windows: Edge DevTools.

## Templates

- `templates/devtools-toggle.rs` — feature-gated `Cmd+Alt+I` shortcut that
  opens devtools via `tauri-plugin-global-shortcut`.
- `templates/Cargo.toml.devtools-snippet` — feature wiring + the
  appstore-safe variant.

## Anti-patterns

- **Always-on `features = ["devtools"]` in the released crate.** Means
  every customer build leaks the inspector and you can't ship to the
  macOS App Store. Always gate behind a Cargo feature flipped per-channel.
- **Calling `open_devtools()` without `#[cfg(feature = "devtools")]`.**
  The method only exists when the feature is enabled — release builds
  without it will fail to compile.
- **Relying on `println!` in shipped binaries.** Works only when the user
  launches from a terminal; on macOS .app double-click stdout is
  discarded. Use `tauri-plugin-log` with a file target instead.
- **Trusting `RUST_BACKTRACE=full` on stripped release builds.** Strip
  removes symbols; the backtrace is a column of hex. Either keep symbols
  (`strip = "none"` — see [[tauri-architecture-size-optimization]]) for
  the diagnostic channel, or ship debuginfo packages separately.

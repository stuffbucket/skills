---
name: tauri-windows-splashscreen
description: Use when adding a splashscreen to a Tauri v2 app — declaring a visible splash window and a hidden main window in config, doing initialization work in the Rust `setup` hook with `tokio::spawn` (never `std::thread::sleep`), signaling readiness via a `splash://ready` event or directly via `get_webview_window("splash").close()` + main `.show()`, and choosing JS-driven vs pure-Rust orchestration.
---

# Tauri v2 — Splashscreen Pattern

The "show something fast, hide it when the real app is ready" pattern. Two
windows: a splash that appears immediately while the heavy work runs, and a
main window that starts hidden and reveals once ready. The trick is doing the
work *truthfully* — not just sleeping for two seconds and pretending.

See [[tauri-windows]] for the overview and [[tauri-windows-multi-window]] for
multi-window basics.

## The configuration

Two windows, splash visible, main hidden:

```json title="src-tauri/tauri.conf.json"
{
  "app": {
    "windows": [
      {
        "label": "main",
        "url": "index.html",
        "title": "My App",
        "width": 1000,
        "height": 700,
        "visible": false
      },
      {
        "label": "splash",
        "url": "splash.html",
        "width": 400,
        "height": 200,
        "decorations": false,
        "transparent": true,
        "center": true,
        "alwaysOnTop": true,
        "skipTaskbar": true
      }
    ]
  }
}
```

The splash gets `decorations: false` and usually `transparent: true` so the
window is a borderless logo card. `skipTaskbar: true` keeps it out of the
taskbar (otherwise users see two app icons for one boot).

## Pattern A — pure-Rust orchestration (recommended)

Do the work in `setup`, then close splash + show main from Rust. No event
plumbing, no JS choreography.

```rust title="src-tauri/src/lib.rs"
use tauri::{async_runtime::spawn, AppHandle, Manager};
use tokio::time::{sleep, Duration};

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            spawn(async move {
                if let Err(e) = init(&handle).await {
                    eprintln!("init failed: {e:?}");
                }
                if let Some(splash) = handle.get_webview_window("splash") {
                    let _ = splash.close();
                }
                if let Some(main) = handle.get_webview_window("main") {
                    let _ = main.show();
                    let _ = main.set_focus();
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

async fn init(app: &AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Real work — DB migrations, sidecar warmup, config load, license check.
    sleep(Duration::from_millis(1200)).await; // placeholder
    Ok(())
}
```

`tauri::async_runtime::spawn` runs on Tauri's tokio runtime. `setup` returns
immediately, so the splash paints. The spawned task does the work and tears
the splash down when done. See `templates/splash-init.rs`.

## Pattern B — JS-driven (when frontend has its own warmup)

When the *frontend* also has initialization (loading user data, warming a
Wasm module), let JS signal completion via an event. The Rust side and JS
side both report `set_complete`; only when both are done does the swap happen.

```rust
use std::sync::Mutex;
use tauri::{async_runtime::spawn, AppHandle, Manager, State};

#[derive(Default)]
struct SetupState { frontend: bool, backend: bool }

#[tauri::command]
async fn set_complete(app: AppHandle, state: State<'_, Mutex<SetupState>>, task: String) -> Result<(), String> {
    let ready = {
        let mut s = state.lock().unwrap();
        match task.as_str() {
            "frontend" => s.frontend = true,
            "backend"  => s.backend  = true,
            _ => return Err("unknown task".into()),
        }
        s.frontend && s.backend
    };
    if ready {
        if let Some(splash) = app.get_webview_window("splash") { let _ = splash.close(); }
        if let Some(main) = app.get_webview_window("main")    { let _ = main.show(); }
    }
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(SetupState::default()))
        .invoke_handler(tauri::generate_handler![set_complete])
        .setup(|app| {
            let handle = app.handle().clone();
            spawn(async move {
                heavy_backend_work().await;
                let _ = set_complete(
                    handle.clone(),
                    handle.state::<Mutex<SetupState>>(),
                    "backend".into(),
                ).await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

JS side:

```ts title="splash.ts"
import { invoke } from '@tauri-apps/api/core';

async function frontendInit() {
  await loadUserPreferences();
  await warmWasm();
  await invoke('set_complete', { task: 'frontend' });
}

window.addEventListener('DOMContentLoaded', () => { void frontendInit(); });
```

## Pattern C — event-driven (`splash://ready`)

Rust does all the init, then emits an event the *splash* window listens to so
the splash can play a fade-out animation before closing itself:

```rust
spawn(async move {
    init(&handle).await.unwrap();
    let _ = handle.emit_to("splash", "splash://ready", ());
});
```

```ts title="splash.ts"
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

await listen('splash://ready', async () => {
  document.body.classList.add('fade-out');
  await new Promise((r) => setTimeout(r, 200));
  const main = await WebviewWindow.getByLabel('main');
  await main?.show();
  await getCurrentWindow().close();
});
```

Pick C only if you need the animation. Otherwise A is simpler.

## The `std::thread::sleep` antipattern

```rust
// WRONG — blocks Tauri's runtime, freezes IPC, breaks devtools
.setup(|app| {
    std::thread::sleep(Duration::from_secs(3));
    Ok(())
})
```

`std::thread::sleep` in `setup` blocks the thread that drives the main event
loop. Windows freeze, drag stops, devtools detach. Even inside `tokio::spawn`,
`std::thread::sleep` parks the worker thread — use `tokio::time::sleep`
*always*. The same rule applies to any blocking I/O: wrap it in
`tokio::task::spawn_blocking` or use the async variant.

## Window flicker — the splash gap

If you close the splash *before* the main window paints, users see desktop
wallpaper for ~50ms. Order matters:

```rust
let _ = main.show();    // 1. Show main first
let _ = main.set_focus();
let _ = splash.close(); // 2. Then drop splash
```

The webview is already loaded (the page rendered into an offscreen surface
while `visible: false`), so `.show()` is instant.

## Templates

- `templates/splash-init.rs` — pure-Rust orchestration with real fallible
  init steps and proper error propagation.
- `templates/splash.html` — minimal animated splash (centered logo + spinner)
  using transparent + decorations:false.

## Common pitfalls

- **Main window flashes briefly at startup** — `visible: false` missing from
  config, or `center: true` triggers a layout pass that briefly shows it on
  some OSes. Set `visible: false` and call `.show()` after init.
- **Splash never closes** — exception in spawned task aborted before
  `close()`. Always wrap init in a `match` and close splash in *both* arms.
- **DevTools blank on splash** — `transparent: true` + empty page = nothing
  to inspect. Give the body a non-transparent background while debugging.
- **Splash steals focus from another app** — `alwaysOnTop: true` makes it
  rude. Drop it once init is past the visible threshold, or use a
  long-running app where users *expect* the splash.

## See also

- [[tauri-windows]] — parent skill
- [[tauri-windows-multi-window]] — `get_webview_window`, labels
- [[tauri-commands]] — `set_complete` command pattern
- [[tauri-events]] — emit/listen mechanics

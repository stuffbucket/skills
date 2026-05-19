---
name: tauri-windows-multi-window
description: Use when managing many Tauri v2 windows — declaring static windows in `app.windows[]`, spawning runtime windows via `WebviewWindowBuilder`, choosing between `WebviewUrl::App` (local route) and `WebviewUrl::External` (remote URL), labeling windows as identifiers, parent-child relationships, cross-window messaging via targeted emit (`emit_to`), focus management, and hiding instead of closing on the OS close button (`onCloseRequested`).
---

# Tauri v2 — Multi-Window Management

A Tauri app is multi-window by default — every entry in `app.windows[]` is its
own webview process (or scene, on mobile). The patterns below cover the
spectrum from static "two-window app" through "spawn a detail window per row"
to "menubar app with hidden background window".

See [[tauri-windows]] for the overview and [[tauri-events]] for the underlying
event mechanics.

## Static windows — declared in config

For a fixed set of windows known at build time, declare them in
`tauri.conf.json`:

```json title="src-tauri/tauri.conf.json"
{
  "app": {
    "windows": [
      { "label": "main",     "url": "index.html",       "title": "Main",     "width": 1000, "height": 700 },
      { "label": "settings", "url": "settings.html",    "title": "Settings", "width": 600,  "height": 500, "visible": false },
      { "label": "splash",   "url": "splash.html",      "decorations": false, "transparent": true, "width": 400, "height": 200 }
    ]
  }
}
```

Each `label` is the **stable identifier** — use it from JS, Rust, capability
files, and event targeting. Labels must be unique and match
`^[a-zA-Z0-9_-]+$`. The Vite config's `rollupOptions.input` must include each
HTML entry, or the build will 404.

## Runtime windows — `WebviewWindowBuilder`

When the window list isn't fixed (per-document editor, "open detail in new
window"), build at runtime from Rust:

```rust
use tauri::{WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
async fn open_detail(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let label = format!("detail-{id}");
    if let Some(existing) = app.get_webview_window(&label) {
        existing.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }
    WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(format!("detail.html?id={id}").into()))
        .title(format!("Detail #{id}"))
        .inner_size(800.0, 600.0)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

Or from JS:

```ts
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

const win = new WebviewWindow(`detail-${id}`, {
  url: `detail.html?id=${id}`,
  title: `Detail #${id}`,
  width: 800,
  height: 600,
});
win.once('tauri://created', () => console.log('window ready'));
win.once('tauri://error', (e) => console.error(e));
```

The JS path runs through an `invoke()` under the hood — it needs
`core:webview:allow-create-webview-window` in your capability file.

See `templates/multi-window.rs` and `templates/window-manager.ts`.

## `WebviewUrl::App` vs `WebviewUrl::External`

| Variant                           | Use for                                   | Notes                                                                                                     |
| --------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `WebviewUrl::App(PathBuf)`        | Pages bundled in your frontend            | Path is relative to `frontendDist`; loaded via `tauri://localhost`. Subject to your CSP and capabilities. |
| `WebviewUrl::External(Url)`       | Remote pages (OAuth, docs, embedded site) | Loaded with normal web origin. **No `invoke()` available** — these windows can't call your Rust commands. |
| `WebviewUrl::CustomProtocol(Url)` | Custom asset/data protocol                | Advanced; usually for streaming content.                                                                  |

External windows are sandboxed from your IPC — security feature, not a bug.
For OAuth callbacks, listen for navigation events on the parent and pull the
query string out, then close the external window.

## Labels as identifiers — never store window handles

```rust
// BAD — Window/WebviewWindow handles don't survive across commands
struct AppState { settings_win: Option<WebviewWindow> }

// GOOD — store the label, look up on demand
struct AppState { settings_label: Option<String> }
let win = app.get_webview_window(&label).ok_or("gone")?;
```

`get_webview_window(label)` is the canonical lookup. It returns `Option` —
the window may have been closed since you stashed the label.

## Parent-child relationships

Tauri tracks a parent window primarily for **modal-like ownership semantics**
on macOS (the child stays on top of the parent and minimizes with it):

```rust
WebviewWindowBuilder::new(&app, "prefs", WebviewUrl::App("prefs.html".into()))
    .parent(&app.get_webview_window("main").unwrap())?
    .build()?;
```

On Windows/Linux, parent only affects z-order. There is no automatic "close
parent → close children" — you wire that yourself in the close handler.

## Cross-window communication — targeted emit

For window-to-window messaging, use `emit_to` from Rust or `WebviewWindow.emit`
from JS. The other window subscribes with `listen`:

```rust
app.emit_to("settings", "config-changed", &new_config)?;
```

```ts
// In settings window
import { listen } from '@tauri-apps/api/event';
const unlisten = await listen<Config>('config-changed', (e) => {
  applyConfig(e.payload);
});
```

For window-to-window without going through Rust, use `getAllWebviewWindows()`
and emit on each — but going through a Rust command is cleaner for anything
beyond trivial broadcasts. See [[tauri-events]] for routing details.

## Focus management

```ts
import { getCurrentWindow } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

const settings = await WebviewWindow.getByLabel('settings');
if (settings) {
  await settings.show();
  await settings.unminimize();
  await settings.setFocus();
}
```

`setFocus()` alone is unreliable when the window is minimized — always
`unminimize()` + `show()` first. On macOS, `app.activate()` may also be
needed to bring the app forward when called from a background context (e.g.
tray click).

## `onCloseRequested` — hide instead of close (menubar apps)

For tray-app patterns, the OS close button should hide, not quit:

```ts
import { getCurrentWindow } from '@tauri-apps/api/window';

const win = getCurrentWindow();
await win.onCloseRequested(async (event) => {
  event.preventDefault();
  await win.hide();
});
```

Or from Rust during build:

```rust
let main = app.get_webview_window("main").unwrap();
let main_clone = main.clone();
main.on_window_event(move |event| {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = main_clone.hide();
    }
});
```

Pair with a tray menu "Quit" item that calls `app.exit(0)` for actual exit.
See [[tauri-tray-menu]].

## Common pitfalls

- **Spawning the same label twice** — second `build()` errors. Always
  `get_webview_window(label)` first and reuse + focus.
- **Forgetting Vite `rollupOptions.input`** — second HTML entry serves 404 in
  dev but works in build (or vice-versa). Wire both.
- **External windows calling invoke** — they can't. Pick `App` URL or use the
  `http` plugin to call your proxy as HTTP.
- **Capabilities scoped to wrong window** — capability files have a
  `windows: ["main"]` field. Add the new label or use `"*"`.
- **Closing the last window quits the app** by default on Windows/Linux —
  override with `prevent_close` or set `app.windowsClosed` behavior.

## Templates

- `templates/multi-window.rs` — Rust command that spawns/focuses a labeled
  detail window with parent linkage and dedup.
- `templates/window-manager.ts` — JS helper: `openOrFocus(label, options)`,
  `closeWindow(label)`, broadcast helper.

## See also

- [[tauri-windows]] — parent skill
- [[tauri-events]] — `emit_to` / `listen` details
- [[tauri-tray-menu]] — menubar pattern that pairs with `onCloseRequested`
- [[tauri-windows-splashscreen]] — specific two-window pattern

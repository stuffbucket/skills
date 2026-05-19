---
name: tauri-windows
description: Use when creating, customizing, or managing Tauri v2 windows — decorations, transparency, custom titlebar, multi-window, child webviews, splashscreen pattern, or mobile multi-window setups.
---

# Tauri v2 Window Management

Tauri windows are *webview windows* — each one is a native OS window hosting a webview that loads a
URL (local asset or remote). They can be declared statically in `tauri.conf.json` or built at
runtime from JS or Rust.

## 1. Static config — `tauri.conf.json`

Declare every window your app boots with under `app.windows[]`. Each entry needs a unique `label`
(used to address it later) and a `url` (path to a frontend asset, or remote URL).

```json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "url": "index.html",
        "title": "My App",
        "width": 1024,
        "height": 720,
        "minWidth": 480,
        "minHeight": 360,
        "decorations": true,
        "transparent": false,
        "alwaysOnTop": false,
        "resizable": true,
        "fullscreen": false,
        "center": true,
        "visible": true
      }
    ]
  }
}
```

Common keys: `label`, `url`, `title`, `width`/`height`,
`minWidth`/`minHeight`/`maxWidth`/`maxHeight`, `x`/`y`, `center`, `resizable`, `maximized`,
`fullscreen`, `decorations`, `transparent`, `alwaysOnTop`, `alwaysOnBottom`, `skipTaskbar`,
`visible`, `focus`, `acceptFirstMouse`, `tabbingIdentifier` (macOS), `titleBarStyle` (macOS),
`hiddenTitle` (macOS).

See `templates/tauri.conf.windows.json` for a splash + main two-window setup.

## 2. Custom titlebar (frameless window)

Drop the native chrome with `decorations: false`, then render your own bar in HTML.

**Required capability** — add to `src-tauri/capabilities/default.json`:

```json
{
  "permissions": [
    "core:window:default",
    "core:window:allow-start-dragging"
  ]
}
```

**HTML** — any element with `data-tauri-drag-region` becomes a drag handle:

```html
<div class="titlebar">
  <div class="titlebar-drag" data-tauri-drag-region></div>
  <div class="titlebar-controls">
    <button id="titlebar-minimize" aria-label="Minimize">—</button>
    <button id="titlebar-maximize" aria-label="Maximize">▢</button>
    <button id="titlebar-close" aria-label="Close">✕</button>
  </div>
</div>
```

**JS** — wire buttons to `getCurrentWindow()`:

```ts
import { getCurrentWindow } from '@tauri-apps/api/window';

const win = getCurrentWindow();
document.getElementById('titlebar-minimize')?.addEventListener('click', () => win.minimize());
document.getElementById('titlebar-maximize')?.addEventListener('click', () => win.toggleMaximize());
document.getElementById('titlebar-close')?.addEventListener('click', () => win.close());
```

If you need finer control than `data-tauri-drag-region` (e.g. double-click-to-maximize on a
non-drag-region row):

```ts
document.getElementById('titlebar')?.addEventListener('mousedown', (e) => {
  if (e.buttons !== 1) return;
  e.detail === 2 ? win.toggleMaximize() : win.startDragging();
});
```

Full snippet in `templates/custom-titlebar.html`.

## 3. Runtime window creation

### JavaScript

```ts
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

const settings = new WebviewWindow('settings', {
  url: 'settings.html',
  title: 'Settings',
  width: 640,
  height: 480,
  resizable: false,
  center: true,
});

settings.once('tauri://created', () => console.log('settings window ready'));
settings.once('tauri://error', (e) => console.error('failed to create window', e));
```

Labels are **unique identifiers** — creating a second window with the same label fails. To reuse
one, look it up first:

```ts
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

const existing = await WebviewWindow.getByLabel('settings');
if (existing) await existing.setFocus();
else new WebviewWindow('settings', { url: 'settings.html' });
```

### Rust

```rust
use tauri::{WebviewUrl, WebviewWindowBuilder};

tauri::Builder::default()
  .setup(|app| {
    WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("settings.html".into()))
      .title("Settings")
      .inner_size(640.0, 480.0)
      .resizable(false)
      .center()
      .build()?;
    Ok(())
  })
  .run(tauri::generate_context!())
  .expect("error while running tauri application");
```

## 4. Window methods and events

```ts
import { getCurrentWindow, LogicalSize, LogicalPosition } from '@tauri-apps/api/window';
const win = getCurrentWindow();

await win.show();
await win.hide();
await win.close();
await win.center();
await win.setFocus();
await win.setSize(new LogicalSize(800, 600));
await win.setPosition(new LogicalPosition(100, 100));
await win.setAlwaysOnTop(true);
await win.setTitle('New title');

const unlistenClose = await win.listen('tauri://close-requested', async (e) => {
  // call e.preventDefault() equivalent: just don't call win.close()
  // run cleanup, then close manually
  await win.destroy();
});
await win.listen('tauri://focus', () => console.log('focused'));
await win.listen('tauri://blur',  () => console.log('blurred'));
```

Other useful events: `tauri://resize`, `tauri://move`, `tauri://scale-change`,
`tauri://theme-changed`, `tauri://file-drop`.

## 5. Transparency and vibrancy

Set `transparent: true` in the window config, then apply a translucent CSS background. For native
blur/vibrancy effects (macOS NSVisualEffect, Windows mica/acrylic), use the
[`window-vibrancy`](https://crates.io/crates/window-vibrancy) crate from your Rust setup hook:

```rust
use tauri::Manager;
use window_vibrancy::{apply_vibrancy, apply_mica, NSVisualEffectMaterial};

tauri::Builder::default()
  .setup(|app| {
    let win = app.get_webview_window("main").unwrap();
    #[cfg(target_os = "macos")]
    apply_vibrancy(&win, NSVisualEffectMaterial::HudWindow, None, None)
      .expect("vibrancy unsupported");
    #[cfg(target_os = "windows")]
    apply_mica(&win, None).expect("mica unsupported");
    Ok(())
  })
```

On macOS you can also use the native transparent titlebar without `window-vibrancy`:

```rust
use tauri::{TitleBarStyle, WebviewUrl, WebviewWindowBuilder};

WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
  .title_bar_style(TitleBarStyle::Transparent)
  .inner_size(800.0, 600.0)
  .build()?;
```

## 6. Splashscreen pattern

The idea: ship a tiny `splash` window that's visible at boot, keep `main` hidden, do init work in
the Rust `setup` hook, then close splash and show main.

**Config** (see `templates/tauri.conf.windows.json`):

```jsonc
{
  "windows": [
    { "label": "splash", "url": "splash.html", "width": 400, "height": 200, "decorations": false, "center": true },
    { "label": "main",   "url": "index.html",  "width": 1024, "height": 720, "visible": false }
  ]
}
```

**Rust** — close splash, show main once setup is done:

```rust
use tauri::Manager;

tauri::Builder::default()
  .setup(|app| {
    let handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
      // heavy init: open DB, warm caches, fetch session, etc.
      tokio::time::sleep(std::time::Duration::from_secs(2)).await; // demo only

      if let Some(splash) = handle.get_webview_window("splash") { let _ = splash.close(); }
      if let Some(main)   = handle.get_webview_window("main")   { let _ = main.show(); }
    });
    Ok(())
  })
```

Use `tokio::time::sleep`, not `std::thread::sleep` — the latter blocks the async runtime. If the
frontend also has init work, have it `invoke()` a `frontend_ready` command and only close splash
when both backend and frontend have signaled completion (typically via a `Mutex<SetupState>` shared
via `app.manage(...)`).

## 7. Multi-window communication

Labels are how you address other windows. Emit to a specific label:

```ts
import { emitTo } from '@tauri-apps/api/event';
await emitTo('settings', 'theme-changed', { theme: 'dark' });
```

```rust
use tauri::Emitter;
app.emit_to("settings", "theme-changed", "dark")?;
```

Listen in the target window:

```ts
import { listen } from '@tauri-apps/api/event';
const unlisten = await listen<{ theme: string }>('theme-changed', (e) => {
  applyTheme(e.payload.theme);
});
```

Plain `emit()` broadcasts to all windows; prefer `emitTo(label, ...)` when only one window cares.

## 8. Window menus (desktop)

Attach a native menu bar from Rust with `MenuBuilder`:

```rust
use tauri::menu::{MenuBuilder, SubmenuBuilder, PredefinedMenuItem};

tauri::Builder::default()
  .setup(|app| {
    let file = SubmenuBuilder::new(app, "File")
      .text("new", "New Window")
      .separator()
      .item(&PredefinedMenuItem::quit(app, None)?)
      .build()?;
    let menu = MenuBuilder::new(app).item(&file).build()?;
    app.set_menu(menu)?;
    Ok(())
  })
  .on_menu_event(|app, event| match event.id().as_ref() {
    "new" => { /* open a new window */ }
    _ => {}
  })
```

macOS requires every top-level item to be a `Submenu`; bare items at the top level are ignored. The
JS `Menu.new()` / `Submenu.new()` APIs mirror the Rust builders.

## 9. Mobile multi-window caveats

Multi-window on mobile requires **Android 12L (API 32)+** or **iOS 13+**. Probe
`app.supportsMultipleWindows` at runtime before opening one.

- **Android phones:** new windows are pushed onto the activity back stack — Back returns to the
  previous activity rather than splitting the view. Activity Embedding (true side-by-side) only
  works on tablets and foldables.
- **iPhone:** opening a second window typically *replaces* the current scene rather than showing
  both. Concurrent windows are practical only on iPad (Stage Manager / multi-scene).
- Prefer **browser-history routing** over hash routing so each scene can hold its own path.

Most desktop-style multi-window UX should degrade to a single-window tabbed UI on phones.

## Templates

- `templates/tauri.conf.windows.json` — two-window splash + main config.
- `templates/custom-titlebar.html` — frameless titlebar HTML + CSS + JS.

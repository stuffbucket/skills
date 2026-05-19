---
name: tauri-tray-menu
description: Use when building a Tauri v2 tray icon, system menu bar (macOS), window menu, or context menus — including click handlers, dynamic menu updates, and positioning a window relative to the tray.
---

# Tauri v2 — Tray, Menus, and Menu-Bar Windows

Covers the three menu surfaces in Tauri v2:

1. **Tray icon** — `tauri::tray::TrayIconBuilder` (status-bar/notification-area icon).
2. **App/window menu** — `app.set_menu(...)` (macOS menu bar; Windows/Linux per-window menu).
3. **Context menus** — `menu.popup(window)` triggered from JS.

Plus the **menu-bar-app** pattern (tray icon + popover window anchored under it via
`tauri-plugin-positioner`).

---

## 1. Cargo features

Tray support is gated behind a feature flag. Without it, `tauri::tray::*` won't compile.

```toml
# src-tauri/Cargo.toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
# Add "image-png" if you embed PNG menu icons via Image::from_bytes
```

For tray-relative window positioning:

```toml
tauri-plugin-positioner = { version = "2", features = ["tray-icon"] }
```

```bash
npm install @tauri-apps/plugin-positioner   # only if you call moveWindow from JS
```

---

## 2. Build a tray icon

All tray construction happens inside `.setup(|app| { ... })`. The returned `TrayIcon`
can be dropped — Tauri keeps it alive internally — but keep the handle if you need
to update the icon/menu later.

```rust
use tauri::{
  menu::{Menu, MenuItem},
  tray::TrayIconBuilder,
};

tauri::Builder::default()
  .setup(|app| {
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu   = Menu::with_items(app, &[&quit_i])?;

    let _tray = TrayIconBuilder::new()
      .icon(app.default_window_icon().unwrap().clone())
      .menu(&menu)
      .show_menu_on_left_click(false)   // we want left-click to toggle the window
      .on_menu_event(|app, event| match event.id.as_ref() {
        "quit" => app.exit(0),
        _      => {}
      })
      .on_tray_icon_event(|tray, event| {
        // see §5 for click pattern matching
      })
      .build(app)?;

    Ok(())
  });
```

Notes:

- `TrayIconBuilder::with_id("my-tray")` if you'll look it up later via `app.tray_by_id`.
- `show_menu_on_left_click(true)` is the default — disable it for menu-bar popover apps so
  left-click can toggle a window instead.

---

## 3. Menus — items, predefined, submenus, icons, checks

`tauri::menu` has two flavours: low-level constructors (`Menu::with_items`,
`MenuItem::with_id`) and ergonomic builders (`MenuBuilder`, `SubmenuBuilder`).
Mix freely.

### Items

| Type                 | Use                                                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `MenuItem`           | plain text item with an id                                                                                                             |
| `PredefinedMenuItem` | OS-standard items (`copy`, `paste`, `quit`, `separator`, `select_all`, `undo`, `redo`, `about`, `services`, `hide`, `close_window`, …) |
| `CheckMenuItem`      | toggle with checkmark                                                                                                                  |
| `IconMenuItem`       | item with a leading icon                                                                                                               |
| `Submenu`            | nests items                                                                                                                            |

### Builder example (typical app menu)

```rust
use tauri::menu::{MenuBuilder, SubmenuBuilder, PredefinedMenuItem};

let edit = SubmenuBuilder::new(app, "Edit")
  .undo().redo().separator()
  .cut().copy().paste().select_all()
  .build()?;

let menu = MenuBuilder::new(app)
  .item(&edit)
  .text("open", "Open…")
  .check("auto_update", "Check for updates")
  .separator()
  .item(&PredefinedMenuItem::quit(app, None)?)
  .build()?;

app.set_menu(menu)?;
```

`app.set_menu(menu)` puts the menu in the macOS menu bar (system-wide for the app)
or, on Windows/Linux, into the window chrome. Per-window menus: `window.set_menu(...)`.

### Handling events

```rust
app.on_menu_event(|app, event| match event.id().0.as_str() {
  "open"        => { /* … */ }
  "auto_update" => { /* … */ }
  _             => {}
});
```

When attached to a tray, use `TrayIconBuilder::on_menu_event` instead — it fires for
clicks on tray menu items specifically.

---

## 4. Dynamic updates

Hold `MenuItem` / `CheckMenuItem` / `IconMenuItem` handles in your setup closure
(or in app state) and mutate them in place:

```rust
let status = MenuItem::with_id(app, "status", "Status: idle", false, None::<&str>)?;
// ... later, from anywhere with a clone of `status` ...
status.set_text("Status: running")?;
status.set_enabled(true)?;
```

Other setters: `set_checked`, `set_icon`, `set_accelerator`, `set_native_icon`.

To look an item up after the fact:

```rust
menu.get("status").unwrap().as_menuitem_unchecked().set_text("Status: ready")?;
```

For long-lived state, stash handles in `app.manage(MyMenuState { status, ... })`
and pull them out in commands via `tauri::State<MyMenuState>`.

---

## 5. Tray click events — left vs right

`TrayIconEvent` variants: `Click { button, button_state, position, rect, .. }`,
`DoubleClick`, `Enter`, `Move`, `Leave`. Buttons: `MouseButton::{Left,Right,Middle}`.
States: `MouseButtonState::{Up,Down}`.

Match on `button_state: Up` to fire on release (matches OS conventions).

```rust
use tauri::{
  Manager,
  tray::{MouseButton, MouseButtonState, TrayIconEvent},
};

.on_tray_icon_event(|tray, event| match event {
  TrayIconEvent::Click {
    button: MouseButton::Left,
    button_state: MouseButtonState::Up,
    ..
  } => {
    let app = tray.app_handle();
    if let Some(win) = app.get_webview_window("main") {
      let _ = win.show();
      let _ = win.set_focus();
    }
  }
  _ => {}
})
```

On macOS, right-click is intercepted automatically when a menu is attached and
`show_menu_on_left_click(false)` is set — you don't need to handle it manually.

---

## 6. Context menus from JS

To pop a menu from a frontend click (e.g. on right-click of an element):

```rust
#[tauri::command]
fn show_context_menu(window: tauri::WebviewWindow) -> tauri::Result<()> {
  let menu = tauri::menu::MenuBuilder::new(&window)
    .text("rename", "Rename")
    .text("delete", "Delete")
    .build()?;
  menu.popup(window.clone())?;
  Ok(())
}
```

```js
import { invoke } from '@tauri-apps/api/core';
element.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  invoke('show_context_menu');
});
```

`popup(window)` shows it at the cursor; `popup_at(window, position)` for a specific point.

---

## 7. Menu-bar app — anchor a window to the tray

This is the killer pattern for macOS-style menu-bar apps (popover under the tray
icon). The `tauri-plugin-positioner` plugin computes tray coordinates so you don't
have to.

### Capabilities

`src-tauri/capabilities/default.json`:

```json
{ "permissions": ["positioner:default"] }
```

### Wire it in setup

```rust
use tauri_plugin_positioner::{Position, WindowExt};

app.handle().plugin(tauri_plugin_positioner::init());

let tray = TrayIconBuilder::new()
  .on_tray_icon_event(|tray, event| {
    // Plugin uses this to remember the last-known tray rect.
    tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);
  })
  .build(app)?;
```

### Move the window on click

```rust
TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } => {
  let app = tray.app_handle();
  if let Some(win) = app.get_webview_window("popover") {
    let _ = win.move_window(Position::TrayCenter);  // or TrayLeft, TrayRight, …
    let _ = win.show();
    let _ = win.set_focus();
  }
}
```

Useful `Position` variants: `TrayLeft`, `TrayCenter`, `TrayRight`, `TrayBottomLeft`,
`TrayBottomCenter`, `TrayBottomRight`, plus screen-relative `TopRight`, `BottomLeft`, etc.

In `tauri.conf.json`, configure the popover window:

```json
{ "label": "popover", "decorations": false, "transparent": true,
  "alwaysOnTop": true, "skipTaskbar": true, "visible": false,
  "width": 360, "height": 480 }
```

Hide on blur so it dismisses like a real menu-bar popover (listen for
`WindowEvent::Focused(false)`).

---

## 8. Templates

- `templates/tray.rs` — full menu-bar-app pattern: tray icon + popover toggle on left-click + Quit
  menu item + positioner.
- `templates/capabilities-tray.json` — the positioner permission stanza.

---

## Quick checklist

- `tray-icon` feature in Cargo.toml.
- Tray built inside `.setup(...)`.
- `show_menu_on_left_click(false)` if left-click should toggle a window.
- Use `button_state: MouseButtonState::Up` in click matches.
- Stash mutable `MenuItem` handles for `set_text` / `set_enabled` later.
- For tray-relative window: install `tauri-plugin-positioner` with the `tray-icon` feature, add
  `positioner:default` permission, and call `tauri_plugin_positioner::on_tray_event` from
  `on_tray_icon_event`.

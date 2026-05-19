---
name: tauri-tray-menu-bar-app
description: Use when building a Tauri v2 menu-bar / status-bar app — tray icon with a popover window anchored under the tray via `tauri-plugin-positioner`, left-click toggle, blur-to-hide, frameless+transparent+always-on-top window, hiding the macOS Dock icon (`LSUIElement` / `bundle.macOS.dockIcon`), and Windows tray-area differences.
---

# Tauri v2 — Menu-Bar / Status-Bar App Pattern

A menu-bar app is a tray icon plus a small borderless window that appears
directly under (or above) the tray icon when clicked. There's no taskbar
entry, no Dock icon, no window chrome. Think Bartender, Stats, 1Password's
quick-access, the Linear menu-bar app.

This pattern combines four ingredients:

1. A tray icon (`TrayIconBuilder`) with `show_menu_on_left_click(false)`.
2. A frameless / transparent / always-on-top / skip-taskbar window.
3. `tauri-plugin-positioner` to anchor the window under the tray icon.
4. Per-OS app-presence config (`LSUIElement` on macOS, taskbar tweaks on Windows).

---

## 1. Cargo + plugin setup

```toml
# src-tauri/Cargo.toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-positioner = { version = "2", features = ["tray-icon"] }
```

```bash
npm install @tauri-apps/plugin-positioner   # only if calling moveWindow from JS
```

The `tray-icon` feature on `tauri-plugin-positioner` enables `Position::TrayCenter`,
`TrayLeft`, `TrayRight`, etc. Without it those variants don't exist.

Grant the capability:

```jsonc
// src-tauri/capabilities/default.json
{ "permissions": ["positioner:default"] }
```

---

## 2. Window config — frameless popover

```jsonc
// src-tauri/tauri.conf.json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "url": "index.html",
        "width": 360,
        "height": 480,
        "decorations": false,
        "transparent": true,
        "alwaysOnTop": true,
        "skipTaskbar": true,
        "resizable": false,
        "visible": false,           // start hidden; tray click shows it
        "focus": false,
        "hiddenTitle": true
      }
    ]
  }
}
```

`transparent: true` on macOS requires `macOSPrivateApi: true` in the same
file or the window won't actually be transparent. Linux transparency
requires a compositor.

---

## 3. Hiding from the Dock (macOS) and taskbar (Windows)

**macOS:** The Dock icon is controlled by `LSUIElement` in `Info.plist`.
Tauri v2 has a shortcut in `tauri.conf.json`:

```jsonc
{
  "bundle": {
    "macOS": {
      "dockIcon": false  // sets LSUIElement = true under the hood
    }
  }
}
```

If you need other plist entries, ship an `Info.plist` snippet — see
`templates/Info.plist.LSUIElement`. Without `LSUIElement`, the app shows
in the Dock and Cmd-Tab even with `skipTaskbar`.

**Windows:** `skipTaskbar: true` on the window keeps it out of the taskbar.
Windows tray icons live in the notification area and don't have a "click
the icon to anchor" gesture the way macOS does — `Position::TrayCenter`
still works because Tauri reports the tray rect, but users may have it
collapsed under the overflow chevron. Document that in your README.

**Linux:** Behaviour varies wildly — GNOME hides tray icons entirely
without an extension; KDE works; Sway/Hyprland needs a status-bar widget.
Treat menu-bar apps as best-effort on Linux.

---

## 4. Rust setup — the full pattern

See `templates/menu-bar-app.rs`. The shape:

```rust
use tauri::{
  Manager,
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_positioner::{Position, WindowExt};

tauri::Builder::default()
  .plugin(tauri_plugin_positioner::init())
  .setup(|app| {
    TrayIconBuilder::with_id("main-tray")
      .icon(app.default_window_icon().unwrap().clone())
      .icon_as_template(true)            // macOS: respects dark/light menu bar
      .show_menu_on_left_click(false)    // left-click = popover, not menu
      .on_tray_icon_event(|tray, event| {
        // CRITICAL: forward to positioner so it can cache the tray rect
        tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);

        if let TrayIconEvent::Click {
          button: MouseButton::Left,
          button_state: MouseButtonState::Up,
          ..
        } = event {
          let app = tray.app_handle();
          if let Some(win) = app.get_webview_window("main") {
            if win.is_visible().unwrap_or(false) {
              let _ = win.hide();
            } else {
              let _ = win.move_window(Position::TrayCenter);
              let _ = win.show();
              let _ = win.set_focus();
            }
          }
        }
      })
      .build(app)?;
    Ok(())
  })
```

Two gotchas:

- **`on_tray_event` MUST be called from your handler** — that's where the
  positioner plugin caches the tray icon's screen rect. Skip it and
  `Position::TrayCenter` falls back to top-center of the active monitor.
- **`MouseButtonState::Up`**, not `Down`. macOS sends both; if you act on
  `Down` you'll flicker.

---

## 5. Blur-to-hide

A menu-bar popover should disappear when the user clicks elsewhere. Use
the `Focused` window event:

```rust
.on_window_event(|window, event| {
  if let tauri::WindowEvent::Focused(false) = event {
    if window.label() == "main" {
      let _ = window.hide();
    }
  }
})
```

Combine with `alwaysOnTop: true` so the popover stays above the previously-
focused app while it's visible. For "stay open while interacting with a
child dialog" set `alwaysOnTop` and skip the auto-hide for specific labels.

---

## 6. Left-click toggle vs. context menu

`show_menu_on_left_click(false)` makes left-click fire `Click` events instead
of opening the attached menu. Right-click still opens the menu — so the
common pattern is:

- **Left-click:** toggle popover (the UI lives in the window).
- **Right-click:** small menu with `Quit`, `About`, `Open at login`.

Attach a menu via `.menu(&menu)` on the builder; the right-click behavior
comes for free. See `tauri-tray-menu-context-menus` for menu construction.

---

## 7. Positioner — all anchor options

Available `Position` variants (with `tray-icon` feature):

```text
TopLeft, TopRight, BottomLeft, BottomRight,
TopCenter, BottomCenter, LeftCenter, RightCenter, Center,
TrayLeft, TrayBottomLeft, TrayRight, TrayBottomRight,
TrayCenter, TrayBottomCenter
```

`TrayCenter` = centered horizontally under the tray icon (the menu-bar-app
default). `TrayBottomCenter` is for Windows where the taskbar is at the
bottom — pick based on `cfg!(target_os = ...)` if you care.

---

## 8. Common failures

| Symptom                              | Cause                                                        |
| ------------------------------------ | ------------------------------------------------------------ |
| Window appears top-center of screen  | `on_tray_event` not forwarded to positioner                  |
| Window not transparent on macOS      | `macOSPrivateApi: false` in tauri.conf.json                  |
| App still shows in Dock              | `bundle.macOS.dockIcon` missing or `Info.plist` overrides it |
| Popover flickers on click            | Acted on `MouseButtonState::Down` instead of `Up`            |
| Popover doesn't hide on click-away   | Missing `Focused(false)` handler                             |
| `Position::TrayCenter` doesn't exist | `tray-icon` feature missing on `tauri-plugin-positioner`     |

---

## Templates

- `templates/menu-bar-app.rs` — full `lib.rs` for a menu-bar app.
- `templates/Info.plist.LSUIElement` — plist snippet for hiding from Dock.

Pairs with `tauri-tray-menu` (parent), `tauri-windows` (decorations/transparency),
and `tauri-tray-menu-context-menus` (right-click menu on the tray).

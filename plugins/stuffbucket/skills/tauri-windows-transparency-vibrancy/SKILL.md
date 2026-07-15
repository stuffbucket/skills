---
name: tauri-windows-transparency-vibrancy
description: Use when building a transparent or vibrant Tauri v2 window — setting `transparent:true` in config, applying macOS NSVisualEffect via the `window-vibrancy` crate (`apply_vibrancy(window, NSVisualEffectMaterial::HudWindow, ...)`), Windows 11 `apply_mica` / `apply_acrylic`, the platform support matrix, CSS for transparent backgrounds with rounded corners, and the menubar-app combo (`alwaysOnTop` + `transparent:true` + `decorations:false`).
---

# Tauri v2 — Transparent & Vibrant Windows

Transparent windows let your app blend into the desktop. *Vibrant* windows go
further: the OS samples what's behind the window and applies a live blur
(macOS NSVisualEffect, Windows 11 Mica/Acrylic). The combination of
`decorations: false + transparent: true + apply_vibrancy(...)` is what makes
a polished menubar app or HUD-style overlay.

See [[tauri-windows]] for the overview, [[tauri-windows-custom-titlebar]] for
the chrome you'll draw on top, and [[tauri-tray-menu]] for the menubar app
pattern this pairs with.

## Step 1 — declare a transparent window

```json title="src-tauri/tauri.conf.json"
{
  "app": {
    "windows": [
      {
        "label": "main",
        "decorations": false,
        "transparent": true,
        "alwaysOnTop": true,
        "skipTaskbar": true,
        "width": 360,
        "height": 480
      }
    ]
  },
  "bundle": {
    "macOS": { "minimumSystemVersion": "10.14" }
  }
}
```

`transparent: true` is required. Without it, the OS draws an opaque background
behind your webview and any vibrancy call is invisible. On Linux, transparency
requires a compositor (most modern DEs); without one the window becomes
solid black.

## Step 2 — make CSS truly transparent

The webview also has its own background, set by the page CSS. Both the
`<html>` and `<body>` need transparent backgrounds, or your "transparent
window" shows white:

```css
html, body {
  background: transparent;
  margin: 0;
  height: 100%;
}

/* The actual card you want users to see */
.app {
  background: rgba(20, 20, 22, 0.62);  /* semi-opaque over the blur */
  border-radius: 12px;
  height: 100%;
  backdrop-filter: blur(20px);          /* fallback if vibrancy unavailable */
}
```

Rounded corners: set `border-radius` on the visible element, not on
`<html>` — Windows clips before the radius and you'll see square corners on
the OS shadow.

## Step 3 — apply vibrancy with `window-vibrancy`

Add the crate (a Tauri-team-maintained sibling of `tauri`):

```sh
cargo add window-vibrancy
```

```rust title="src-tauri/src/lib.rs"
use tauri::Manager;
#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};
#[cfg(target_os = "windows")]
use window_vibrancy::{apply_mica, apply_acrylic};

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "macos")]
            apply_vibrancy(
                &window,
                NSVisualEffectMaterial::HudWindow,
                Some(NSVisualEffectState::Active),
                Some(12.0),  // corner radius in pt
            ).expect("apply_vibrancy is macOS-only");

            #[cfg(target_os = "windows")]
            apply_mica(&window, Some(true))            // true = dark mica
                .or_else(|_| apply_acrylic(&window, Some((18, 18, 18, 125))))
                .ok();

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

See `templates/vibrancy.rs` for a more complete version that picks the right
material based on system theme.

## Platform support matrix

| API                               | macOS                 | Windows 11            | Windows 10          | Linux                 |
| --------------------------------- | --------------------- | --------------------- | ------------------- | --------------------- |
| `transparent: true` window        | yes                   | yes (with compositor) | yes                 | yes (with compositor) |
| `apply_vibrancy(NSVisualEffect*)` | yes (10.10+)          | —                     | —                   | —                     |
| `apply_mica`                      | —                     | yes (22H2+)           | —                   | —                     |
| `apply_acrylic`                   | —                     | yes                   | yes (1809+)         | —                     |
| `apply_blur`                      | —                     | yes                   | yes (Aero)          | —                     |
| CSS `backdrop-filter`             | yes (with `-webkit-`) | yes                   | yes (Edge/WebView2) | yes (recent WebKit)   |

Always wrap calls in `#[cfg(...)]` — the wrong-OS function isn't even compiled
in. Fall back gracefully on Windows 10 (Mica → Acrylic → solid). On Linux,
rely on CSS `backdrop-filter` because no compositor-level vibrancy API exists.

## macOS materials — pick the right one

| Material                | Use for                                                 |
| ----------------------- | ------------------------------------------------------- |
| `HudWindow`             | Floating panels, menubar popovers — strong frosted look |
| `Sidebar`               | Sidebar-like surfaces; less blur, more vibrancy         |
| `Menu`                  | Right-click menus                                       |
| `Popover`               | Detachable popovers                                     |
| `WindowBackground`      | Main windows — subtle, system-default                   |
| `UnderWindowBackground` | Slightly darker variant                                 |
| `Titlebar`              | Just the titlebar area                                  |
| `ContentBackground`     | Pairs with `WindowBackground` for content area          |

`NSVisualEffectState::Active` means the blur is always live (even when the
window isn't focused). `FollowsWindowActiveState` dims when blurred — usually
what you want for main windows.

## Windows 11 — Mica vs Acrylic

- **Mica** (`apply_mica`) — subtle, opaque-ish, samples the *desktop wallpaper
  only*. Best for main windows that should feel native to Win11. Light/dark
  follows the system theme; pass `Some(true)` to force dark.
- **Acrylic** (`apply_acrylic`) — live blur of whatever is behind, including
  other windows. Best for floating panels and menubar apps. Takes optional
  `(r, g, b, a)` tint.
- **Blur** (`apply_blur`) — older Aero-style; works on Win10. Lower fidelity
  than Acrylic but more compatible.

Pattern: try Mica → Acrylic → Blur → no-op, depending on platform support.

## The menubar-app combo

The full recipe for a polished menubar popover:

```json
{
  "label": "popover",
  "decorations": false,
  "transparent": true,
  "alwaysOnTop": true,
  "skipTaskbar": true,
  "visible": false,
  "resizable": false,
  "width": 360,
  "height": 480
}
```

```rust
#[cfg(target_os = "macos")]
apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow,
               Some(NSVisualEffectState::Active), Some(10.0))?;

#[cfg(target_os = "windows")]
apply_acrylic(&window, Some((18, 18, 18, 180))).ok();
```

Combine with a tray icon (see [[tauri-tray-menu]]) that calls
`window.set_position()` + `window.show()` + `window.set_focus()` on click,
and `onCloseRequested` to hide instead of close.

## Common pitfalls

- **Solid white background despite `transparent: true`** — page CSS has an
  opaque `<html>` or `<body>` background. Check devtools' "Computed" panel.
- **Vibrancy invisible on macOS** — window isn't transparent, or you passed
  the wrong `target_os` cfg. Verify with `console.log(getCurrentWindow())`
  and check the Rust setup ran (it's silent on success).
- **`apply_mica` returns Err on Windows 10** — it's 22H2+. Use `.or_else()`
  fallback to Acrylic.
- **Rounded corners look square on Windows** — `border-radius` must be on
  the visible element, not `<html>`. Also the OS shadow stays rectangular;
  use a CSS `box-shadow` if you need a rounded shadow.
- **`alwaysOnTop` annoys users** — only set it for popovers, never for main
  windows. Toggle with `setAlwaysOnTop(true)` when the popover shows and
  `false` when it loses focus (or just close on blur).
- **GPU usage spikes** — vibrancy + heavy CSS animation = constant
  recompositing. Profile in Activity Monitor / Task Manager; reduce
  blur radius or animate fewer elements.

## Templates

- `templates/vibrancy.rs` — full setup with platform cfg, Mica→Acrylic
  fallback, and theme detection. Drop into `src-tauri/src/lib.rs`.

## See also

- [[tauri-windows]] — parent skill
- [[tauri-windows-custom-titlebar]] — the chrome you draw on top
- [[tauri-tray-menu]] — menubar app patterns
- [[tauri-windows-multi-window]] — show/hide and label lookup

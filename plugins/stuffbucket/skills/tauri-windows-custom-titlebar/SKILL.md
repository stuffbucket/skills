---
name: tauri-windows-custom-titlebar
description: Use when building a frameless Tauri v2 window with a custom HTML titlebar — setting `decorations:false`, wiring `data-tauri-drag-region`, implementing minimize/maximize/close traffic-light buttons via `getCurrentWindow()`, granting the `core:window:allow-*` capabilities, handling double-click-to-maximize, and bridging macOS traffic-light placement vs Windows snap-layouts (`core:window:allow-internal-toggle-maximize`).
---

# Tauri v2 — Frameless Windows + Custom Titlebars

The native OS chrome is one DOM element you don't control. Turn it off, draw
your own, and you own everything from the traffic lights to the menu bar to the
window-snap affordances. The cost: you re-implement drag, double-click-maximize,
and platform conventions. This skill walks the full setup.

See [[tauri-windows]] for the top-level overview and [[tauri-security]] for the
capability model.

## Step 1 — disable native decorations

```json title="src-tauri/tauri.conf.json"
{
  "app": {
    "windows": [
      {
        "label": "main",
        "decorations": false,
        "title": "My App",
        "width": 1000,
        "height": 700
      }
    ]
  }
}
```

With `decorations: false`, the OS draws nothing — no titlebar, no border, no
close button. Your HTML covers the entire window surface.

## Step 2 — draw the titlebar in HTML

The titlebar is just a fixed-position `<div>` at the top of your page. The
drag region is **declared via attribute**, not JS:

```html
<div class="titlebar" data-tauri-drag-region>
  <div class="titlebar-title" data-tauri-drag-region>My App</div>
  <div class="titlebar-controls">
    <button id="titlebar-minimize" aria-label="minimize">…</button>
    <button id="titlebar-maximize" aria-label="maximize">…</button>
    <button id="titlebar-close"    aria-label="close">…</button>
  </div>
</div>
```

`data-tauri-drag-region` makes that element a draggable handle for the window.
Tauri intercepts mousedown on the element and calls `startDragging()` natively;
double-click toggles maximize automatically (on supporting platforms). Children
that aren't themselves dragged (e.g. buttons, inputs) still receive their own
events — only elements *with the attribute* drag.

See `templates/titlebar.html` for a complete drop-in.

## Step 3 — style it

Three rules that bite: `user-select: none` (otherwise drag selects text),
`-webkit-app-region: drag` (not needed if you use the data attribute, but useful
on legacy WebKit), and a fixed height that matches your control buttons. See
`templates/titlebar.css`.

## Step 4 — wire button clicks

```ts
import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

document.getElementById('titlebar-minimize')!
  .addEventListener('click', () => appWindow.minimize());
document.getElementById('titlebar-maximize')!
  .addEventListener('click', () => appWindow.toggleMaximize());
document.getElementById('titlebar-close')!
  .addEventListener('click', () => appWindow.close());
```

`getCurrentWindow()` returns the `Window` for the current webview — works in
every window including child windows. See `templates/titlebar.ts`.

## Step 5 — grant capabilities

Every window method is a separate permission. Default capabilities omit
`allow-start-dragging` for safety, so you must add it explicitly:

```json title="src-tauri/capabilities/default.json"
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:default",
    "core:window:allow-start-dragging",
    "core:window:allow-minimize",
    "core:window:allow-toggle-maximize",
    "core:window:allow-close",
    "core:window:allow-internal-toggle-maximize"
  ]
}
```

Without `allow-start-dragging`, the drag region is inert. Without
`allow-internal-toggle-maximize`, double-click-to-maximize fails silently on
Windows snap-layout hover (see platform notes).

## Manual drag (if you need conditional drag)

Skip the attribute and call the API yourself:

```ts
document.getElementById('titlebar')!.addEventListener('mousedown', (e) => {
  if (e.buttons !== 1) return;  // left button only
  if (e.detail === 2) {
    appWindow.toggleMaximize();
  } else {
    appWindow.startDragging();
  }
});
```

Useful when only *part* of a region should drag (e.g. a sidebar header that
drags except when clicking the collapse caret).

## Platform differences

| Concern                                    | macOS                                                                                  | Windows                                                                               | Linux (GTK)              |
| ------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------ |
| Traffic-light placement                    | Top-left, OS-drawn even with `decorations:false` if you set `titleBarStyle: "Overlay"` | Top-right, you draw them                                                              | Top-right, you draw them |
| Snap layouts (Win11 hover-maximize-button) | n/a                                                                                    | Needs `allow-internal-toggle-maximize` so Tauri intercepts the system-internal toggle | n/a                      |
| Double-click-to-maximize on drag region    | Free with `data-tauri-drag-region`                                                     | Free with `data-tauri-drag-region` + `allow-internal-toggle-maximize`                 | Free                     |
| Window shadow on transparent window        | Native                                                                                 | Loses shadow without decorations                                                      | DE-dependent             |
| `traffic_light_position` (Rust builder)    | Available — move buttons inset to align with custom titlebar height                    | n/a                                                                                   | n/a                      |

For macOS, the cleanest approach is a transparent native titlebar overlaying
your HTML — set `title_bar_style(TitleBarStyle::Overlay)` and inset your
content. This keeps native traffic lights with their accessibility behaviors
intact while still letting you draw a custom area beside them.

## Windows 11 snap layouts

The "hover the maximize button to see snap options" gesture is implemented by
the OS sending a `WM_NCHITTEST` that resolves to `HTMAXBUTTON`. Tauri's
`allow-internal-toggle-maximize` lets your maximize button report itself as the
system maximize button so the OS shows the snap menu on hover. Without it,
Win11 users lose snap layouts on your app — a regression they'll notice.

## Common pitfalls

- **Buttons inside `data-tauri-drag-region`:** the drag swallows the click.
  Put buttons in a sibling without the attribute.
- **Forgetting `user-select: none`:** triple-clicking the titlebar selects text
  instead of dragging.
- **`allow-start-dragging` missing:** drag silently no-ops. Look at devtools
  console for the "not allowed" error.
- **`overflow: hidden` on `<html>` + transparent corner radius:** Windows
  clips before the corner round, leaving a square shadow. Use `border-radius`
  on `<body>` + `transparent: true` on the window.
- **Touch devices:** `data-tauri-drag-region` works with `pointerdown`, but you
  may want `touch-action: none` to stop pull-to-refresh on the titlebar.

## Templates

- `templates/titlebar.html` — drop-in markup with traffic-light SVGs.
- `templates/titlebar.css` — minimal styling, 30px height, hover states.
- `templates/titlebar.ts` — button wiring + manual-drag fallback.

## See also

- [[tauri-windows]] — parent skill
- [[tauri-windows-transparency-vibrancy]] — for the "no decorations + transparent + vibrant" combo
- [[tauri-security]] — capability files in depth

---
name: tauri-events-targeted-emit
description: Use when an event in a Tauri v2 app should reach only some windows/webviews — `emit_to` for one or many labels, `emit_filter` for predicate-based routing, and the JS-side `listen` / `listenAny` / `target` distinction. Covers the decision tree for picking the right addressing strategy.
---

# Tauri v2: Targeted Event Emission

`Emitter::emit` is broadcast — every listener in every window/webview gets it. That is rarely what
you want once the app has more than one window. Tauri exposes a small set of addressing primitives;
pick deliberately.

## The four emit verbs

```rust
use tauri::{AppHandle, Emitter, EventTarget};

// 1. Broadcast — everyone, in every window.
app.emit("status-changed", &payload)?;

// 2. One specific window or webview, by label.
app.emit_to("settings", "config-updated", &payload)?;
app.emit_to(EventTarget::webview_window("settings"), "config-updated", &payload)?;

// 3. A set of labels.
app.emit_to(
  EventTarget::labels(["main", "settings"]),
  "theme-changed",
  &theme,
)?;

// 4. Predicate over EventTarget — full control.
app.emit_filter("close-popups", &(), |target| matches!(
  target,
  EventTarget::Webview { label } if label.starts_with("popup-")
))?;
```

`emit_to` accepts anything that implements `Into<EventTarget>`. A bare `&str` is the common case (=
a webview-window label).

### `EventTarget` variants worth knowing

| Variant                   | Helper                               | Matches                                               |
| ------------------------- | ------------------------------------ | ----------------------------------------------------- |
| `App`                     | `EventTarget::app()`                 | `App::listen` (Rust-side global listeners)            |
| `Window { label }`        | `EventTarget::window(label)`         | Window-level listeners on a specific OS window        |
| `Webview { label }`       | `EventTarget::webview(label)`        | A single webview (e.g. inside a multi-webview window) |
| `WebviewWindow { label }` | `EventTarget::webview_window(label)` | The common case — one window that owns one webview    |
| `Any`                     | —                                    | Default for unscoped listeners                        |
| `AnyLabel { label }`      | `EventTarget::labels([...])`         | Any target whose label matches                        |

The distinction between `Webview` and `WebviewWindow` matters in apps that create extra webviews
inside one window (split panes, popovers). For garden-variety multi-window apps, `WebviewWindow` is
what you want.

## JS side: who hears what

```ts
import { listen, emit, TauriEvent } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

// Listens to events targeted at THIS webview window OR broadcast to all.
const unlisten = await listen<string>('config-updated', (e) => {
  console.log('payload', e.payload, 'from', e.windowLabel);
});

// Explicitly listen on a different target — e.g., the global "main" window.
await listen<Theme>('theme-changed', handler, { target: 'main' });
await listen<Theme>('theme-changed', handler, { target: { kind: 'WebviewWindow', label: 'main' } });
```

Key rule: a bare `listen('foo', …)` in window `settings` receives events that were sent broadcast OR
with `emit_to("settings", …)`. It does **not** receive an event sent with `emit_to("main", …)` —
that one is addressed elsewhere.

To listen for events regardless of target, use the lower-level `listen` from `@tauri-apps/api/event`
with `{ target: { kind: 'Any' } }`, or call `emit_filter`/broadcast on the producer side instead.

JS-side `emit('foo', payload)` is broadcast; use `getCurrentWebviewWindow().emit(...)` or
`WebviewWindow.getByLabel('main').emit(...)` to scope it.

## Decision tree

```text
Does every window need this event?
├── Yes → emit (broadcast)
└── No → How is the target chosen?
        ├── Static set of 1 label    → emit_to("label", …)
        ├── Static set of 2–N labels → emit_to(EventTarget::labels([...]), …)
        ├── Dynamic / pattern match  → emit_filter(|t| …)
        └── Single window + tight coupling to one command's lifetime
                                     → use a Channel<T> instead
                                       (see tauri-events-channels-streaming)
```

Two common mistakes:

- **Broadcasting state that's window-local.** A "form is dirty" event broadcast from the settings
  window wakes every listener app-wide. Scope it.
- **Filter where `emit_to` works.** `emit_filter` runs the closure once per target; for a fixed list
  of labels, `EventTarget::labels` is cheaper and clearer.

## Templates

- `templates/targeted-emit.rs` — multi-window app emitting to one window, to a label set, and via a
  filter (popup pattern).

## Related

- `tauri-events` — parent skill, broadcast events + Rust↔JS basics.
- `tauri-events-channels-streaming` — when the "target" is really "the one consumer that asked for
  this stream".
- `tauri-windows` — creating the labeled windows you're addressing.

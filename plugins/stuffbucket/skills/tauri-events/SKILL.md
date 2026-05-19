---
name: tauri-events
description: Use when pushing data from Rust to JS in a Tauri v2 app — global events with `emit`/`listen`, targeted events with `emit_to`, streaming via `Channel`, or deciding between events and command return values for a feature.
---

# Tauri v2: Events and Channels (Rust → JS push)

Tauri v2 has three mechanisms for moving data from Rust to JS. Pick the right one — they have
different cost and semantics.

| Mechanism                        | Use for                                                                           | Cost                                  |
| -------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------- |
| `#[tauri::command]` return value | Request/response, JS asks, Rust answers once                                      | Lowest for one shot                   |
| Events (`emit` / `listen`)       | Unsolicited, low-frequency push (status changes, lifecycle, cross-window signals) | Per-event serialize + global dispatch |
| `Channel<T>`                     | Streaming, high-frequency, or large payloads tied to one command                  | One open pipe, minimal overhead       |

Quick rule: **commands ask, events broadcast, channels stream.** If a feature is one Rust task that
produces many JS-side updates (download progress, tail logs, parsing stream), reach for a channel.

## Global events

Rust side uses the `Emitter` trait on `AppHandle`, `Window`, `Webview`, or `WebviewWindow`. Payload
must implement `Serialize + Clone`.

```rust
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadStarted<'a> {
  url: &'a str,
  download_id: usize,
}

#[tauri::command]
fn start_download(app: AppHandle, url: String) {
  app.emit("download-started", DownloadStarted { url: &url, download_id: 1 }).unwrap();
  app.emit("download-progress", 50).unwrap();
  app.emit("download-finished", 1).unwrap();
}
```

JS side uses `@tauri-apps/api/event`:

```ts
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

const unlisten: UnlistenFn = await listen<number>('download-progress', (e) => {
  console.log('progress', e.payload, 'from window', e.windowLabel);
});
```

The callback receives an `Event<T>` with `payload`, `event`, `id`, and (when applicable)
`windowLabel`.

## Targeted emit

`emit` goes to every listener in every webview. To narrow it:

```rust
use tauri::{AppHandle, Emitter, EventTarget};

// Single labeled window:
app.emit_to("login", "login-result", "loggedIn").unwrap();

// Arbitrary target type:
app.emit_to(EventTarget::webview_window("settings"), "refresh", ()).unwrap();

// Multi-target filter:
app.emit_filter("open-file", path, |target| match target {
  EventTarget::WebviewWindow { label } => label == "main" || label == "file-viewer",
  _ => false,
}).unwrap();
```

Use targeted emit when you have multiple windows and an event is only meaningful to one — it avoids
waking up unrelated listeners and prevents accidental cross-window coupling.

## Listening in Rust

Rust can also subscribe — useful for cross-process signals or test harnesses:

```rust
use tauri::Listener;

let id = app.listen("frontend-ready", |event| {
  println!("got payload: {}", event.payload());
});

// One-shot:
app.once("first-paint", |_event| { /* ... */ });

// Drop the subscription when you're done:
app.unlisten(id);
```

`event.payload()` returns the raw JSON string — deserialize with `serde_json::from_str` if you need
typed access.

## Channels — streaming `Channel<T>`

When the frontend invokes a command that needs to stream back (download progress, log tail, SSE
re-broadcast), pass a `Channel` as a command argument. The event system is explicitly **not designed
for low latency or high throughput** — channels are.

```rust
use serde::Serialize;
use tauri::ipc::Channel;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
enum DownloadEvent<'a> {
  Started { url: &'a str, content_length: usize },
  Progress { chunk_length: usize },
  Finished,
}

#[tauri::command]
async fn download(url: String, on_event: Channel<DownloadEvent<'_>>) -> Result<(), String> {
  on_event.send(DownloadEvent::Started { url: &url, content_length: 1024 }).map_err(|e| e.to_string())?;
  for _ in 0..10 {
    on_event.send(DownloadEvent::Progress { chunk_length: 102 }).map_err(|e| e.to_string())?;
  }
  on_event.send(DownloadEvent::Finished).map_err(|e| e.to_string())?;
  Ok(())
}
```

```ts
import { invoke, Channel } from '@tauri-apps/api/core';

type DownloadEvent =
  | { event: 'started'; data: { url: string; contentLength: number } }
  | { event: 'progress'; data: { chunkLength: number } }
  | { event: 'finished' };

const onEvent = new Channel<DownloadEvent>();
onEvent.onmessage = (msg) => {
  if (msg.event === 'progress') updateBar(msg.data.chunkLength);
};
await invoke('download', { url: 'https://example.com/big.bin', onEvent });
```

Channels are unidirectional (Rust → JS), tied to one command invocation, and have no cross-window
broadcast. Multiple concurrent downloads = multiple channels.

## Events vs commands vs channels — decision guide

- **Need a response to a user action right now?** Command return value. Don't emit an event the
  caller has to correlate.
- **Multiple windows care about the same state change?** Global event.
- **One specific window cares?** `emit_to` with that window label.
- **Same logical task produces many updates over time?** Channel. Don't loop `emit` inside a command
  — you pay full dispatch cost per tick.
- **Backpressure matters?** Channel — `send` returns `Result` and respects the IPC transport. Events
  fire-and-forget.

## Lifecycle and leaks

**JS:** every `listen()` returns an `UnlistenFn`. Call it on component unmount or you leak a
subscription per mount. In React:

```ts
useEffect(() => {
  let unlisten: UnlistenFn | undefined;
  listen('download-progress', handler).then((fn) => { unlisten = fn; });
  return () => { unlisten?.(); };
}, []);
```

In vanilla TS, wire the unlisten into your teardown path (window close, view switch, etc.).

**Rust:** `app.listen` returns an `EventId` — call `app.unlisten(id)` when done, or use `app.once`
for self-cleaning one-shots. Channels close automatically when the JS-side `Channel` is GC'd or the
command future ends.

## Common pitfalls

- **Forgetting `Clone` on payload structs** — `emit` requires it; the borrow checker will tell you
  with a confusing message about `Emitter`.
- **Listening before the window exists** — use `app.once("tauri://webview-created", ...)` or set up
  listeners inside `setup` once you have the handle.
- **Emitting from a hot loop without batching** — switch to a channel, or coalesce updates (throttle
  to ~60Hz / 16ms).
- **Cross-window leakage** — `emit` is global. If a payload contains window-specific state, use
  `emit_to` or filter on the JS side via `e.windowLabel`.
- **Assuming order across mechanisms** — events and channel messages are not ordered with respect to
  command return values.

## Templates

See `templates/events.rs` for a complete Rust handler showing global emit, targeted emit, and a
`Channel<ProgressEvent>` streaming command. See `templates/events.ts` for the matching JS — global
`listen` with cleanup, and a streaming `Channel` consumer.

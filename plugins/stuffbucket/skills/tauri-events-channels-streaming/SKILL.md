---
name: tauri-events-channels-streaming
description: Use when streaming data from Rust to JS in a Tauri v2 app with `tauri::ipc::Channel` — download/upload progress, child-process tail, long-running parsers, or any single-consumer ordered stream. Covers Rust + JS wiring, backpressure, lifecycle, and channels vs events trade-offs.
---

# Tauri v2: Streaming with `Channel<T>`

`Channel<T>` is a one-direction Rust→JS pipe attached to a single command invocation. Unlike `emit`,
it isn't broadcast: exactly one JS-side `onmessage` handler receives the values, in order, with no
global routing.

## When to choose a channel over `emit`

| Signal                         | Channel                                        | Event                                            |
| ------------------------------ | ---------------------------------------------- | ------------------------------------------------ |
| High frequency (>10/s)         | yes                                            | no — every emit hits the global dispatcher       |
| Large payloads                 | yes                                            | no — JSON serialized into every listener's queue |
| Strict ordering                | yes — preserved by the underlying mpsc         | best-effort                                      |
| Single consumer                | yes — channel is owned by its JS handle        | events broadcast to every `listen`               |
| Cross-window fan-out           | no                                             | yes                                              |
| Lifetime tied to one operation | yes — drops with the JS handle                 | no — listeners outlive the producer              |
| Raw binary bytes               | yes — `Channel<Vec<u8>>` stays raw on the wire | no — JSON-encoded as a number array              |

Rule of thumb: if the stream belongs to one command and nobody else cares, use a channel.

## Rust side

`Channel<T>` is a regular command argument. Tauri serializes the JS-side `Channel` handle and
reconstructs the Rust end on invoke.

```rust
use serde::Serialize;
use tauri::ipc::Channel;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
enum ProgressEvent {
  Started { total_bytes: u64 },
  Chunk { bytes_read: u64 },
  Done { sha256: String },
}

#[tauri::command]
async fn hash_file(path: String, on_event: Channel<ProgressEvent>) -> Result<(), String> {
  on_event.send(ProgressEvent::Started { total_bytes: 0 }).map_err(|e| e.to_string())?;
  // … read loop calling on_event.send(ProgressEvent::Chunk { … })
  on_event.send(ProgressEvent::Done { sha256: "…".into() }).map_err(|e| e.to_string())?;
  Ok(())
}
```

The tagged-enum pattern (`tag = "event"`) gives the JS side a discriminated union — see
`templates/channel-stream.ts`.

`send()` returns `Result<(), tauri::Error>`. The only failure mode is "the JS-side handle was
dropped"; treat it as a cancellation signal and exit the loop.

## JS side

```ts
import { invoke, Channel } from '@tauri-apps/api/core';

type ProgressEvent =
  | { event: 'started'; data: { totalBytes: number } }
  | { event: 'chunk';   data: { bytesRead: number } }
  | { event: 'done';    data: { sha256: string } };

const onEvent = new Channel<ProgressEvent>();
onEvent.onmessage = (msg) => {
  switch (msg.event) {
    case 'started': /* … */ break;
    case 'chunk':   /* … */ break;
    case 'done':    /* … */ break;
  }
};

await invoke('hash_file', { path: '/tmp/big.iso', onEvent });
```

The `Channel` instance is just a plain JS object; pass it like any other arg. Reassigning
`onmessage` is fine. Don't reuse a single channel across invocations — make a new one per call.

## Backpressure

Channels are **unbounded** on the Rust side. If `send()` is called faster than JS can drain
`onmessage`, memory grows. There is no built-in throttle. Handle it at the producer:

- **Sample**: only send every N items, or every M ms (`tokio::time::Instant::elapsed`).
- **Coalesce**: collapse `Chunk { bytes_read }` updates — overwrite an `Arc<AtomicU64>` and only
  `send()` when a timer ticks.
- **Batch**: ship `Vec<Item>` per message instead of one item per message.

For genuine flow control (JS must ack before next chunk), you need a second channel JS→Rust —
easiest path is a separate command JS calls per ack.

## Lifecycle

The channel lives as long as the JS-side `Channel` instance is reachable. When JS drops it
(component unmounts, page navigates, GC collects), the Rust `Channel<T>` drops and the next `send()`
returns `Err`. Use that to bail out of long loops:

```rust
if on_event.send(ProgressEvent::Chunk { bytes_read }).is_err() {
  break; // consumer went away
}
```

Channels are **not** tied to the command's `await invoke(...)` — the Rust task can keep running
after the JS Promise resolves, and `send()` keeps working as long as the JS handle is alive. If you
want the inverse (cancel when the command future drops), keep the work on the command's `async` task
and use Rust's standard drop semantics.

## Raw bytes

`Channel<Vec<u8>>` ships bytes without JSON-encoding them into a number array — they arrive in JS as
an `ArrayBuffer`/`Uint8Array`. This is the only sane way to stream binary (audio frames, image
tiles, decoded chunks) at any volume. Events cannot do this; they JSON-stringify everything.

## Templates

- `templates/channel-stream.rs` — file-hash-with-progress command, tagged enum, sampled progress.
- `templates/channel-stream.ts` — matching JS consumer, discriminated union.

## Related

- `tauri-events` — parent skill, decision matrix vs commands/events.
- `tauri-events-targeted-emit` — when fan-out across windows is required.
- `tauri-commands` — channels are passed as command arguments; command basics live there.

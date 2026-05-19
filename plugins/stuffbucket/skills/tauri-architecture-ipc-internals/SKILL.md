---
name: tauri-architecture-ipc-internals
description: Use when reasoning about how Tauri v2's `invoke()` actually crosses the process boundary — the postMessage bridge, `__TAURI_INTERNALS__`, request/response correlation, JSON vs raw-byte vs `Channel` serialization, sync-stringify cost, throughput limits (~1k JSON commands/sec/WebView), and when to bypass the JSON path with raw IPC.
---

# Tauri v2 IPC Internals

Tauri's IPC is async message-passing between the WebView (JS) and Core (Rust). It looks like a
function call (`invoke('cmd', args)`), but underneath it's `postMessage` over a bridge,
JSON-serialized, correlated by callback IDs, and routed through the Core process. Understanding the
layers tells you when `invoke()` is fine and when you need a different primitive.

## The bridge: `__TAURI_INTERNALS__`

Tauri injects a global object into every WebView before user scripts run:

```js
window.__TAURI_INTERNALS__ = {
  invoke,            // the function you call (via @tauri-apps/api/core)
  postMessage,       // raw bridge — webkit.messageHandlers / chrome.webview / ipc.postMessage
  transformCallback, // registers a one-shot callback, returns an integer ID
  metadata: { currentWindow, currentWebview, ... },
}
```

The public `invoke()` from `@tauri-apps/api/core` is a thin wrapper:

1. JSON-stringify the args object.
2. `transformCallback(resolve)` → integer ID for success.
3. `transformCallback(reject)` → integer ID for failure.
4. `__TAURI_INTERNALS__.postMessage({ cmd, callback, error, payload })`.
5. Core decodes, dispatches to the `#[tauri::command]`, sends result back via `eval`/native bridge,
   which finds the callback by ID and calls `resolve`/`reject`.

That's it. There's no shared memory. Every call round-trips a stringified payload through the
OS-provided WebView IPC channel (WKWebView's `WKScriptMessageHandler`, WebView2's
`web_message_received`, webkitgtk's user-script messages).

## Serialization tiers

Tauri exposes three payload shapes depending on data type and direction:

| Mechanism                                      | JS → Rust | Rust → JS     | Encoding                            | Use when                                                |
| ---------------------------------------------- | --------- | ------------- | ----------------------------------- | ------------------------------------------------------- |
| `invoke('cmd', args)`                          | JSON      | JSON          | `JSON.stringify` / serde            | Default — small structured payloads                     |
| `tauri::ipc::Response` (raw)                   | —         | bytes         | Length-prefixed binary, no JSON     | Large/binary return values (files, images, blobs)       |
| `Channel<T>`                                   | —         | bytes or JSON | Streamed messages with sequence IDs | Progress, streaming inference, file reads, large arrays |
| `invoke()` with `ArrayBuffer`/`Uint8Array` arg | bytes     | —             | Raw IPC slot (Tauri 2.x)            | Uploading binary from JS without base64                 |

The JSON tier is what bites you. `JSON.stringify` is **synchronous** and runs on the WebView's main
thread. A 5 MB object stringifies in tens of milliseconds and freezes paint during that time. The
serde side on Rust deserializes synchronously into your command's struct before your handler runs.

## Request/response correlation

Each `invoke()` registers two integer callbacks via `transformCallback`. The Core process echoes the
integer back in the response, and the JS-side bridge does:

```js
window[`_${callbackId}`](result);
delete window[`_${callbackId}`];   // one-shot
```

That's how parallel `invoke()` calls don't get mixed up — the integer ID is the correlation key.
There is no per-call channel, just a flat global namespace of pending callbacks. Two consequences:

- A leaked `Promise` (never awaited, handler never returns) leaves the callback registered forever.
  Tiny leak, but cumulative.
- Callbacks survive only on the current window object. Navigation or webview reload drops all
  pending calls — they'll never resolve.

## Performance characteristics

Order-of-magnitude numbers to keep in mind (these vary by OS/CPU, microbenchmark before relying on
them):

- **~1,000 JSON `invoke()` calls/sec per WebView** before the bridge becomes the bottleneck. The
  cost is dominated by stringify + parse on both sides plus the IPC syscall.
- Payloads under ~1 KB are essentially free; the bridge crossing dominates.
- Payloads over ~100 KB you should be on `Response`, `Channel<T>`, or an `ArrayBuffer` arg — JSON
  encoding cost grows linearly and runs on the UI thread.
- A `Channel<T>` push has lower per-message overhead than a fresh `invoke()` because there's no
  callback registration round-trip.

If you're hitting the bridge in a hot loop (60 fps animation reading state from Rust), you're using
the wrong primitive — pull state into JS once, or push from Rust with events/channels.

## When to bypass `invoke()`

| Symptom                                                | Switch to                                        |
| ------------------------------------------------------ | ------------------------------------------------ |
| Returning a multi-MB JSON blob                         | `tauri::ipc::Response` returning `Vec<u8>`       |
| Streaming progress (downloads, LLM tokens, file reads) | `Channel<T>` (see `tauri-events`)                |
| UI thread jank during stringify of large state         | Split into smaller commands or move work to Rust |
| Uploading binary data                                  | `Uint8Array`/`ArrayBuffer` arg to `invoke()`     |
| Fire-and-forget notifications                          | Events, not commands                             |
| Very chatty back-and-forth                             | Batch into one command, or open a `Channel<T>`   |

## Raw IPC ceiling

Even raw IPC has a ceiling: it's still a serialized OS message. For truly high-throughput data
(mmap-style scenarios, shared video frames), Tauri is not the right transport — drop down to a
sidecar with a Unix socket / named pipe (see `tauri-sidecar`) and only use `invoke()` for
control-plane messages.

## Security note

Every `invoke()` payload passes through the Core's IPC router, where capability ACLs decide whether
the command is allowed for that webview/window. The bridge itself is not the security boundary — the
ACL layer is. See `tauri-security`. If you want to interpose on payloads (sanitize, log, reject)
**inside** the WebView before they cross to Core, that's what the Isolation pattern is for — see
`tauri-architecture-isolation-pattern`.

## Debugging the bridge

- `RUST_LOG=tauri=trace` logs every IPC message Core receives, including command name and
  (truncated) payload.
- In DevTools, `window.__TAURI_INTERNALS__` is inspectable — you can patch `invoke` for
  instrumentation in dev.
- Set a breakpoint inside any `#[tauri::command]` to confirm the dispatch arrived; if it didn't, the
  ACL likely rejected it.

## See also

- `tauri-architecture` — the big-picture process model
- `tauri-commands` — authoring `#[tauri::command]` handlers
- `tauri-events` — `emit`/`listen`/`Channel<T>` for Rust→JS pushing
- `tauri-architecture-isolation-pattern` — interposing on the bridge before Core
- `tauri-security` — ACLs that gate which commands a WebView can call

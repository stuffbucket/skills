---
name: tauri-architecture
description: Use when reasoning about Tauri v2 internals — process boundaries (Core vs WebView), the IPC channel, binary-size tradeoffs, or deciding between commands/events/raw IPC for a given feature.
---

# Tauri v2 Architecture

Tauri is a polyglot toolkit: a Rust-compiled binary (Core) drives one or more OS-provided WebViews
(WKWebView on macOS, WebView2 on Windows, webkitgtk on Linux). WebView runtimes are **dynamically
linked at runtime**, not bundled — that's why Tauri apps ship small but you must mind platform
webview differences.

## The two processes

Tauri uses multi-process architecture (like browsers/Electron) so a crashing/compromised WebView
can't take down the app or the OS.

```text
            +------------------------+
            |  Core process (Rust)   |
            |  - one per app         |
            |  - OS access           |
            |  - global state        |
            |  - IPC router          |
            +-----------+------------+
                        |
        +---------------+---------------+
        |               |               |
   +----v----+     +----v----+     +----v----+
   | WebView |     | WebView |     | WebView |
   | (window |     | (window |     | (tray   |
   |   1)    |     |   2)    |     | popup)  |
   +---------+     +---------+     +---------+
   HTML/CSS/JS    HTML/CSS/JS     HTML/CSS/JS
   no OS access  no OS access    no OS access
```

- **Core** (Rust, single): app entry point, the **only** component with full OS access. Owns
  windows, tray, notifications, updater, and global state (settings, DB pools). All IPC routes
  through Core, so you have one chokepoint to filter/intercept/audit messages.
- **WebView** (one per window): renders UI. Treat it as untrusted-ish — sanitize input, never hold
  secrets here, push business logic to Core. Principle of least privilege.

## IPC mechanisms

Tauri uses **asynchronous message passing** (JSON-RPC-ish under the hood). Two primitives:

### `invoke()` — Commands (request/response)

Frontend calls a Rust function, awaits a serializable return. Use for anything that needs a result,
error handling, or capability-gated OS access.

```ts
import { invoke } from '@tauri-apps/api/core';
const usage = await invoke<UsageStats>('get_usage', { since: '2025-01-01' });
```

```rust
#[tauri::command]
fn get_usage(since: String) -> Result<UsageStats, String> { /* ... */ }
```

All args/returns must be JSON-serializable. Commands are gated by the capability/ACL system.

### `emit` / `listen` — Events (fire-and-forget, bidirectional)

Either side can broadcast; no response. Use for lifecycle/state-change notifications (e.g.
"auth-token-refreshed", "sidecar-ready", progress streams).

```ts
import { emit, listen } from '@tauri-apps/api/event';
const unlisten = await listen<Token>('token-refreshed', (e) => update(e.payload));
await emit('user-action', { kind: 'logout' });
```

```rust
app.emit("token-refreshed", &token)?;
```

### Raw IPC

`window.__TAURI_INTERNALS__.postMessage` is the low-level transport. Don't touch it directly except
inside the **Isolation pattern's** `__TAURI_ISOLATION_HOOK__`.

## Isolation pattern

A sandboxed `<iframe>` containing a small "isolation app" that intercepts every IPC message before
it reaches Core. Tauri encrypts the validated message with a runtime-generated AES-GCM key before
forwarding.

**Threat model:** *Development Threats* — supply-chain compromise of frontend deps (deeply-nested
npm graphs). Even if a malicious dep injects JS to call `invoke('write_file', { path: '/etc/passwd'
})`, the isolation hook can reject it.

**Enable** in `tauri.conf.json`:

```json
{
  "app": {
    "security": {
      "pattern": {
        "use": "isolation",
        "options": { "dir": "../dist-isolation" }
      }
    }
  }
}
```

Hook signature (runs sandboxed):

```js
window.__TAURI_ISOLATION_HOOK__ = (payload) => {
  // validate / reject / mutate; return the (modified) payload
  if (payload.cmd === 'write_file' && !payload.path.startsWith(APP_DIR)) {
    throw new Error('path outside app dir');
  }
  return payload;
};
```

Keep the isolation app **dependency-free** — its whole point is to be a trusted minimal layer.
Limitation: ES Modules don't load inside the sandboxed iframe on Windows; rely on inlined `<script
src>` tags (Tauri inlines them at build time).

## Brownfield pattern

The **default** pattern — no config needed. Tauri behaves like a regular browser, so an existing
webapp drops in with minimal change. Choose this when integrating Tauri into a mature web frontend.
No isolation guarantees; trust your dep tree. Explicit form:

```json
{ "app": { "security": { "pattern": { "use": "brownfield" } } } }
```

## Size optimization

Tauri binaries are already small (no bundled runtime), but the Cargo release profile is the biggest
lever:

```toml
# src-tauri/Cargo.toml
[profile.dev]
incremental = true

[profile.release]
codegen-units = 1   # better LLVM optimization (slower compile)
lto = true          # link-time optimization
opt-level = "s"     # optimize for size; "z" is smaller still, "3" for speed
panic = "abort"     # drop unwinding tables
strip = true        # drop debug symbols
```

Additional levers:

- **`build.removeUnusedCommands: true`** in `tauri.conf.json` (Tauri 2.4+) — strips commands not
  listed in any capability/ACL. Pair with explicit ACLs (no `defaults`) for max benefit. Note:
  dynamic-ACL apps must validate this works for them.
- **Feature flags** — disable unused `tauri` crate features; only enable plugins you ship.
- **Frontend tree-shaking** — standard Vite/Rollup hygiene; the WebView ships your JS as-is.
- **Nightly extras** — `trim-paths = "all"` (strips build paths from binaries), `-Cdebuginfo=0`.

See [size.mdx](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/concept/size.mdx)
for the full reference.

## Decision matrix

| I need to...                                                 | Use                                                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Call a Rust function from JS and await a result              | **Command** (`invoke`)                                                                            |
| Read/write OS resources (fs, network, shell)                 | **Command** (gated by ACL)                                                                        |
| Broadcast "something happened" to all windows                | **Event** (`emit` from Core)                                                                      |
| Stream progress updates from a long-running Rust task        | **Event** (emit repeatedly) or [Channel](https://v2.tauri.app/develop/calling-frontend/#channels) |
| React in Rust to a frontend lifecycle moment (logout, route) | **Event** (`listen` in Core)                                                                      |
| Defend against supply-chain attacks in frontend deps         | **Isolation pattern**                                                                             |
| Wrap an existing webapp with minimal changes                 | **Brownfield pattern** (default)                                                                  |
| Share state between windows                                  | Core-owned state + Events/Commands                                                                |
| Synchronous call from JS                                     | Not supported — IPC is async                                                                      |
| Manipulate the raw IPC envelope                              | Isolation hook, never directly                                                                    |

## Gotchas

- All IPC payloads round-trip through JSON. Binary blobs → base64 or use Tauri's
  [`Channel`](https://v2.tauri.app/develop/calling-frontend/#channels) (binary-friendly, v2-only).
- The WebView runtime version varies per OS/user. Don't assume bleeding-edge browser features
  without polyfills.
- Secrets in Core only. The frontend bundle is trivially extractable from the `.app`/`.exe`.
- One Core, many WebViews — global state belongs in Core (Rust `tauri::State`), not in any single
  window.

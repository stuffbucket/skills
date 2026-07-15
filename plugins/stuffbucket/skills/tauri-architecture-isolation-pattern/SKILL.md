---
name: tauri-architecture-isolation-pattern
description: Use when enabling Tauri v2's Isolation pattern — configuring `app.security.pattern:{ use:"isolation", options:{ dir } }`, authoring the sandboxed iframe app with `__TAURI_ISOLATION_HOOK__`, understanding the AES-GCM rewriting of IPC payloads, what XSS-class attacks it mitigates (and what Core-side bugs it does not), the one-isolation-app-per-Tauri-app constraint, and the Windows ESM-in-sandboxed-iframe caveat.
---

# Tauri v2 Isolation Pattern

The Isolation pattern interposes a sandboxed iframe between your frontend and the Core IPC channel.
Every `invoke()` payload from the main frontend is routed through that sandbox, given to a hook
function you control (`__TAURI_ISOLATION_HOOK__`), then AES-GCM encrypted with a per-launch key
before Core sees it. If a compromised dependency in your main frontend tries to make a malicious
`invoke()`, your hook gets first look and can sanitize, log, or reject.

It's the default-on recommendation for any app whose frontend has third-party dependencies — which
is essentially every app.

## When to use

Tauri's own guidance: **use it always**. The runtime cost is negligible (AES-GCM is fast, payloads
are small) and the threat model — a compromised npm dependency calling `invoke('write_file', { path:
'/etc/passwd' })` from inside your bundle — is real for any non-trivial frontend.

Skip only if:

- You ship a fully air-gapped frontend with zero third-party JS, or
- You're prototyping and don't yet have a sensible hook to install.

## What it mitigates

| Threat                                                     | Isolation helps?                         |
| ---------------------------------------------------------- | ---------------------------------------- |
| Compromised npm dep emitting `invoke()` calls              | Yes — hook sees and can reject           |
| XSS injection into your frontend running `invoke()`        | Yes — same path                          |
| Frontend logging sensitive args to a third-party endpoint  | No — that's a CSP concern                |
| Bug in a `#[tauri::command]` itself (path traversal, etc.) | **No** — Core-side bugs are not in scope |
| Stolen Tauri config / signing keys                         | No                                       |
| Malicious code in the isolation app itself                 | No — keep it minimal                     |

The hook is a sanitization point at the edge of the WebView, before Core. It is not a substitute for
ACLs (`tauri-security`) or for writing safe commands. Defense in depth.

## How it works

1. Frontend calls `invoke('cmd', args)`.
2. Tauri's injected bridge does not post directly to Core. Instead it posts to an invisible
   sandboxed iframe (`sandbox=""`, no `allow-same-origin`) loaded from your isolation app directory.
3. Inside the iframe, Tauri calls your `window.__TAURI_ISOLATION_HOOK__(payload)`. You return the
   (possibly modified) payload, or throw to reject.
4. Tauri encrypts the returned payload with AES-GCM using a key generated at app launch and shared
   with Core out-of-band.
5. Encrypted payload posts to Core, which decrypts and dispatches.

The encryption is what prevents an attacker in the main frontend from bypassing the iframe — they
can't fabricate a valid ciphertext without the key, and the key only lives in the sandboxed iframe
and in Core.

## Setup

### 1. Configure the pattern

Edit `src-tauri/tauri.conf.json`:

```json
{
  "build": {
    "frontendDist": "../dist"
  },
  "app": {
    "security": {
      "pattern": {
        "use": "isolation",
        "options": {
          "dir": "../dist-isolation"
        }
      }
    }
  }
}
```

`dir` is relative to `src-tauri/` and points at a built isolation app. It must contain at minimum an
`index.html`.

### 2. Author the isolation app

Two files. See `templates/isolation/index.html` and `templates/isolation/index.js` in this skill.

The hook signature:

```js
window.__TAURI_ISOLATION_HOOK__ = (payload) => {
  // payload is { cmd, callback, error, ...args }
  // Return the payload (possibly modified) to forward.
  // Throw to reject the call.
  return payload;
};
```

Useful patterns:

```js
// Reject a command outright
if (payload.cmd === 'delete_everything') throw new Error('blocked');

// Whitelist file paths
if (payload.cmd === 'read_file' && !payload.path?.startsWith('/Users/me/safe/')) {
  throw new Error('path not allowed');
}

// Log to a local-only sink
console.log('[isolation]', payload.cmd);
```

The hook may be async (return a Promise of the payload).

### 3. Build the isolation app

Keep it brutally simple. The Tauri docs are explicit: **minimal dependencies, minimal build steps**.
If your isolation app has a 500-dep build chain, you've reintroduced the supply-chain risk you were
trying to defend against.

Recommended:

- No bundler. Plain `index.html` + `index.js`.
- No npm dependencies. Hand-write the hook.
- One file each, both checked into source control.

A single `cp -r src-isolation/ dist-isolation/` in your build script is enough.

## Constraints and gotchas

### One isolation app per Tauri app

You can configure exactly one `dir`. All `invoke()` calls from all windows/webviews route through
that single sandboxed iframe. There's no per-window isolation app.

### Windows: no ES Modules in the sandbox

Windows' sandboxed iframes can't load external module scripts. Tauri inlines `<script src="...">`
tags at build time as a workaround, but **`<script type="module">` and ESM `import` statements won't
work** inside the isolation app. Stick to classic scripts and traditional `<script
src="index.js"></script>` tags.

If you need to split code, concatenate at build time, not load at runtime.

### Performance

AES-GCM encryption per `invoke()` is fast — usually well under a millisecond per call for typical
payloads. Key generation runs once at launch. For most apps this is undetectable. If you're already
at the ~1k calls/sec bridge ceiling (see `tauri-architecture-ipc-internals`), the isolation overhead
becomes a measurable fraction; consider batching or `Channel<T>` instead.

### The hook is the trust boundary

If an attacker can modify the isolation app's source on disk, isolation is bypassed. Code-sign and
notarize the bundle (`tauri-bundling`) — that's what protects the isolation app at rest.

## Switching back to brownfield

The default (no pattern config, or `"use": "brownfield"`) routes IPC straight to Core with no
interposition. Useful for prototypes, never for production.

## See also

- `tauri-architecture-ipc-internals` — what the hook is intercepting
- `tauri-security` — ACLs (the orthogonal, complementary defense)
- `tauri-bundling` — code-signing the bundle so the isolation app can't be tampered with
- `tauri-setup` — initial config files this pattern edits

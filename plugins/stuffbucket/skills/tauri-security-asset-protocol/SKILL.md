---
name: tauri-security-asset-protocol
description: Use when serving local files into a Tauri v2 WebView — enabling `app.security.assetProtocol`, scoping which paths it exposes, using `convertFileSrc` to produce `asset://` / `https://asset.localhost` URLs, the matching CSP `img-src`/`media-src` directives, persisting user-picked paths with `tauri-plugin-persisted-scope` (`protocol-asset` feature), and choosing the asset protocol over base64-via-command for performance.
---

# Tauri v2 Asset Protocol

The asset protocol is a custom URI scheme that streams local files directly into the WebView,
bypassing the JSON IPC. It's the right way to display user-selected images, video, audio, or any
file the page would otherwise have to receive as base64 over an `invoke()`. It's also the most
common source of "image just won't render" bugs because it has four moving parts that must all
agree: config flag, scope, CSP, and the JS `convertFileSrc` call.

## What it is and why it exists

A WebView cannot load `file://` URLs from a `tauri://` (or `https://tauri.localhost`) page —
cross-origin block. The asset protocol is a Tauri-registered scheme that:

- macOS/Linux: serves files at `asset://localhost/<percent-encoded-absolute-path>`
- Windows: serves files at `https://asset.localhost/<percent-encoded-absolute-path>` (WebView2 has
  no custom-scheme support, so Tauri uses an HTTPS subdomain handled by the loopback)

Underneath, the Rust side streams bytes with proper `Content-Type` and `Range` support (so `<video>`
seeking works). No JSON encoding, no double-base64, no IPC saturation.

## Enable it

```jsonc
// tauri.conf.json
{
  "app": {
    "security": {
      "assetProtocol": {
        "enable": true,
        "scope": {
          "allow": ["$APPDATA/images/**", "$RESOURCE/**"],
          "deny":  ["$APPDATA/images/.private/**"]
        }
      }
    }
  }
}
```

`enable: true` is the master switch. With it off, every asset URL 404s regardless of scope. The
`scope` works like FS scope: same placeholders (`$APPDATA`, `$HOME`, `$RESOURCE`, `$DOCUMENT`, …),
same glob crate (same `require_literal_leading_dot` trap on Unix), same deny-wins rule. The scope is
enforced against the canonical (symlink-resolved) absolute path.

Unlike FS scope, the asset protocol scope is **app-wide**, not per-capability. It applies to every
webview equally. If you need per-window restrictions, use FS commands and stream bytes via a
`Channel<T>` instead.

## CSP

You must allow the protocol in `img-src` and `media-src` (and `connect-src` if you `fetch()` it):

```text
img-src   'self' asset: https://asset.localhost;
media-src 'self' asset: https://asset.localhost;
```

When `dangerousDisableAssetCspModification` is `false` (default), Tauri injects these tokens for
you. If you've disabled modification, they're your responsibility — forgetting them produces the
classic "asset enabled, scope correct, image blank" symptom.

## Calling it from JS

```ts
import { convertFileSrc } from '@tauri-apps/api/core';

const src = convertFileSrc('/Users/me/Pictures/dog.jpg');
// macOS/Linux: asset://localhost/%2FUsers%2Fme%2FPictures%2Fdog.jpg
// Windows:     https://asset.localhost/%2FUsers%2Fme%2FPictures%2Fdog.jpg

img.src = src;
```

`convertFileSrc(path, protocol?)` defaults to `'asset'`. The path must be **absolute** — relative
paths produce URLs that resolve relative to the current page and silently 404. Use a Rust command or
`path` plugin to get an absolute path before converting.

See `templates/load-image.ts`.

## The absolute-path-glob trap

Users typically pick paths via `dialog.open()`, which returns OS-canonical absolute paths. Three
pitfalls:

1. **macOS `/var` is `/private/var`**. A scope like `"/var/folders/**"` won't match because dialog
   returns `/private/var/folders/…`. Use `$TEMP` or pre-canonicalize.
2. **Windows uses backslashes in some APIs**. The asset protocol normalizes to forward slashes
   internally; write your globs with `/`.
3. **Dotfiles**. `$HOME/**` doesn't match `$HOME/.config/foo.png` — add `$HOME/.*/**` explicitly.

## Persisting user-picked paths

If your app lets users pick a folder once and read it forever after, you need
`tauri-plugin-persisted-scope` with the `protocol-asset` feature, because the dialog-granted scope
evaporates at process exit:

```toml
# Cargo.toml
tauri-plugin-persisted-scope = { version = "2", features = ["protocol-asset"] }
```

```rust
// lib.rs
.plugin(tauri_plugin_persisted_scope::init())
```

The plugin serializes the runtime scope additions (paths granted via `dialog.open()` etc.) and
restores them on next launch. Without `protocol-asset`, it persists FS scope only, not the asset
protocol's scope. With the feature, any path the user permits stays permitted across launches.

Capability:

```json
{ "identifier": "persisted-scope:default" }
```

## When to use commands instead

The asset protocol wins for:

- Static or user-picked media in `<img>`, `<video>`, `<audio>` (range requests, no JSON cost),
- Large files (gigabyte-class video) where base64 over IPC would OOM,
- Streaming reads where the browser handles buffering.

Prefer a command (or `Channel<T>`) when:

- You need to transform bytes (resize, thumbnail) before display — do it in Rust and serve the
  result, or return a `Vec<u8>` via a binary command,
- You need per-call authorization beyond a scope glob (e.g. check a database before granting),
- You're loading a small one-shot (< 100 KB) and a JSON round-trip is simpler than wiring CSP/scope.

A common hybrid: command returns the validated path string, JS calls `convertFileSrc` on it, asset
protocol streams the bytes.

## Disabling for production

If your app has no need for local file rendering, leave `enable: false`. Every shipped surface area
is a future CVE.

## Templates

- `templates/asset-protocol-config.json` — `tauri.conf.json` fragment with enable, scope (typical
  app patterns), and matching CSP `img-src`/`media-src`.
- `templates/load-image.ts` — minimal JS: pick a path via dialog, convert, render.

## Debugging

- **Image blank, no console error**: CSP `img-src` is missing `asset:` / `https://asset.localhost`.
  Open devtools network tab — the request will show `(blocked:csp)`.
- **404 from `asset://`**: scope mismatch. Log the canonical path on the Rust side
  (`std::fs::canonicalize`) and compare to your glob.
- **Works on macOS, fails on Windows**: you wrote `asset://localhost/...` literally instead of using
  `convertFileSrc`. WebView2 needs `https://asset.localhost`. Always convert.
- **Works in dev, fails in packaged app**: `$RESOURCE` paths differ — bundled resources have a
  different absolute path than the dev copy. Verify with a debug log of the path before
  `convertFileSrc`.
- **Persisted scope not restoring**: the `protocol-asset` cargo feature isn't enabled, or the plugin
  isn't registered before the user-grant happens.

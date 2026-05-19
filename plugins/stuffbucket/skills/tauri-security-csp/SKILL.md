---
name: tauri-security-csp
description: Use when setting a Content-Security-Policy in a Tauri v2 app — configuring `app.security.csp` and `app.security.devCsp`, the Tauri-specific directives (`ipc:`, `http://ipc.localhost`, `asset:`, `https://asset.localhost`, `'wasm-unsafe-eval'`), automatic hash injection for inline scripts/styles, when to lift `dangerousDisableAssetCspModification`, frame-ancestors, nonces, and the dev-vs-prod delta (Vite HMR `ws://`, broader `connect-src` in dev).
---

# Tauri v2 Content-Security-Policy

Tauri injects a CSP into every loaded HTML page by setting an HTTP header (custom protocol) and a
`<meta http-equiv>` tag (fallback). It is **opt-in but strongly recommended**: missing CSP allows
any XSS bug in your frontend to talk to anything reachable from the WebView. Tauri's command ACL
still protects Rust, but XSS could exfiltrate from a remote API your frontend uses, manipulate the
DOM into clicking trusted commands, etc.

## Two configs, one stack

```jsonc
// tauri.conf.json
{
  "app": {
    "security": {
      "csp":     "...prod policy...",
      "devCsp":  "...dev policy (looser)...",
      "dangerousDisableAssetCspModification": false,
      "freezePrototype": true
    }
  }
}
```

- `csp` — applied in production (`tauri build`) and as a baseline.
- `devCsp` — applied in `tauri dev` only. If omitted, `csp` is used in dev too. Use this to add
  Vite/HMR origins without weakening prod.
- `dangerousDisableAssetCspModification` — when `false` (default), Tauri **augments** your `csp` to
  include the directives it needs (see below). When `true`, your policy ships verbatim — you are
  responsible for every directive. Only set true if you fully understand the asset/IPC protocols.
- `freezePrototype` — locks `Object.prototype` etc. before user JS runs. Cheap defense-in-depth,
  leave on.

## Tauri-specific directives

Even a perfect web CSP will break Tauri without these:

| Directive                                             | Why                                                                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `connect-src 'self' ipc: http://ipc.localhost`        | `invoke()` posts to the `ipc:` protocol on macOS/Linux and `http://ipc.localhost` on Windows. Both must be allowed or every command call gets blocked. |
| `img-src 'self' asset: https://asset.localhost`       | `convertFileSrc(path)` produces `asset://localhost/...` (macOS/Linux) or `https://asset.localhost/...` (Windows).                                      |
| `media-src 'self' asset: https://asset.localhost`     | same for `<video>`/`<audio>`.                                                                                                                          |
| `script-src 'self' 'wasm-unsafe-eval'`                | needed if any of your deps (Yew, wasm-bindgen, some bundlers) use `WebAssembly.compile`. Omit if you have no wasm.                                     |
| `style-src 'self' 'unsafe-inline'` *(only if needed)* | many UI frameworks inject style tags at runtime. Prefer hash auto-injection (below) over `'unsafe-inline'`.                                            |

When `dangerousDisableAssetCspModification: false`, Tauri injects the `ipc:`, `asset:`, and
`https://*.localhost` parts of `connect-src`/`img-src`/`media-src` automatically. You still write
the rest.

## Hash auto-injection

If your bundler emits inline `<script>` or `<style>` tags, you'd normally need either
`'unsafe-inline'` (XSS hole) or SHA-256 hashes in your CSP. Tauri computes the hashes for every
inline script/style in the bundled `index.html` at build time and injects them into the CSP
automatically. You write:

```text
script-src 'self'
```

and Tauri emits:

```text
script-src 'self' 'sha256-abc...=' 'sha256-def...='
```

For this to work the script/style must be **statically present** in the bundled HTML —
runtime-injected tags still need a different strategy (use nonces, see below). Disabled when
`dangerousDisableAssetCspModification: true`.

## Nonces

Tauri does **not** auto-generate nonces (they need server-side per-request randomness, and Tauri's
custom protocol returns static bundles). If you need a nonce for a runtime-injected script (e.g. an
analytics tag you splice in after load), you'll have to:

1. Disable CSP modification.
2. Generate a nonce in Rust, inject it into HTML via a custom asset transformer, return that policy
   in `csp_response`.

This is rare. Most apps just hash-allow the small set of inline scripts at build time.

## `frame-ancestors`

By default Tauri pages can be embedded as an iframe by any page loaded into another Tauri webview.
To prevent that:

```text
frame-ancestors 'self'
```

If you use the **isolation pattern**, this directive must also allow the isolation app's origin
(`http://isolation.localhost` or the configured dir) — Tauri handles this automatically when
`dangerousDisableAssetCspModification` is false.

## Dev vs prod

In `tauri dev` with Vite, you need:

- `connect-src` to include `ws://localhost:<port>` (HMR socket),
- `script-src` to include `'unsafe-eval'` if your dev bundle uses `eval()` (most don't anymore, but
  some HMR runtimes do),
- `style-src` to include `'unsafe-inline'` (Vite injects inline styles for HMR).

Put these only in `devCsp`. Production should stay strict. See `templates/csp-dev.json`.

## Red flags

- **`'unsafe-inline'` in `script-src` for prod** — defeats CSP's XSS protection. Use hash injection.
- **`'unsafe-eval'` in prod** — only if a hard dep needs it; document why.
- **`default-src *`** — defeats the policy.
- **`dangerousDisableAssetCspModification: true` without a matching audited policy** — every release
  has to re-verify the `ipc:`/`asset:` allowances are present.
- **Wildcard remote hosts** (`https://*`) — narrow to known API origins.

## Reporting

Tauri respects `report-uri` and `report-to`. With a custom command endpoint you can sink violations
to disk for triage:

```text
report-uri tauri://csp-violation
```

…and register a custom URI scheme handler that logs the JSON report.

## Templates

- `templates/csp-strict.json` — production-grade CSP fragment, Tauri-aware, hash injection assumed,
  no `unsafe-*`.
- `templates/csp-dev.json` — dev CSP with Vite HMR origins added.

## Debugging

- Open devtools → Console for `Refused to ... because it violates the Content Security Policy
  directive ...` — the directive name tells you which family.
- A blank window with `Refused to connect to 'ipc://localhost'` → `connect-src` lost the `ipc:`
  allowance, usually because `dangerousDisableAssetCspModification` was flipped.
- Image not loading from `convertFileSrc` → `img-src` missing `asset:` (mac/linux) or
  `https://asset.localhost` (Windows).

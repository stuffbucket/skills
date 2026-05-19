---
name: tauri-plugins-http
description: Use when making HTTP requests from a Tauri v2 frontend — `fetch()` from `@tauri-apps/plugin-http`, the URL-pattern + method allowlist scope, why this exists (CORS bypass, no preflight, custom headers, proxy support), streaming responses, the `http:default` and per-method permissions, and when to use it instead of browser `fetch`.
---

# Tauri v2: HTTP Plugin

A `fetch()` that runs in the **Core (Rust) process** instead of the WebView. Same API shape as the
browser's Fetch, but:

- No CORS — your desktop app is not a website.
- No preflight, no opaque responses, no `mode: 'no-cors'` weirdness.
- Forbidden headers (`Cookie`, `Origin`, `User-Agent`, etc.) are settable.
- Proxy and TLS knobs (via the underlying `reqwest`).

Use it whenever the response source isn't your own dev server.

## Install

```sh
npm run tauri add http
```

Manual: `tauri-plugin-http = "2"` in Cargo, `@tauri-apps/plugin-http` in npm,
`.plugin(tauri_plugin_http::init())` in the builder.

## JS API — same shape as Web Fetch

```ts
import { fetch } from '@tauri-apps/plugin-http';

const res = await fetch('https://api.example.com/v1/things', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    // Forbidden in browsers, allowed here:
    'User-Agent': 'MyApp/1.0',
  },
  body: JSON.stringify({ name: 'thing' }),
  // Plugin-specific extras:
  connectTimeout: 30_000,
  maxRedirections: 5,
  // proxy: { all: 'http://localhost:8080' },
});

if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
const data = await res.json();
```

Streaming responses work the same way browsers do — `res.body` is a `ReadableStream`.

```ts
const res = await fetch('https://example.com/big.bin');
const reader = res.body!.getReader();
for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  process(value); // Uint8Array chunk
}
```

## Critical: pick this over browser `fetch` when

| Case                                   | Use                                                              |
| -------------------------------------- | ---------------------------------------------------------------- |
| Calling your own bundled dev server    | browser `fetch` (zero-cost)                                      |
| Third-party API that does CORS         | plugin `fetch` (faster, no preflight)                            |
| Need a `Cookie` or `User-Agent` header | plugin `fetch` (browser blocks them)                             |
| Need a proxy                           | plugin `fetch`                                                   |
| Need to bypass cert validation in dev  | plugin `fetch` with `danger-accept-invalid-certs` (Rust feature) |
| Streaming large download               | either, plugin is fine                                           |

The plugin re-exports `reqwest` on the Rust side — if you'd rather do the request from a
`#[tauri::command]`, just `use tauri_plugin_http::reqwest;` and `reqwest::Client::new().get(...)`.

## Scope

Capability filters by URL **and** HTTP method. Both have to match.

```json
{
  "identifier": "http:default",
  "allow": [
    { "url": "https://api.example.com/**" },
    { "url": "https://*.githubusercontent.com/**" }
  ],
  "deny":  [{ "url": "https://api.example.com/admin/**" }]
}
```

URL pattern grammar:

- Scheme is matched exactly (`https://` ≠ `http://`).
- Host: `*` = one label, `**` = unused; the `*.host` form is most common.
- Path: `**` = any tail.

Method scoping is per-permission identifier:

| Identifier         | Methods                                                  |
| ------------------ | -------------------------------------------------------- |
| `http:default`     | Reasonable safe set (GET, HEAD, others) per current docs |
| `http:allow-fetch` | All methods, gated only by URL allow/deny                |

For a finer cut, configure on the URL entry — newer schema variants support `methods:
["GET","POST"]` on a per-URL basis. Prefer narrower over broader: `http:default` with a specific
`allow` list beats `http:allow-fetch` with a wide one.

## Rust side

Re-exports `reqwest`. Use it for backend-only requests (no JS scope check applies since you're
already in Core):

```rust
use tauri_plugin_http::reqwest;

#[tauri::command]
async fn fetch_status() -> Result<u16, String> {
    let res = reqwest::Client::new()
        .get("https://api.example.com/v1/status")
        .header("user-agent", "MyApp/1.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    Ok(res.status().as_u16())
}
```

## `unsafe-headers` feature

Some headers (`Origin`, `Cookie`, `Set-Cookie`) are gated by default. Opt in with the
`unsafe-headers` Cargo feature:

```toml
tauri-plugin-http = { version = "2", features = ["unsafe-headers"] }
```

Only do this if you genuinely need it; the gate is there to discourage accidentally turning your
client into something that smells like a logged-in browser session against APIs it shouldn't.

## Diagnosing "url not allowed"

1. Scheme mismatch (`http` vs `https`).
2. Host glob too narrow — `https://api.example.com` does not match `https://api.example.com/v1`
   unless you add the `/**` tail.
3. A `deny` rule wins. Check both this capability and any window-merged ones.
4. Method not granted at this identifier. Try `http:allow-fetch` to isolate.

## Templates

- `templates/setup.rs` — plugin init + a Rust-side `reqwest` command.
- `templates/usage.ts` — JS `fetch` with streaming and custom headers.
- `templates/capability.json` — narrow allow + deny + admin carve-out.

## Related

- `tauri-plugins` — install flow and decision matrix.
- `tauri-security-scopes` — URL pattern semantics, deny precedence.
- `tauri-commands` — for backend-side requests via `reqwest`.

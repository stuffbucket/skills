---
name: tauri-security
description: Use when configuring Tauri v2 access control — writing capability files, granting plugin permissions, scoping filesystem/shell/http access, debugging "not allowed" errors, or hardening CSP/asset protocol/http headers.
---

# Tauri v2 Security Model

Tauri v2 replaced v1's "allowlist" with a **capability + permission + scope** ACL enforced by a
runtime authority in Core. Every IPC call from the WebView is checked against this ACL before the
Rust command runs. If you see `command X not allowed by ACL`, `not allowed on window Y`, or `asset
protocol not configured to allow the path`, the cause is in this file.

## The model in one paragraph

**Plugins (and your app) declare _permissions_** — named privileges that enable specific commands
and/or apply specific scopes. **You bind permissions to windows/webviews** by writing
**_capability_** files in `src-tauri/capabilities/`. At runtime the **runtime authority** receives
every invoke, checks the calling window/webview is part of a capability that grants the requested
command, injects any applicable scope, then dispatches. No matching permission → denial; the Rust
command never runs.

Conceptual layering:

```text
plugin → permissions (commands.allow + scope) → permission sets
                                                   ↓
                                              capability file
                                                   ↓
                                          windows[] / webviews[] / remote.urls[]
                                                   ↓
                                            runtime authority
                                                   ↓
                                              #[tauri::command]
```

## Capability files

Live in `src-tauri/capabilities/*.{json,json5,toml}`. All files in the directory are auto-enabled,
unless `tauri.conf.json → app.security.capabilities` lists specific identifiers (then only listed
ones load). Reference a JSON Schema for IDE autocomplete:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Default permissions for the main window",
  "windows": ["main"],
  "webviews": [],
  "permissions": [
    "core:default",
    "core:window:allow-set-title"
  ],
  "platforms": ["macOS", "windows", "linux"]
}
```

Fields:

| Field         | Type      | Notes                                                                 |                                                              |
| ------------- | --------- | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| `identifier`  | string    | Unique per app. Used in error messages.                               |                                                              |
| `description` | string    | Human reason — show up in audits.                                     |                                                              |
| `windows`     | string[]  | Window **labels** (not titles). Globs allowed: `["*"]`, `["main-*"]`. |                                                              |
| `webviews`    | string[]  | Webview labels for multi-webview windows.                             |                                                              |
| `permissions` | (string \ | object)[]                                                             | Permission IDs and/or scoped permission objects (see below). |
| `platforms`   | string[]  | Subset of `linux`, `macOS`, `windows`, `iOS`, `android`.              |                                                              |
| `local`       | bool      | Default `true`. Applies to bundled frontend.                          |                                                              |
| `remote.urls` | string[]  | Origins (glob) allowed to invoke. Defaults to none — local-only.      |                                                              |

Schema variant: `desktop-schema.json`, `mobile-schema.json`, or `remote-schema.json` depending on
what the capability targets.

**Window labels, not titles.** The boundary key is the label passed to
`WebviewWindowBuilder::new(app, "main", ...)`. Two windows with different labels are different
security principals.

**Capabilities merge.** If a window appears in two capabilities, the effective permission set is the
union — and effective denials are the union. Easy to widen by accident.

## Permission identifiers

Format: `<plugin>:<permission-name>`.

- `core:event:default` — set of `core:event:allow-listen`, `allow-unlisten`, `allow-emit`,
  `allow-emit-to`.
- `core:default` — meta-set covering `core:app:default`, `core:event:default`, `core:image:default`,
  `core:menu:default`, `core:path:default`, `core:resources:default`, `core:tray:default`,
  `core:webview:default`, `core:window:default`.
- `fs:read-text-file` — single command enable, no scope.
- `fs:allow-read-text-file` — autogenerated per-command (one of two conventions; check plugin docs).
- `shell:allow-execute` — must combine with scope to be useful (see below).
- `<plugin>:default` — opinionated bundle the plugin author exposes; review what it actually grants.

Rules baked into the identifier syntax: ASCII `[a-z]`, separator `:`, prefix `tauri-plugin-` is
implicit, max length 116. `allow-*` and `deny-*` are conventional prefixes; `deny-*` always wins.

For application-defined permissions, use TOML in `src-tauri/permissions/<id>.toml` and reference
unprefixed (the app is its own namespace):

```toml
[[permission]]
identifier = "allow-write-app-data"
description = "Write under $APPDATA only."
commands.allow = ["write_app_data"]

[[permission.scope.allow]]
path = "$APPDATA/**/*"
```

Permission sets combine permissions:

```toml
[[set]]
identifier = "app-data-access"
description = "Read + write under $APPDATA."
permissions = ["fs:read-files", "fs:scope-appdata-recursive", "allow-write-app-data"]
```

## Scopes — narrowing a permission

A scope is plugin-specific data (any `serde`-deserialisable type) that the command reads at runtime.
The plugin enforces it; the ACL only injects it. Three flavors you will hit constantly:

**Filesystem** (`fs` plugin) — glob paths with base-directory variables (`$HOME`, `$APPDATA`,
`$APPCACHE`, `$RESOURCE`, `$DOCUMENT`, `$DOWNLOAD`, ...). `allow` and `deny`, deny wins.

```json
{
  "identifier": "fs:allow-read-text-file",
  "allow": [{ "path": "$APPDATA/**/*" }],
  "deny":  [{ "path": "$APPDATA/secrets/**" }]
}
```

**Shell** (`shell` plugin) — program path or sidecar marker, with argv shape constraints (literal
strings or regex validators):

```json
{
  "identifier": "shell:allow-execute",
  "allow": [
    {
      "name": "binaries/maximal",
      "sidecar": true,
      "args": ["start", "--port", { "validator": "^\\d{2,5}$" }]
    }
  ]
}
```

`args` matches positionally. A literal string requires that exact argument; an object with
`validator` matches a regex. Drop `args` to allow anything (rarely correct).

**HTTP** (`http` plugin) — URL globs:

```json
{
  "identifier": "http:default",
  "allow": [{ "url": "https://api.example.com/*" }]
}
```

Object form vs string form: a permission ID as a bare string uses the plugin's default scope (often
empty → unusable for `shell:allow-execute`). Use the object form `{ "identifier": ..., "allow":
[...] }` whenever you need to narrow.

### Unix dotfile gotcha

Glob `**` and `*` **do not** match path segments starting with `.` when `requireLiteralLeadingDot`
is true (the Unix default). `$HOME/**/*` won't reach `~/.config/foo`. Either name the segment
literally (`$HOME/.config/**/*`) or set the object-form scope flag:

```json
"scope": { "requireLiteralLeadingDot": false, "allow": ["$HOME/**/*"] }
```

## The default capability

`tauri init` ships `src-tauri/capabilities/default.json` with broad `core:default`. Review before
release:

1. Tighten `windows` from `["main"]` to the actual label set.
2. Drop `core:default` if you don't need its bundle; pick specific `core:app:*`, `core:event:*`,
   etc.
3. Remove any plugin defaults you don't actually call.
4. Split desktop vs mobile (`platforms`) so mobile-only plugin permissions don't bloat the desktop
   schema.

See `templates/capabilities-default.json` for a hardened starting point and
`templates/capabilities-fs-scoped.json` for FS-restricted-to-one-dir.

## CSP

Configured under `app.security.csp` in `tauri.conf.json`. Tauri appends nonces for bundled scripts
and hashes for inline ones at build time, so you only declare app-level rules:

```json
{
  "app": {
    "security": {
      "csp": {
        "default-src": "'self' customprotocol: asset:",
        "connect-src": "ipc: http://ipc.localhost",
        "img-src":     "'self' asset: http://asset.localhost blob: data:",
        "style-src":   "'unsafe-inline' 'self'",
        "font-src":    "'self' https://fonts.gstatic.com"
      }
    }
  }
}
```

Notes:

- Include `'wasm-unsafe-eval'` in `script-src` for Rust/WASM frontends.
- `ipc: http://ipc.localhost` in `connect-src` is required for IPC under v2.
- `asset:` + `http://asset.localhost` only needed if you use `convertFileSrc()`.
- `app.security.dangerousDisableAssetCspModification` exists as an escape hatch — set to `true` only
  when you supply your own complete `script-src`/`style-src` and accept Tauri will not inject its
  nonces. Almost always wrong.

## Asset protocol

Lets the WebView load disk files via `asset:` (use `convertFileSrc(path)` in JS). Off by default:

```json
{
  "app": {
    "security": {
      "assetProtocol": {
        "enable": true,
        "scope": {
          "allow": ["$APPCACHE/**/*", "$RESOURCE/**/*"],
          "deny":  ["$APPCACHE/**/secrets/**"]
        }
      }
    }
  }
}
```

- Array form `"scope": ["$APPCACHE/**/*"]` works but cannot set `requireLiteralLeadingDot`.
- Resolved paths are absolute; `["*/**"]` won't match `/home/...`. Use `$HOME/**/*` or a literal
  `/Users/...`.
- For paths chosen at runtime (file-picker output) that must survive a restart, install
  `tauri-plugin-persisted-scope` with `features = ["protocol-asset"]`. Register `tauri_plugin_fs`
  **before** it.

## HTTP headers

Configured under `app.security.headers` (Tauri ≥ 2.1). Limited to a whitelist: COOP, COEP, CORP,
CORS-* (Allow-Credentials/Headers/Methods/Expose-Headers/Max-Age), Permissions-Policy,
Service-Worker-Allowed, Timing-Allow-Origin, X-Content-Type-Options, `Tauri-Custom-Header`. CSP is
**not** set here.

```json
"headers": {
  "Cross-Origin-Opener-Policy":   "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "X-Content-Type-Options":       "nosniff"
}
```

Value rules: string → as-is; string[] → joined by `,`; object → `key value; key value` pairs; `null`
→ header omitted. Dev servers (Vite/Next/etc.) don't see these — duplicate them in the dev server
config if you need them during `tauri dev`.

## Runtime authority — what it actually does

Lives in Tauri Core. For every IPC `invoke`:

1. Resolve origin → window label + (optional) webview label + (optional) remote origin.
2. Look up matching capabilities for that origin set.
3. Union the permission set across matches; reject if requested command isn't enabled.
4. Collect all scope entries attached to matching permissions; pass them to the command.
5. Dispatch the `#[tauri::command]`. The command reads scope from injected state and enforces it
   itself (e.g., the `fs` plugin walks its `FsScope` before opening a path).

What it doesn't protect against: malicious Rust, scope-bypass bugs in command implementations,
WebView 0-days, supply-chain compromise. ACL is the perimeter, not the only line.

## Debugging denials

Common error shapes:

- `"X not allowed on Y"` / `"command 'plugin|command' not allowed by ACL"` — capability lookup
  failed. Check window label spelling, that the capability file's `windows[]` matches, and that the
  permission ID is in `permissions[]`.
- `"path not allowed by the scope"` — permission was granted but the FS scope didn't include the
  resolved path. Print the exact path in Rust; compare against globs; remember dotfile rule.
- `"asset protocol not configured to allow the path"` — `app.security.assetProtocol.scope` did not
  match. Same path-vs-glob trap.
- `"shell: program not allowed"` — `shell:allow-execute` is a bare string instead of the object
  form, or `name`/`sidecar` doesn't match the call.

Where to look:

1. **DevTools console (frontend).** Tauri surfaces ACL denials with the offending command and
   capability.
2. **Rust log** with `RUST_LOG=tauri=debug tauri dev` — shows the matched capability and missing
   permission.
3. **`src-tauri/gen/schemas/acl-manifests.json`** (generated each build). Lists every permission
   your plugin set defined — search for the ID to confirm spelling.
4. **`bun run tauri permission ls`** / `tauri permission` CLI — inspects what's resolved for the
   current project.

Iteration loop: edit capability → rebuild (`cargo tauri dev` watches; for fast UI work you don't
need a full sidecar rebuild) → retry the failing call → repeat. The ACL is fully static, so denials
reproduce immediately.

## Hardening checklist (pre-release)

- [ ] Every capability has a narrow `windows[]` list — no `["*"]` unless intentional.
- [ ] No `core:default` if you only need a subset.
- [ ] `shell:allow-execute` uses the object form with `args` validators.
- [ ] `fs:*` permissions are paired with a scope object (path globs), not the bare string.
- [ ] `assetProtocol.enable` is `false` unless `convertFileSrc()` is actually used.
- [ ] CSP `default-src` does not include `*`; `script-src` has no `'unsafe-inline'`.
- [ ] `dangerousDisableAssetCspModification` is absent or `false`.
- [ ] `remote.urls` is empty unless you serve the frontend remotely; if present, origins are exact
  (no `https://*`).
- [ ] `platforms[]` is set so mobile-only permissions don't compile into desktop builds.
- [ ] A grep for `tauri-plugin-` in `Cargo.toml` matches the plugin defaults you actually grant.

## Templates

- `templates/capabilities-default.json` — tightened replacement for `tauri init`'s `default.json`.
  Picks specific core permissions instead of `core:default`, locks `windows` to a labeled set, no
  shell/fs.
- `templates/capabilities-fs-scoped.json` — example FS-only capability with read access to
  `$APPDATA/<app>/` and write to a single subdirectory, plus the deny-default snippet against
  webview data on Linux/Windows.

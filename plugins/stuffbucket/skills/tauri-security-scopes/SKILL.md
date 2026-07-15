---
name: tauri-security-scopes
description: Use when scoping Tauri v2 plugin permissions — writing object-form permissions with `allow`/`deny`, FS path scopes with `$HOME`/`$APPDATA`/`$RESOURCE` placeholders and glob rules, shell scopes that validate `name`/`command`/`args` (with regex args and `sidecar:true`), HTTP URL scopes with method filters, and the asset-protocol scope. Covers the "deny wins" rule, the leading-dot glob trap on Unix, and where each plugin reads its scope.
---

# Tauri v2 Permission Scopes

A **permission** can be either a bare identifier string (`"fs:allow-read-text-file"`) or an
**object** that attaches a scope:

```json
{
  "identifier": "fs:allow-read-text-file",
  "allow": [{ "path": "$APPDATA/profile.json" }],
  "deny":  [{ "path": "$APPDATA/secrets/**" }]
}
```

Scopes filter *runtime arguments*. The command still has to be granted by the bare permission, then
for every call the plugin matches the input against the scope. **Deny always wins** — if any deny
entry matches, the call is refused even if an allow entry also matches.

## Where scopes live

Two equivalent places:

1. **Inline in a capability file** (per-window scope, preferred for app-level grants).
2. **Inside a plugin's own permission set** (`src-tauri/permissions/*.toml`) — used by the plugin
   author or for shared sets.

When the same permission identifier appears in multiple capability files that match the same window,
the runtime authority **unions allow lists and unions deny lists**. Because deny wins, adding a deny
anywhere tightens; adding an allow anywhere loosens. This makes "deny by default" hard — see
"Idiomatic patterns" below.

## Filesystem scope

The fs plugin reads `{ path: string }` objects. Paths can include placeholder variables that resolve
at runtime:

| Placeholder                                                          | Resolves to (`dirs` crate equivalent)                                   |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `$HOME`                                                              | user home dir                                                           |
| `$APPDATA`                                                           | per-app data dir (`~/Library/Application Support/<bundle-id>` on macOS) |
| `$APPCONFIG`                                                         | per-app config dir                                                      |
| `$APPLOCALDATA`                                                      | per-app local data dir                                                  |
| `$APPCACHE`                                                          | per-app cache dir                                                       |
| `$APPLOG`                                                            | per-app log dir                                                         |
| `$DOCUMENT`, `$DOWNLOAD`, `$PICTURE`, `$VIDEO`, `$AUDIO`, `$DESKTOP` | user dirs                                                               |
| `$RESOURCE`                                                          | bundled resources dir (read-only on most platforms)                     |
| `$TEMP`                                                              | OS temp dir                                                             |

Globs use Rust's `glob` crate with `MatchOptions { require_literal_leading_dot: true, .. }`. That
last flag is the gotcha: on Unix, `*` does **not** match a leading dot, so `$HOME/*` will not match
`$HOME/.config`. If you need dotfiles, use an explicit `$HOME/.*` entry or `$HOME/.config/**`.

Globs are matched against the **canonicalized, symlink-resolved** path of the argument. A user
passing `/var/log/...` on macOS where `/var → /private/var` will be checked against
`/private/var/log/...`. Write scopes against the canonical path or use the `$LOG` placeholder.

`requireLiteralLeadingDot` is set by Tauri's fs plugin and is not user-toggleable. Always make
dotfile patterns explicit.

```json
{
  "identifier": "fs:allow-write-text-file",
  "allow": [
    { "path": "$APPDATA/**" },
    { "path": "$APPDATA/.cache/**" }
  ],
  "deny": [
    { "path": "$APPDATA/secrets.json" },
    { "path": "$APPDATA/keys/**" }
  ]
}
```

See `templates/scope-fs.json`.

## Shell scope

The shell plugin's scope is an array of **commands the app may spawn**, each fully specified. There
is no "allow everything in PATH" — you list the binaries.

```json
{
  "identifier": "shell:allow-execute",
  "allow": [
    {
      "name": "git-status",
      "command": "git",
      "args": ["status", "--porcelain"]
    },
    {
      "name": "ffmpeg-convert",
      "command": "ffmpeg",
      "args": [
        "-i", { "validator": "^[A-Za-z0-9_./-]+\\.(mp4|mov|webm)$" },
        "-c:v", "libx264",
        { "validator": "^[A-Za-z0-9_./-]+\\.mp4$" }
      ]
    },
    {
      "name": "my-sidecar",
      "command": "binaries/my-helper",
      "sidecar": true,
      "args": true
    }
  ]
}
```

Field rules:

- `name` — what JS passes to `Command.create(name)`. Unique per scope entry.
- `command` — path or binary; absolute paths are honored, otherwise PATH lookup.
- `args` — one of:
  - `false` (default) — no args allowed,
  - `true` — any args allowed (dangerous),
  - array — each item is either a literal string (must match exactly) or `{ "validator": "<regex>"
    }` matched with `regex::Regex` against the runtime arg.
- `sidecar: true` — `command` is resolved against the bundle's sidecar directory; pairs with
  `externalBin` in `tauri.conf.json`. See `tauri-sidecar`.

Open command (`shell:allow-open`) has a separate `scope` that allows opening URLs:

```json
{
  "identifier": "shell:allow-open",
  "allow": [{ "url": "https://*.example.com/**" }]
}
```

See `templates/scope-shell.json`.

## HTTP scope

`http:default` grants the fetch command but with **no allowed URLs**. You must scope:

```json
{
  "identifier": "http:default",
  "allow": [
    { "url": "https://api.example.com/*" },
    { "url": "https://api.github.com/repos/*", "methods": ["GET"] }
  ],
  "deny": [
    { "url": "https://api.example.com/admin/*" }
  ]
}
```

URL patterns use the `urlpattern` crate (WHATWG URL Pattern). `methods` is optional — omit to allow
any method. If you set `methods`, list every verb you need; there's no wildcard.

The HTTP plugin does **not** automatically bypass CORS; it just lets the Rust side make the request.
Browsers in dev still preflight against the HTTP server you're loading from.

## Asset protocol scope

Sibling to FS but lives under `app.security.assetProtocol.scope` in `tauri.conf.json` (not in a
capability), because the asset protocol is checked at the protocol handler, not via a plugin
permission:

```json
"assetProtocol": {
  "enable": true,
  "scope": {
    "allow": ["$APPDATA/images/**", "$RESOURCE/**"],
    "deny":  ["$APPDATA/images/.private/**"]
  }
}
```

See `tauri-security-asset-protocol` for the full picture.

## Idiomatic patterns

- **Default deny by giving no allow.** A permission with `allow: []` and `deny: []` denies
  everything. Better than relying on deny everywhere.
- **One permission per scope axis.** Don't merge "read profile" and "write logs" into one fs scope —
  split into two permission entries with different `allow` paths. Easier to audit.
- **Validate sidecar args with regex.** `args: true` on a sidecar is essentially RCE. Always
  enumerate or validate.
- **Keep `$RESOURCE` read-only.** Tauri does not block writes there, but bundling tooling on
  macOS/Linux may sign the bundle; mutating breaks signature.
- **Deny over revoke.** If a downstream capability you don't control grants too much, add a deny in
  your own capability file to tighten — union rules guarantee the deny wins.

## Debugging

- "**not allowed by scope**" — the bare permission is granted but the runtime arg failed scope
  match. Log the canonical path/URL on the Rust side and re-check the glob.
- "**dotfile not matching**" — `require_literal_leading_dot`. Add an explicit `.<name>` or `.*`
  entry.
- "**works on macOS, fails on Linux**" — XDG vs Apple dirs differ; prefer `$APPDATA` etc. over
  hardcoded paths.
- "**sidecar reports `program not allowed on the configured shell scope`**" — `sidecar: true`
  missing, or the `command` doesn't match the bundled binary basename for the current target triple.

Templates: `templates/scope-fs.json`, `templates/scope-shell.json`.

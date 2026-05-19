---
name: tauri-security-capabilities-authoring
description: Use when hand-writing Tauri v2 capability JSON files — choosing identifiers, matching windows/webviews by label (never title), filtering by platform, distinguishing `local` vs `remote.urls`, merging multiple capability files with set-union semantics, naming platform-specific files (`-android.json`, `-ios.json`, `-desktop.json`), and understanding how `tauri build` validates them.
---

# Tauri v2 Capability File Authoring

A **capability** is one JSON file (or JSON5/TOML) in `src-tauri/capabilities/` that binds a set of
permissions to a set of windows/webviews on a set of platforms. The runtime authority composes every
capability that matches the calling context (window label × webview label × platform ×
local-vs-remote) into a single effective permission set per IPC call. Nothing is implicit: a window
with no capability matching it can call nothing.

## File layout and discovery

```text
src-tauri/
├── capabilities/
│   ├── default.json            ← always loaded
│   ├── settings-window.json    ← always loaded
│   ├── mobile-android.json     ← loaded only on Android
│   ├── mobile-ios.json         ← loaded only on iOS
│   └── dev.json                ← loaded only in dev (see below)
└── tauri.conf.json
```

Every `*.{json,json5,toml}` under `capabilities/` auto-loads, **unless** you list specific
identifiers in `tauri.conf.json → app.security.capabilities` — then only the listed ones load, by
identifier (not filename). Platform suffixes (`-android`, `-ios`, `-desktop`, `-linux`, `-macos`,
`-windows`) restrict loading to that platform regardless of inner `platforms` field. Prefer the
suffix; it's checked before parse.

## Minimum viable capability

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Default permissions for the main window",
  "windows": ["main"],
  "permissions": ["core:default"]
}
```

`identifier` must be unique across all loaded capability files; duplicates fail `tauri build` with
`duplicate capability identifier`. Convention: kebab-case, prefixed by surface (`main-`,
`settings-`, `tray-`, `mobile-`).

## Field reference (and traps)

| Field         | What it does                                                             | Common mistake                                                                                         |
| ------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `identifier`  | unique key                                                               | duplicate across files                                                                                 |
| `description` | docs only                                                                | left empty — fine, but document non-obvious grants                                                     |
| `windows`     | match by **label** (`WebviewWindow::builder(app, "label", …)`)           | matching by **title** — labels are the IPC identity, titles are user-facing strings                    |
| `webviews`    | match child webviews by label                                            | omitted when you have multi-webview windows; default windows-match implies all webviews of that window |
| `permissions` | flat list of permission identifiers (`plugin:permission`, plus `core:*`) | omitting the plugin prefix                                                                             |
| `local`       | applies to your bundled frontend (default `true`)                        | left `true` while also setting `remote.urls` and expecting both — set the appropriate one              |
| `remote.urls` | enable the capability for a remote origin loaded into a webview          | unbounded `https://*` — narrow to specific origins                                                     |
| `platforms`   | array filter; values: `linux`, `macOS`, `windows`, `android`, `iOS`      | platform names are case-sensitive; `macOS` and `iOS` use that casing                                   |

### `local` vs `remote.urls`

A capability with `local: true` (the default) grants its permissions to your bundled app. To grant
any of those same permissions to a remote URL loaded into a webview (rare, dangerous), set `local:
false` and list exact origins:

```json
{
  "identifier": "remote-readonly",
  "local": false,
  "remote": { "urls": ["https://docs.example.com"] },
  "windows": ["help"],
  "permissions": ["core:webview:default"]
}
```

Never combine an unscoped FS or shell permission with `remote.urls` — the remote origin then has
whatever local scope you gave.

## Matching semantics

Per IPC call, the authority finds all capabilities where:

- the calling **window label** is in `windows` (or `windows` omitted means "any of this app's
  windows"),
- the calling **webview label** is in `webviews` (if specified — otherwise inherits the window
  match),
- the current **platform** is in `platforms` (if specified),
- the origin is local and `local` is true, or remote and matches `remote.urls`.

The union of those capabilities' `permissions` is the effective grant. **Set-union, never
intersection.** If any capability grants `fs:allow-read-text-file`, the command runs — even if a
stricter file forbids it. Plan deny rules at the scope level inside permissions, not by adding a
"deny" capability.

## Splitting capabilities — when and why

Split when:

- a window has fundamentally different trust (e.g. `settings` can write FS, `main` can only read).
- a permission set only applies on one platform (use `-android.json` / `-ios.json` suffix).
- you want dev-only debugging permissions (loaded conditionally; see
  `templates/capabilities/dev.json`).

Don't split for "tidiness" — every extra file is a chance to grant something to the wrong window.
Three to six capabilities is plenty for most apps.

## Platform-specific capabilities

Two ways:

1. **Filename suffix** (preferred): `mobile-android.json`, `desktop-only.json`. Loader skips by
   suffix before parsing.
2. **`platforms` field** inside a non-suffixed file: `"platforms": ["android", "iOS"]`. Useful when
   one capability covers both mobile platforms with one identifier.

The `$schema` differs by platform — point mobile files at `gen/schemas/mobile-schema.json` and
desktop at `gen/schemas/desktop-schema.json` for IDE autocomplete that reflects available
permissions.

## Build-time validation

`tauri build` (and `tauri dev`) re-runs the ACL generator before compiling Rust. It will fail on:

- unknown permission identifier (typo, missing plugin in Cargo.toml),
- duplicate `identifier`,
- malformed scope object for a permission that requires one,
- unknown `windows`/`webviews` label *if* you've configured `app.security.capabilities` strict mode,
- `remote.urls` containing non-URL strings.

Warnings only (not failures) for: capability with empty `permissions`, capability that matches no
window. Treat the warnings as failures in CI.

## Dev vs prod

Tauri does not have an automatic "dev capability" mode. Conventional pattern:

```json
// tauri.conf.json
{
  "app": {
    "security": {
      "capabilities":
        process.env.TAURI_ENV_DEBUG
          ? ["main-capability", "dev"]
          : ["main-capability"]
    }
  }
}
```

…but JSON can't have conditionals — so instead, name the dev file `dev.json` and gate it via
`app.security.capabilities` listing in a `tauri.conf.dev.json` (Tauri merges
`tauri.conf.<mode>.json` over `tauri.conf.json`). See `templates/capabilities/dev.json`.

## Templates

- `templates/capabilities/desktop.json` — main window, core defaults, FS + dialog (locked-down
  scope), opener for https links.
- `templates/capabilities/mobile.json` — single capability for Android+iOS via `platforms`, omits
  `windows` (mobile is single-window).
- `templates/capabilities/dev.json` — adds devtools, log access, broader FS for hot-reload tooling.
  Never ship.

## Quick debugging

- **"command X not allowed by ACL"**: the calling window label is not in any capability granting
  that permission. Run `tauri inspect permissions` (and check `core:event:allow-emit` etc. didn't
  move plugins).
- **Works in dev, fails in prod**: a capability file's identifier isn't in
  `app.security.capabilities` for the prod build.
- **Permission exists but command still denied**: scope-level denial inside the permission. See
  `tauri-security-scopes`.

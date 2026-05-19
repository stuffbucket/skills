---
name: tauri-plugins-fs
description: Use when reading/writing files or directories from a Tauri v2 app — `@tauri-apps/plugin-fs` install, scope objects with `$HOME`/`$APPDATA`/`$RESOURCE` placeholders, the `fs:allow-*` permission identifiers (`fs:allow-read-text-file`, `fs:allow-write-binary-file`, `fs:scope`), `BaseDirectory` enum, `watch()` / `watchImmediate()` (needs `watch` feature), and the `requireLiteralLeadingDot` Unix dotfile gotcha.
---

# Tauri v2: File System Plugin

The fs plugin is the only sanctioned way to touch the disk from a Tauri WebView. It enforces a
**path-scope allowlist** at the IPC boundary — capability JSON, not Rust code, is what actually
gates access.

## Install

```sh
npm run tauri add fs        # adds Cargo dep + JS package + initializer
```

Manual: `tauri-plugin-fs = "2"` in `Cargo.toml`, `@tauri-apps/plugin-fs` in `package.json`, then
`.plugin(tauri_plugin_fs::init())` in the builder. Enable file watching with the `watch` feature
flag.

## API surface

| Group | JS function                                                  | Notes                                                                                                          |
| ----- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Read  | `readTextFile`, `readFile`, `readTextFileLines`              | `readFile` returns `Uint8Array`; `readTextFileLines` is an async iterator for large files                      |
| Write | `writeTextFile`, `writeFile`, `truncate`                     | Atomic-replace on the underlying OS where supported                                                            |
| Open  | `create`, `open`                                             | `open(path, { read, write, append, truncate, create, createNew })` returns a handle with `.read/.write/.close` |
| Dir   | `mkdir`, `readDir`, `remove`, `exists`, `rename`, `copyFile` | `remove({ recursive: true })` for non-empty dirs                                                               |
| Meta  | `stat`, `lstat`                                              | `stat` follows symlinks, `lstat` doesn't                                                                       |
| Watch | `watch`, `watchImmediate`                                    | Debounced vs immediate; requires `watch` Cargo feature                                                         |

Every read/write/dir call accepts `{ baseDir: BaseDirectory.* }`. Use this — never hardcode absolute
paths in JS.

## `BaseDirectory` enum

App-scoped (preferred — survive OS conventions):
`AppData`, `AppConfig`, `AppLocalData`, `AppCache`, `AppLog`.

User dirs (require explicit scope grant):
`Home`, `Desktop`, `Document`, `Download`, `Picture`, `Video`, `Audio`, `Public`.

System: `Cache`, `Config`, `Data`, `LocalData`, `Executable`, `Font`, `Runtime`, `Template`,
`Resource`, `Temp`.

## Capability JSON: the scope object

Permissions split into **command grants** (`fs:allow-read-text-file`) and **path grants**
(`fs:scope` or a per-command `allow`/`deny`). You need both — a command grant without a matching
scope still denies, and vice versa.

```json
{
  "identifier": "fs:allow-read-text-file",
  "allow": [{ "path": "$APPDATA/*" }, { "path": "$APPCONFIG/**/*" }],
  "deny":  [{ "path": "$APPDATA/secrets/**" }]
}
```

Path placeholders (resolved per-OS):

| Placeholder                                                    | Resolves to                              |
| -------------------------------------------------------------- | ---------------------------------------- |
| `$APPCONFIG` / `$APPDATA` / `$APPLOCALDATA`                    | App-specific config/data dirs            |
| `$APPCACHE` / `$APPLOG`                                        | App cache / logs                         |
| `$HOME`                                                        | User home                                |
| `$DESKTOP` / `$DOCUMENT` / `$DOWNLOAD` / `$PICTURE` / `$VIDEO` | User folders                             |
| `$RESOURCE`                                                    | Bundled resources (read-only at runtime) |
| `$TEMP`                                                        | System temp                              |

`*` matches one segment, `**` matches any depth. **Deny wins over allow.** Globally scoped grants
live under `fs:scope`; command-specific grants live under `fs:allow-<command>`.

## Rust side

Rust can extend scopes at runtime (e.g. after the user picks a folder):

```rust
use tauri_plugin_fs::FsExt;

tauri::Builder::default()
  .plugin(tauri_plugin_fs::init())
  .setup(|app| {
    let scope = app.fs_scope();
    scope.allow_directory("/opt/myapp/data", true)?; // recursive
    Ok(())
  })
```

`FsExt` also exposes `fs()` for direct Rust-side I/O with the same scope rules.

## JS examples

```ts
import { readTextFile, writeTextFile, watch, BaseDirectory }
  from '@tauri-apps/plugin-fs';

const cfg = await readTextFile('config.toml', { baseDir: BaseDirectory.AppConfig });
await writeTextFile('app.log', 'hello\n', { baseDir: BaseDirectory.AppLog });

const stop = await watch('app.log',
  (event) => console.log(event.paths, event.type),
  { baseDir: BaseDirectory.AppLog, delayMs: 250 });
// later: stop();
```

For >10 MB files, prefer streaming:

```ts
const lines = await readTextFileLines('huge.log', { baseDir: BaseDirectory.AppLog });
for await (const line of lines) process(line);
```

## The Unix dotfile gotcha

By default, glob patterns will **not** match paths whose leading segment starts with `.`.
`$HOME/**/*` does not match `$HOME/.ssh/config`. This is a glob convention, not a Tauri bug.

To opt out, set in `tauri.conf.json`:

```json
"plugins": { "fs": { "requireLiteralLeadingDot": false } }
```

Now `$HOME/**/*` matches dotfiles. Leave it on unless you genuinely need them — it's an effective
accidental-access guard.

## Platform notes

- **Path traversal blocked**: relative segments (`../`) are rejected, not normalized. Compose paths
  via `baseDir` + relative joins.
- **Android**: external storage requires `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` in
  `AndroidManifest.xml`.
- **iOS**: writing to file timestamps requires the `NSPrivacyAccessedAPICategoryFileTimestamp`
  declaration in `PrivacyInfo.xcprivacy` (reason code `C617.1`).
- **macOS**: `$DOCUMENT`/`$DESKTOP`/`$DOWNLOAD` trigger the system TCC permission prompt the first
  time they're hit, even with capability allow.

## Diagnosing "not allowed" errors

The error string contains the missing identifier. Order of checks:

1. Did you include the **command-level** permission (`fs:allow-write-text-file`)? `fs:default`
   covers reads only.
2. Does your `allow` glob actually match the full path? Common mistake: `$APPDATA` does not match
   `$APPDATA/foo` — you need `$APPDATA/*` or `$APPDATA/**/*`.
3. Are you on Unix touching a dotfile with `requireLiteralLeadingDot` still true?
4. Is a `deny` rule shadowing your `allow`?

## Templates

- `templates/setup.rs` — plugin init + setup-time scope extension.
- `templates/usage.ts` — read/write/watch with `BaseDirectory`.
- `templates/capability.json` — minimal capability with command + scope grants.

## Related

- `tauri-plugins` — picking the right plugin and install flow.
- `tauri-security-scopes` — deeper coverage of scope semantics, deny precedence, runtime extension.
- `tauri-security-capabilities-authoring` — capability file structure, windows/platforms filters.

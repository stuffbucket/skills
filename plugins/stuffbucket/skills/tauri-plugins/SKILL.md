---
name: tauri-plugins
description: Use when adding an official Tauri v2 plugin — picking the right plugin (fs/dialog/shell/http/store/notification/clipboard/global-shortcut/logging/os/opener/process/single-instance/autostart/deep-link/sql/websocket/upload/stronghold/cli), installing it (Cargo + npm), registering it in Rust, and granting the required capability permissions.
---

# Tauri v2 official plugins

Tauri v2 splits most APIs out of core into versioned plugins under
`tauri-apps/plugins-workspace`. Every plugin ships three pieces you must
wire together: a Rust crate (`tauri-plugin-<name>`), a JS package
(`@tauri-apps/plugin-<name>`), and a set of permission identifiers that
must be granted in a capability file. Skipping the capability grant is the
single most common cause of "not allowed" errors at runtime.

Read this skill alongside `tauri-security` (capabilities + scopes) and
`tauri-setup` (project layout). The five categories below cover every
official plugin in the v2 docs.

## How to add any plugin (3 steps)

1. **Install both sides** (run from project root):

   ```sh
   cd src-tauri && cargo add tauri-plugin-<name>
   bun add @tauri-apps/plugin-<name>     # or npm/pnpm/yarn
   ```

   Some mobile-capable plugins need `cargo add --target 'cfg(any(target_os = "android", target_os =
   "ios"))' tauri-plugin-<name>`.

2. **Register in Rust** — `src-tauri/src/lib.rs`:

   ```rust
   tauri::Builder::default()
       .plugin(tauri_plugin_<name>::init())
       .setup(|app| Ok(()))
       .run(tauri::generate_context!())
       .expect("error while running tauri application");
   ```

   A few plugins use a builder (`Builder::default().build()`) instead of
   `init()` — noted per-plugin below.

3. **Grant permissions** — `src-tauri/capabilities/default.json`:

   ```jsonc
   {
     "identifier": "default",
     "windows": ["main"],
     "permissions": [
       "core:default",
       "<plugin>:default",        // or finer-grained: "<plugin>:allow-<cmd>"
     ]
   }
   ```

   Most plugins ship `<plugin>:default` covering the common safe commands;
   anything destructive (write, execute, exit) requires opting in to a
   specific identifier.

See `templates/lib.rs` and `templates/capabilities-plugins.json` for a
working multi-plugin setup.

---

## Filesystem & data

### `fs` — scoped filesystem access

|         |                                                                                                                                                |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Install | `cargo add tauri-plugin-fs` · `bun add @tauri-apps/plugin-fs`                                                                                  |
| Rust    | `.plugin(tauri_plugin_fs::init())`                                                                                                             |
| JS      | `import { readTextFile, writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs'`                                                           |
| Perms   | `fs:default`, plus opt-ins like `fs:allow-read-text-file`, `fs:allow-write-text-file`, `fs:allow-app-write-recursive`                          |
| Scope   | Path scopes go on the *permission*, not the plugin. Use `$HOME`, `$APPDATA`, `$DOCUMENT`, etc. placeholders in the capability `"allow"` array. |

Scopes are mandatory for anything outside the app's own data dir. Example
fragment grants read access to `$HOME/.config/myapp/**`:

```jsonc
{ "identifier": "fs:allow-read-text-file",
  "allow": [{ "path": "$HOME/.config/myapp/**" }] }
```

### `store` — JSON key-value persistence

|         |                                                                                           |
| ------- | ----------------------------------------------------------------------------------------- |
| Install | `cargo add tauri-plugin-store` · `bun add @tauri-apps/plugin-store`                       |
| Rust    | `.plugin(tauri_plugin_store::Builder::default().build())`                                 |
| JS      | `const store = await load('settings.json'); await store.set('k', v); await store.save();` |
| Perms   | `store:default` (covers get/set/save/load)                                                |
| Scope   | Files live under the app data dir; no path scope needed.                                  |

### `sql` — SQLite / MySQL / Postgres

|         |                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------ |
| Install | `cargo add tauri-plugin-sql --features sqlite` (or `mysql`, `postgres`) · `bun add @tauri-apps/plugin-sql`         |
| Rust    | `.plugin(tauri_plugin_sql::Builder::default().build())` — optionally `.add_migrations("sqlite:app.db", vec![...])` |
| JS      | `const db = await Database.load('sqlite:app.db'); await db.execute(...);`                                          |
| Perms   | `sql:default`, plus `sql:allow-load`, `sql:allow-execute`, `sql:allow-select` per command                          |
| Scope   | Connection strings are NOT scoped by capabilities; validate in app code.                                           |

### `stronghold` — encrypted secrets vault (IOTA Stronghold)

|         |                                                                                                          |
| ------- | -------------------------------------------------------------------------------------------------------- |
| Install | `cargo add tauri-plugin-stronghold` · `bun add @tauri-apps/plugin-stronghold`                            |
| Rust    | `.plugin(tauri_plugin_stronghold::Builder::new(\|password\| { /* argon2 -> 32 bytes */ }).build())`      |
| JS      | `const stronghold = await Stronghold.load(path, pw); const client = await stronghold.loadClient('app');` |
| Perms   | `stronghold:default`                                                                                     |
| Note    | You must supply the password-hash function in Rust; the JS side just supplies the password string.       |

### `persisted-scope` — re-grant fs/asset scopes across restarts

|         |                                                                               |
| ------- | ----------------------------------------------------------------------------- |
| Install | `cargo add tauri-plugin-persisted-scope`                                      |
| Rust    | `.plugin(tauri_plugin_persisted_scope::init())`                               |
| JS      | none — purely persists runtime-extended scopes for `fs` and `asset` protocol. |
| Perms   | none extra; piggybacks on `fs` permissions.                                   |

### `upload` — multipart file upload/download with progress

|         |                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------- |
| Install | `cargo add tauri-plugin-upload` · `bun add @tauri-apps/plugin-upload`                             |
| Rust    | `.plugin(tauri_plugin_upload::init())`                                                            |
| JS      | `await upload(url, filePath, ({progress, total}) => {...}, headers)` and matching `download(...)` |
| Perms   | `upload:default`                                                                                  |
| Scope   | URLs are unrestricted; pair with `http` scope discipline.                                         |

---

## Shell & process

### `shell` — spawn sidecars or whitelisted external commands

|                    |                                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Install            | `cargo add tauri-plugin-shell` · `bun add @tauri-apps/plugin-shell`                                                                          |
| Rust               | `.plugin(tauri_plugin_shell::init())`                                                                                                        |
| JS                 | `Command.create('node', ['-v']).execute()` or `Command.sidecar('binaries/my-cli')`                                                           |
| Perms              | `shell:default` covers `open`. `shell:allow-execute` is **scope-mandatory** — must list commands and arg patterns.                           |
| Scope (capability) | `{ "identifier": "shell:allow-execute", "allow": [{ "name": "node", "cmd": "node", "args": [{ "validator": "\\-v" }], "sidecar": false }] }` |

Sidecars must also be listed in `tauri.conf.json` → `bundle.externalBin`.

### `opener` — open URLs / files with the OS default handler

|         |                                                                                                                         |
| ------- | ----------------------------------------------------------------------------------------------------------------------- |
| Install | `cargo add tauri-plugin-opener` · `bun add @tauri-apps/plugin-opener`                                                   |
| Rust    | `.plugin(tauri_plugin_opener::init())`                                                                                  |
| JS      | `await openUrl('https://...')`, `await openPath('/path/to/file')`, `await revealItemInDir(path)`                        |
| Perms   | `opener:default`, plus `opener:allow-open-url`, `opener:allow-open-path`, `opener:allow-reveal-item-in-dir`             |
| Note    | Replaces v1's `shell.open`. Prefer `opener` over `shell` for "open in Finder/browser" — no execute capability required. |

### `process` — exit/relaunch the app

|         |                                                                                  |
| ------- | -------------------------------------------------------------------------------- |
| Install | `cargo add tauri-plugin-process` · `bun add @tauri-apps/plugin-process`          |
| Rust    | `.plugin(tauri_plugin_process::init())`                                          |
| JS      | `await exit(0)`, `await relaunch()`                                              |
| Perms   | `process:default`, or specifically `process:allow-exit`, `process:allow-restart` |

### `single-instance` — enforce one running instance

|         |                                                                                                                             |
| ------- | --------------------------------------------------------------------------------------------------------------------------- |
| Install | `cargo add tauri-plugin-single-instance --features deep-link` (feature optional)                                            |
| Rust    | `.plugin(tauri_plugin_single_instance::init(\|app, argv, cwd\| { /* focus main */ }))` — call FIRST in builder chain        |
| JS      | none                                                                                                                        |
| Perms   | none — desktop-only, no commands exposed.                                                                                   |

### `autostart` — launch at OS login

|         |                                                                                           |
| ------- | ----------------------------------------------------------------------------------------- |
| Install | `cargo add tauri-plugin-autostart` · `bun add @tauri-apps/plugin-autostart`               |
| Rust    | `.plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--flag"])))` |
| JS      | `await enable()`, `await disable()`, `await isEnabled()`                                  |
| Perms   | `autostart:default`                                                                       |

### `cli` — parse CLI args passed to the bundled binary

|         |                                                                                            |
| ------- | ------------------------------------------------------------------------------------------ |
| Install | `cargo add tauri-plugin-cli` · `bun add @tauri-apps/plugin-cli`                            |
| Rust    | `.plugin(tauri_plugin_cli::init())`; declare args under `plugins.cli` in `tauri.conf.json` |
| JS      | `const matches = await getMatches(); matches.args.verbose.value`                           |
| Perms   | `cli:default`                                                                              |

---

## UI feedback

### `dialog` — file pickers, message/confirm/ask dialogs

|         |                                                                                                                                               |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Install | `cargo add tauri-plugin-dialog` · `bun add @tauri-apps/plugin-dialog`                                                                         |
| Rust    | `.plugin(tauri_plugin_dialog::init())`                                                                                                        |
| JS      | `await open({ multiple: true, filters: [...] })`, `await save(...)`, `await ask('Sure?')`, `await message('Hi')`                              |
| Perms   | `dialog:default` — fine-grained: `dialog:allow-open`, `dialog:allow-save`, `dialog:allow-message`, `dialog:allow-ask`, `dialog:allow-confirm` |

### `notification` — OS notifications

|         |                                                                                                           |
| ------- | --------------------------------------------------------------------------------------------------------- |
| Install | `cargo add tauri-plugin-notification` · `bun add @tauri-apps/plugin-notification`                         |
| Rust    | `.plugin(tauri_plugin_notification::init())`                                                              |
| JS      | `if (await isPermissionGranted() === false) await requestPermission(); sendNotification({ title, body })` |
| Perms   | `notification:default`                                                                                    |
| Mobile  | Android needs the `POST_NOTIFICATIONS` runtime permission (handled by the JS request flow).               |

### `clipboard-manager` — read/write clipboard text & images

|         |                                                                                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install | `cargo add tauri-plugin-clipboard-manager` · `bun add @tauri-apps/plugin-clipboard-manager`                                                             |
| Rust    | `.plugin(tauri_plugin_clipboard_manager::init())`                                                                                                       |
| JS      | `await writeText('hi'); const s = await readText();` also `readImage()/writeImage(bytes)`                                                               |
| Perms   | `clipboard-manager:default` (no read by default), then `clipboard-manager:allow-read-text`, `allow-write-text`, `allow-read-image`, `allow-write-image` |

### `global-shortcut` — system-wide hotkeys (desktop only)

|         |                                                                                         |
| ------- | --------------------------------------------------------------------------------------- |
| Install | `cargo add tauri-plugin-global-shortcut` · `bun add @tauri-apps/plugin-global-shortcut` |
| Rust    | `.plugin(tauri_plugin_global_shortcut::Builder::new().build())`                         |
| JS      | `await register('CmdOrCtrl+Shift+K', () => {...})`, `unregister`, `unregisterAll`       |
| Perms   | `global-shortcut:default`                                                               |

---

## Network

### `http` — fetch-style HTTP client (no CORS, scoped)

|         |                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------- |
| Install | `cargo add tauri-plugin-http` · `bun add @tauri-apps/plugin-http`                                                         |
| Rust    | `.plugin(tauri_plugin_http::init())`                                                                                      |
| JS      | `import { fetch } from '@tauri-apps/plugin-http'; const r = await fetch('https://api.example.com/x', { method: 'POST' })` |
| Perms   | `http:default` (covers `fetch`). Scope URLs in the capability.                                                            |
| Scope   | `{ "identifier": "http:default", "allow": [{ "url": "https://api.example.com/*" }] }`                                     |

### `websocket` — outbound WebSocket client

|         |                                                                                              |
| ------- | -------------------------------------------------------------------------------------------- |
| Install | `cargo add tauri-plugin-websocket` · `bun add @tauri-apps/plugin-websocket`                  |
| Rust    | `.plugin(tauri_plugin_websocket::init())`                                                    |
| JS      | `const ws = await WebSocket.connect('wss://...'); ws.addListener(msg => ...); ws.send('hi')` |
| Perms   | `websocket:default`                                                                          |

### `localhost` — serve the frontend over `http://localhost:<port>` instead of `tauri://`

|         |                                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------- |
| Install | `cargo add tauri-plugin-localhost`                                                                      |
| Rust    | `.plugin(tauri_plugin_localhost::Builder::new(1430).build())`                                           |
| JS      | none                                                                                                    |
| Perms   | none                                                                                                    |
| Caveat  | Loses some of Tauri's security model — only use when a third-party SDK demands a real `http://` origin. |

---

## Platform info

### `os` — platform / arch / version / hostname

|         |                                                                                                                  |
| ------- | ---------------------------------------------------------------------------------------------------------------- |
| Install | `cargo add tauri-plugin-os` · `bun add @tauri-apps/plugin-os`                                                    |
| Rust    | `.plugin(tauri_plugin_os::init())`                                                                               |
| JS      | `platform()`, `version()`, `arch()`, `hostname()`, `locale()` (all sync after import)                            |
| Perms   | `os:default` (covers most getters); individual `os:allow-platform`, `os:allow-version`, etc. for tighter setups. |

### `log` — structured logging from JS + Rust to stdout/file/webview

|         |                                                                                                                                                     |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install | `cargo add tauri-plugin-log` · `bun add @tauri-apps/plugin-log`                                                                                     |
| Rust    | `.plugin(tauri_plugin_log::Builder::new().targets([Target::new(TargetKind::Stdout), Target::new(TargetKind::LogDir { file_name: None })]).build())` |
| JS      | `import { info, warn, error } from '@tauri-apps/plugin-log'; await info('booted')`                                                                  |
| Perms   | `log:default`                                                                                                                                       |

---

## Linking

### `deep-link` — receive `myapp://...` URLs from OS

|         |                                                                                                                                                                                                                                                            |        |           |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------- |
| Install | `cargo add tauri-plugin-deep-link` · `bun add @tauri-apps/plugin-deep-link`                                                                                                                                                                                |        |           |
| Rust    | `.plugin(tauri_plugin_deep_link::init())`; in `setup`, call `app.deep_link().on_open_url(\                                                                                                                                                                 | event\ | { ... })` |
| JS      | `await onOpenUrl(urls => ...)`, `await getCurrent()`                                                                                                                                                                                                       |        |           |
| Perms   | `deep-link:default`                                                                                                                                                                                                                                        |        |           |
| Config  | Mandatory: `tauri.conf.json` → `plugins.deep-link.desktop.schemes: ["myapp"]` (Linux/Win) AND `mobile` schemes for iOS/Android. Tauri generates the macOS plist `CFBundleURLTypes` and Android intent filters from this — **must rebuild** after changing. |        |           |

---

## Common pitfalls

- **Forgot the capability grant.** Most "not allowed by ACL" / "plugin command X not allowed" errors
  come from registering the plugin in Rust but never adding `<plugin>:default` (or a finer
  permission) to a capability file. Check `src-tauri/capabilities/*.json`.
- **`shell:allow-execute` without scope.** The permission alone does nothing; you must list each
  allowed command + arg validator under `"allow"`. Missing scope = silent no-op or rejected command.
- **fs paths.** Capability scopes use placeholders (`$HOME`, `$APPDATA`, `$DOCUMENT`, `$DOWNLOAD`,
  `$RESOURCE`, `$TEMP`), not literal paths. Globs are `**` for recursive. Without a scope entry,
  every `fs` call outside the app data dir fails.
- **Deep-link without manifest config.** `plugins.deep-link.desktop.schemes` (and `.mobile.schemes`)
  in `tauri.conf.json` is required. macOS will silently ignore links until the bundle is rebuilt
  with the right `CFBundleURLTypes`; Android needs the intent filter regenerated.
- **`single-instance` plugin order.** Register it as the FIRST plugin on the builder — later plugins
  running in the duplicate process can corrupt state before the duplicate exits.
- **Mobile-only vs desktop-only.** `global-shortcut`, `cli`, `single-instance`, `autostart`,
  `localhost` are desktop-only. `notification` and `deep-link` need extra mobile setup.
- **`opener` vs `shell`.** "Open this file in Finder" / "open URL in browser" should use `opener`,
  not `shell`. The `shell` plugin's `open` is deprecated for that use case and pulls in the much
  more powerful (and more permission-hungry) execute machinery.
- **Plugin name skew.** The crate is `tauri-plugin-clipboard-manager`, the npm package is
  `@tauri-apps/plugin-clipboard-manager`, the JS API surface is `clipboard-manager` permissions —
  not `clipboard`. Same kind of dash-suffix exists for `global-shortcut` and `single-instance`.

## Templates

- `templates/lib.rs` — `tauri::Builder` chain registering opener, dialog, fs, store, log, and
  notification.
- `templates/capabilities-plugins.json` — matching capability file with the right `<plugin>:default`
  grants plus scoped `fs:allow-read-text-file` on `$APPCONFIG/**`.

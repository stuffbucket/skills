---
name: tauri-plugins-store
description: Use when persisting key-value settings or small JSON state in a Tauri v2 app — `Store::load(app, "settings.json")` / `app.store(...)` in Rust, `load()`/`get()`/`set()`/`save()`/`has()`/`delete()`/`clear()` in JS, `autoSave` debounce, file location under `app_data_dir`, the JSON-only constraint, and when to reach for `tauri-plugin-sql` instead.
---

# Tauri v2: Store Plugin

A JSON-backed key-value store that survives restarts. One store per file; files live under
`app_data_dir`. Cheap, async, shared between Rust and JS — pick it for settings, last-window-state,
simple caches.

Not the right tool for: lists with >~1k entries, anything queryable, anything you'd want to sort or
filter without loading the whole file. Use `tauri-plugin-sql` for that.

## Install

```sh
npm run tauri add store
```

Manual: `tauri-plugin-store = "2"`, `@tauri-apps/plugin-store`,
`.plugin(tauri_plugin_store::Builder::new().build())`.

## JS API

```ts
import { load } from '@tauri-apps/plugin-store';

// Lazy: file is created on first save; not read off disk until first access.
const store = await load('settings.json', { autoSave: true });

await store.set('theme', 'dark');
await store.set('lastWindow', { x: 100, y: 100, w: 800, h: 600 });

const theme = await store.get<string>('theme');     // 'dark'
const has   = await store.has('theme');             // true
await store.delete('lastWindow');
await store.clear();

// With autoSave: false, persist manually:
await store.save();
```

`load()` returns the same handle for the same path — it's cached. Subsequent calls hit the in-memory
copy.

| Option                          | Default | Meaning                                                      |
| ------------------------------- | ------- | ------------------------------------------------------------ |
| `autoSave`                      | `false` | If a number, debounces saves by that many ms; `true` ≈ 100ms |
| `defaults`                      | none    | Seed values used on first creation only                      |
| `serializeFn` / `deserializeFn` | JSON    | Override the codec (advanced)                                |

Stores also auto-persist on graceful app exit. Don't rely on this for crashes.

## Rust API

```rust
use tauri_plugin_store::StoreExt;

#[tauri::command]
async fn set_theme(app: tauri::AppHandle, theme: String) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set("theme", serde_json::Value::String(theme));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}
```

`app.store(path)` returns an `Arc<Store<R>>`. Values are `serde_json::Value` — convert at the edges:

```rust
let theme: String = store
    .get("theme")
    .and_then(|v| v.as_str().map(String::from))
    .unwrap_or_else(|| "system".into());
```

## File location

| OS      | Path                                               |
| ------- | -------------------------------------------------- |
| macOS   | `~/Library/Application Support/<bundle id>/<file>` |
| Linux   | `~/.local/share/<bundle id>/<file>`                |
| Windows | `%APPDATA%\<bundle id>\<file>`                     |

The exact resolved dir is `app.path().app_data_dir()`. Use relative names in `load()` — never
absolute paths; you'd skip the per-app sandbox.

## JSON-only

Anything you `set()` is serialized via JSON. Concretely:

- ✅ string, number, boolean, null, plain object, array
- ❌ `Date` — silently becomes `"2024-…"` string round-trip; convert explicitly
- ❌ `Map`/`Set` — becomes `{}` / `[]`
- ❌ `Uint8Array` — becomes a JSON object of indices; for binary use the fs plugin
- ❌ functions, class instances — lose prototype, often `{}`

If you find yourself reaching for one of these, that's a sign you want SQL.

## Migrations

There's no built-in schema migration. Two practical patterns:

```ts
// 1) version key + manual upgrades on load
const VERSION = 2;
const store = await load('settings.json', { autoSave: true });
const v = (await store.get<number>('__v')) ?? 0;
if (v < 1) {
  // v0 → v1: rename `colorMode` → `theme`
  const old = await store.get<string>('colorMode');
  if (old) { await store.set('theme', old); await store.delete('colorMode'); }
}
if (v < 2) { /* v1 → v2 … */ }
await store.set('__v', VERSION);
```

```ts
// 2) namespaced files, no migration — bump the filename
const store = await load('settings.v2.json', { autoSave: true });
```

The second pattern is the simplest correct choice when shapes change a lot.

## Store vs SQL

| Need                                  | Store           | SQL                 |
| ------------------------------------- | --------------- | ------------------- |
| App settings, last-used window        | yes             | overkill            |
| <100 small records                    | yes             | works               |
| Querying / filtering / sorting        | reload-and-walk | yes                 |
| Concurrent writers (multiple windows) | last-write-wins | proper transactions |
| Schema migrations                     | manual          | first-class         |
| Binary blobs                          | no              | yes                 |

## Permission

`store:default` covers normal use. Grant it in the capability:

```json
{ "permissions": ["store:default"] }
```

## Templates

- `templates/setup.rs` — plugin init + a Rust command reading the store.
- `templates/usage.ts` — load / get / set / migrate pattern.
- `templates/capability.json` — minimal store permission.

## Related

- `tauri-plugins-fs` — when you need raw file I/O instead of KV.
- `tauri-plugins-sql` — when KV stops scaling.
- `tauri-plugins` — overall plugin decision matrix.

---
name: tauri-commands
description: Use when wiring JavaScript→Rust calls in a Tauri v2 app — defining `#[tauri::command]` handlers, passing args, returning values/errors, async commands, accessing app state or the AppHandle, or registering commands in the invoke_handler.
---

# Tauri v2 — Commands (JS → Rust)

Tauri's `command` system is a typed RPC bridge: a Rust fn annotated with
`#[tauri::command]`, registered in `invoke_handler`, called from JS via
`invoke('name', { argInCamel })`. Args go through `serde::Deserialize`, return
values through `serde::Serialize`.

## Define a command

```rust
// src-tauri/src/lib.rs
#[tauri::command]
fn greet(name: String) -> String {
    format!("Hello, {name}!")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Rules:

- Command names must be unique across the whole app (not scoped to modules).
- Commands defined in `lib.rs` **cannot be `pub`** (macro collision); in any
  other module they **must be `pub`**.
- `generate_handler!` takes one array. Multiple `.invoke_handler()` calls only
  keep the last — pass every command in a single macro invocation.
- Commands in submodules are still invoked by their bare name from JS
  (`invoke('greet')`, not `invoke('commands::greet')`).

## Arguments

Any `serde::Deserialize` type works. JS passes a JSON object; keys are
**camelCase by default**, mapped to the Rust parameter's snake_case name.

```rust
#[tauri::command]
fn login(user_name: String, password: String) {}
```

```js
invoke('login', { userName: 'tauri', password: 'hunter2' });
```

Override the convention per-command with `rename_all`:

```rust
#[tauri::command(rename_all = "snake_case")]
fn login(user_name: String) {}
// JS:  invoke('login', { user_name: 'tauri' })
```

Structs work the same way — derive `Deserialize`, optionally
`#[serde(rename_all = "camelCase")]` so the struct's fields also accept
camelCase from JS.

## Return values

Anything `serde::Serialize`. The JS-side `invoke()` returns a Promise that
resolves to the value.

For large binary payloads, skip JSON entirely with `tauri::ipc::Response`:

```rust
use tauri::ipc::Response;
#[tauri::command]
fn read_file() -> Response {
    Response::new(std::fs::read("/path").unwrap())
}
```

## Error handling

Return `Result<T, E>` where both `T` and `E` are `Serialize`. `Err` rejects the
JS promise.

Quick-and-dirty: stringify with `map_err`:

```rust
#[tauri::command]
fn open() -> Result<(), String> {
    std::fs::File::open("x").map_err(|e| e.to_string())?;
    Ok(())
}
```

Idiomatic: a `thiserror` enum with a manual `Serialize` that emits a tagged
shape — gives the frontend a discriminated union (see `templates/command.rs`):

```ts
type ErrorKind = { kind: 'io' | 'utf8'; message: string };
invoke('read').catch((e: ErrorKind) => { /* switch on e.kind */ });
```

`std::error::Error` impls from external crates rarely implement `Serialize`;
wrapping them in your own enum (with `#[from]`) is the standard fix.

## Async commands

Just write `async fn`. Async commands run on `tauri::async_runtime`; sync
commands run on the main thread (use `#[tauri::command(async)]` to push a sync
fn to the pool).

```rust
#[tauri::command]
async fn fetch_thing(id: String) -> Result<String, String> {
    some_async_fn(&id).await.map_err(|e| e.to_string())
}
```

**Borrow-checker gotcha:** async fns currently can't take borrowed args
directly (`&str`, `State<'_, T>` in a bare signature). Two workarounds:

1. Take owned types (`String` instead of `&str`).
2. Return `Result<T, E>` — the macro then accepts `State<'_, T>` and other
   borrows in the signature. This is why most real async commands return
   `Result`.

```rust
#[tauri::command]
async fn use_state(state: tauri::State<'_, Db>) -> Result<String, ()> {
    Ok(state.query().await)
}
```

## Accessing AppHandle / Window / WebviewWindow

Inject by parameter type — order doesn't matter, Tauri matches by type:

```rust
#[tauri::command]
async fn ctx(app: tauri::AppHandle, window: tauri::Window) {
    println!("from {}", window.label());
    let _ = app.path().app_data_dir();
}
```

Available: `tauri::AppHandle`, `tauri::Window`, `tauri::WebviewWindow`,
`tauri::Webview`, `tauri::ipc::Request` (raw body + headers).

If you target a non-default runtime (e.g. mock), make the command generic:
`async fn cmd<R: Runtime>(app: AppHandle<R>) { ... }`.

## Managed state

Stash app-global state on the builder, then inject `State<'_, T>`:

```rust
struct Db(tokio::sync::Mutex<Connection>);

tauri::Builder::default()
    .manage(Db(tokio::sync::Mutex::new(open_db())))
    .invoke_handler(tauri::generate_handler![query]);

#[tauri::command]
async fn query(state: tauri::State<'_, Db>) -> Result<Vec<Row>, String> {
    let conn = state.0.lock().await;
    conn.fetch().map_err(|e| e.to_string())
}
```

The `'_` lifetime on `State` is the borrow checker reminder — see the async
gotcha above, you almost always need `Result<_, _>` to use it in `async fn`.

For interior mutability use `Mutex`/`RwLock` (prefer `tokio::sync` in async
commands, `std::sync` in sync commands) — `manage` takes `T`, not `&mut T`.

## Invoke from JS

```ts
import { invoke } from '@tauri-apps/api/core';

const msg = await invoke<string>('greet', { name: 'Brian' });
```

Conventions:

- Second arg is an object; keys are camelCase (unless command sets
  `rename_all`).
- Type the return with `invoke<ReturnT>()` — there's no runtime check, it's
  just a TS hint, so keep it in sync with the Rust signature.
- For raw bodies pass an `ArrayBuffer`/`Uint8Array` as the second arg and put
  headers in the third: `invoke('upload', bytes, { headers: { ... } })`.

## Permissions / capabilities

Tauri v2 gates IPC through capabilities (`src-tauri/capabilities/*.json`).
The default capability ships `core:default`, which is what plugin commands
(fs, dialog, shell, etc.) check against — **your own `#[tauri::command]`
functions do not need ACL entries**. Only plugin commands require their
permission strings (e.g. `"fs:allow-read-text-file"`) in the capability file.

If you split commands into multiple windows and want to restrict who can call
what, you can still author custom permissions, but the default project state
"works" for app-defined commands with no capability edits.

## Common pitfalls

- **Silent "command X not found" failure** — forgot to add the fn to
  `tauri::generate_handler![...]`, or called `.invoke_handler` twice (only the
  last wins).
- **Argument name mismatch** — JS sent `user_name` but Rust expected
  `userName` from the auto-camelCase mapping (or vice versa). Add
  `rename_all` or fix the JS side.
- **`pub fn` in `lib.rs`** — macro generates a duplicate symbol; drop `pub`,
  or move the command into a submodule where `pub` is required.
- **Panics crash the whole app process** — return `Result<_, _>` from
  anything that can fail. No `.unwrap()` in command bodies.
- **Async + borrowed args** — `async fn foo(s: &str)` compiles oddly or not
  at all; either own the arg (`String`) or return a `Result`.
- **`State<'_, T>` outside `Result`** — same lifetime issue; wrap in
  `Result<_, _>`.
- **Large JSON returns** — serializing megabyte blobs through IPC is slow;
  use `tauri::ipc::Response` for binary, `tauri::ipc::Channel` for streams.

## Templates

- `templates/command.rs` — full Rust file: managed state, async, thiserror
  enum with tagged serialize, AppHandle injection.
- `templates/invoke.ts` — matching typed JS side.

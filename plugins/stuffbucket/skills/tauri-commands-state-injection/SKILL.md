---
name: tauri-commands-state-injection
description: Use when wiring managed state into Tauri v2 commands — registering state with `app.manage()` in `setup`, accessing it via `State`, async state with `tokio::sync::Mutex` (never std::sync::Mutex across `.await`), interior mutability (`Arc`, `RwLock`, `parking_lot`), `AppHandle::state::T()` outside commands, or composing multiple state types.
---

# Tauri v2 — Commands: Managed State In Depth

State managed by Tauri is global, type-keyed, and lives for the lifetime of the
`App`. It's the right home for: HTTP clients, DB pools, in-memory caches,
sidecar process handles, settings, cancellation tokens. Each Rust type can be
registered exactly once.

See [[tauri-commands]] for command basics. This skill covers the state side in
detail.

## Registering state — `setup` is the right place

`tauri::Builder::manage(T)` registers state before windows exist. For most
single-value state that's fine. For anything that needs the `AppHandle` to
construct (a DB pool that wants the app-data dir, a sidecar handle, an HTTP
client with the app's config baked in), do it in `setup`:

```rust
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let db = DbPool::open(&data_dir.join("app.db"))?;
            app.manage(AppState::new(db));  // before any window loads
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![/* ... */])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Lifecycle rule:** call `manage` before the first command can fire. `setup`
runs before windows are visible — anything registered there is guaranteed
present by the time JS calls `invoke()`. Registering later (e.g. inside a
command) is a footgun: the *first* call will panic if the type isn't there yet.

`manage` returns `bool` — `false` means a value of that type was already
registered. If you need replace-semantics, you're modeling it wrong; wrap the
value in `Mutex` / `RwLock` and mutate the inside.

## Accessing state inside commands — `State<'_, T>`

```rust
#[tauri::command]
fn get_user(state: tauri::State<'_, AppState>) -> String {
    state.username.clone()
}
```

**Lifetime gotcha:** use `State<'_, T>`, not `State<T>`. The elided lifetime
matters for async commands — `State<'r, T>` is borrowed from the handler frame,
which the macro stitches together. Bare `State<T>` won't compile.

For async commands, `State<'_, T>` still works — but **do not hold the borrow
across an `.await`** unless you've cloned out what you need first. The borrow
is tied to the command's request; awaits don't move it, but holding a `Mutex`
guard derived from it across awaits is the actual deadlock vector (see below).

## Accessing state outside commands — `AppHandle::state::<T>()`

In event handlers, sidecar callbacks, tray menus, `tokio::spawn`'d tasks:

```rust
let app = app_handle.clone();
tokio::spawn(async move {
    let state = app.state::<AppState>();  // typed lookup
    state.cache.lock().await.insert(k, v);
});
```

`AppHandle` is cheap to clone (it's an `Arc` internally). Clone it before
moving into a spawned task.

## Interior mutability — `Mutex`, `RwLock`, `parking_lot`

`State<T>` gives you `&T`. To mutate, the `T` must own its synchronization.

| Need                           | Use                                                 |
| ------------------------------ | --------------------------------------------------- |
| sync code, low contention      | `std::sync::Mutex<T>`                               |
| sync code, read-heavy          | `std::sync::RwLock<T>` or `parking_lot::RwLock<T>`  |
| **async code, any contention** | `tokio::sync::Mutex<T>` or `tokio::sync::RwLock<T>` |
| sync, faster + no poisoning    | `parking_lot::Mutex<T>` / `RwLock<T>`               |

`parking_lot` lacks `lock().unwrap()` ceremony — guards are unpoisoned, smaller,
faster. Prefer it for sync state.

## The async deadlock — never `std::sync::Mutex` across `.await`

```rust
// BROKEN — will deadlock under load
#[tauri::command]
async fn bad(state: State<'_, std::sync::Mutex<Cache>>) -> Result<(), String> {
    let mut guard = state.lock().unwrap();
    some_async_io().await;   // tokio may park this task and resume on a
    guard.insert(...);       // different thread; another task holding the
    Ok(())                   // same mutex on this thread now can't progress
}
```

Two fixes, in order of preference:

1. **Drop the guard before awaiting:**

   ```rust
   let value = { state.lock().unwrap().get_cheap_copy() };
   some_async_io(value).await;
   ```

2. **Use `tokio::sync::Mutex`** — its `lock().await` is async-aware and safe
   to hold across `.await`.

`clippy::await_holding_lock` catches case 1; enable it.

## Multiple state types coexist

Each Rust type is a separate slot. Compose deliberately:

```rust
app.manage(HttpClient::new());
app.manage(DbPool::open(&path)?);
app.manage(tokio::sync::Mutex::new(JobQueue::default()));

#[tauri::command]
async fn enqueue(
    db: State<'_, DbPool>,
    jobs: State<'_, tokio::sync::Mutex<JobQueue>>,
) -> Result<(), AppError> {
    db.record_enqueue().await?;
    jobs.lock().await.push(Job::new());
    Ok(())
}
```

A common anti-pattern is one mega-`AppState` struct with ten `Mutex`es inside.
Split by access pattern — anything written from a background task wants its own
lock so commands don't contend with the writer.

## Nested state and `Arc`

If something needs to live in both managed state *and* a background task
without going through `AppHandle::state` each time, wrap it in `Arc` and clone:

```rust
#[derive(Clone)]
struct AppState {
    cache: Arc<tokio::sync::RwLock<Cache>>,
    metrics: Arc<parking_lot::Mutex<Metrics>>,
}
```

`AppState` itself is `Clone` and cheap; the inner `Arc`s share storage. This is
the idiomatic shape — see `templates/state.rs`.

## Templates

- `templates/state.rs` — full example: nested `AppState` with `tokio::Mutex` +
  `parking_lot::RwLock`, registered in `setup`, accessed from a command and a
  spawned task. Drop into `src-tauri/src/`.

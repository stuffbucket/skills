---
name: tauri-commands-async-patterns
description: Use when writing async Tauri v2 commands — deciding when a command should be `async fn`, spawning background tasks that outlive the command via `tokio::spawn` + cloned `AppHandle`, cancellable long-running work with `tokio::select!` + `CancellationToken`, streaming progress via `Channel` instead of polling, and avoiding deadlock anti-patterns (std-mutex across `.await`, holding guards across awaits).
---

# Tauri v2 — Commands: Async Patterns

Tauri runs commands on tokio. Making a command `async fn` is free at the syntax
level — the macro handles it — but the design implications are not. This skill
covers when to go async, how to spawn work that outlives the IPC call, how to
make that work cancellable, and how to stream progress without polling.

See [[tauri-commands]] for the basics, [[tauri-commands-state-injection]] for
the `tokio::Mutex` rule this skill leans on, [[tauri-events]] for the
event-vs-Channel decision.

## When to make a command `async`

Make it `async fn` when the command performs **any** of:

- file I/O via `tokio::fs`
- network I/O (`reqwest`, sockets, sidecar IPC)
- sleeping / timers (`tokio::time::sleep`)
- awaiting another async API (DB drivers, plugin calls)

Keep it sync when the body is pure CPU work under a millisecond. CPU-heavy sync
work in an async command will block a tokio worker — wrap with
`tokio::task::spawn_blocking` instead.

`#[tauri::command]` works on `async fn` directly:

```rust
#[tauri::command]
async fn fetch_user(id: u64, client: tauri::State<'_, reqwest::Client>) -> Result<User, AppError> {
    let r = client.get(format!("https://api.example.com/u/{id}")).send().await?;
    Ok(r.json::<User>().await?)
}
```

JS-side `invoke()` already returns a Promise — there's no calling-convention
difference between sync and async commands.

## Background tasks that outlive the command

A common need: command kicks off work, returns immediately, work continues.
The pattern is `tokio::spawn` with a cloned `AppHandle`:

```rust
#[tauri::command]
async fn start_sync(app: tauri::AppHandle) -> Result<(), AppError> {
    let app = app.clone();  // AppHandle is Arc-internally, cheap to clone
    tokio::spawn(async move {
        if let Err(e) = run_sync(&app).await {
            tracing::error!(error = ?e, "background sync failed");
        }
    });
    Ok(())  // returns before run_sync finishes
}
```

**Do not** capture `State<'_, T>` into the spawned future — the lifetime is the
command's, not 'static. Instead capture the `AppHandle` and re-fetch state
inside the task: `let state = app.state::<MyState>();`.

## Cancellation — `CancellationToken` + `tokio::select!`

Long-running tasks need a stop button. Use `tokio_util::sync::CancellationToken`
parked in managed state:

```rust
use tokio_util::sync::CancellationToken;

#[derive(Default)]
pub struct Jobs {
    pub current: tokio::sync::Mutex<Option<CancellationToken>>,
}

#[tauri::command]
async fn start_job(app: AppHandle, jobs: State<'_, Jobs>) -> Result<(), AppError> {
    let token = CancellationToken::new();
    *jobs.current.lock().await = Some(token.clone());
    let app = app.clone();
    tokio::spawn(async move {
        tokio::select! {
            _ = token.cancelled() => tracing::info!("job cancelled"),
            r = do_work(&app)     => if let Err(e) = r {
                tracing::error!(error = ?e, "job failed");
            }
        }
    });
    Ok(())
}

#[tauri::command]
async fn cancel_job(jobs: State<'_, Jobs>) -> Result<(), AppError> {
    if let Some(t) = jobs.current.lock().await.take() {
        t.cancel();
    }
    Ok(())
}
```

`CancellationToken::cancel()` is fire-and-forget — multiple holders can poll
`cancelled()` from anywhere in the task tree. Child tokens via
`token.child_token()` propagate cancellation down a hierarchy.

For pure timeouts, `tokio::time::timeout(dur, fut)` is simpler.

## Streaming progress — `Channel<T>` beats polling

For "task running, push updates to JS", prefer `tauri::ipc::Channel<T>` over
`emit`+`listen` events. Channels are:

- typed per-call (no global event-name collisions)
- backpressured per-receiver
- automatically cleaned up when JS drops the channel

```rust
#[derive(Clone, serde::Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum Progress {
    Started   { total: u64 },
    Tick      { done: u64 },
    Finished,
    Failed    { message: String },
}

#[tauri::command]
async fn process(
    paths: Vec<String>,
    on_event: tauri::ipc::Channel<Progress>,
) -> Result<(), AppError> {
    let total = paths.len() as u64;
    on_event.send(Progress::Started { total }).ok();
    for (i, p) in paths.iter().enumerate() {
        do_one(p).await?;
        on_event.send(Progress::Tick { done: (i + 1) as u64 }).ok();
    }
    on_event.send(Progress::Finished).ok();
    Ok(())
}
```

JS side:

```ts
import { Channel, invoke } from '@tauri-apps/api/core';
const ch = new Channel<Progress>();
ch.onmessage = (msg) => { /* dispatch on msg.type */ };
await invoke('process', { paths, onEvent: ch });
```

Use `emit`/`listen` only when multiple windows or unrelated consumers need the
same stream. For single-caller progress, channel.

## Anti-patterns

### `std::sync::Mutex` held across `.await`

Covered in [[tauri-commands-state-injection]] — the textbook cause of
sporadic, load-dependent deadlocks. `clippy::await_holding_lock` catches it;
turn it on in `Cargo.toml`:

```toml
[lints.clippy]
await_holding_lock = "deny"
```

### Holding even a `tokio::Mutex` guard longer than needed

`tokio::Mutex` is safe across awaits but **slow**. Pattern: extract the data,
drop the guard, await on the data.

```rust
// SLOW — serializes every concurrent caller behind the network round-trip
let mut q = state.queue.lock().await;
let r = http_post(&q.endpoint).await?;
q.history.push(r);

// FAST — lock only what needs the lock
let endpoint = { state.queue.lock().await.endpoint.clone() };
let r = http_post(&endpoint).await?;
state.queue.lock().await.history.push(r);
```

### Spawning without capturing `AppHandle`

You can't `app.state::<T>()` from a detached `tokio::spawn` without an
`AppHandle`. Always clone it before the spawn boundary.

### CPU work in an `async fn`

Blocks the tokio worker thread. Wrap with `spawn_blocking`:

```rust
let result = tokio::task::spawn_blocking(move || expensive_pure_cpu(input)).await?;
```

## Templates

- `templates/async-task.rs` — cancellable long-running command with
  `CancellationToken` in state, `tokio::select!` cancellation, and a
  `Channel<Progress>` for live updates. Drop into `src-tauri/src/`.

---
name: tauri-sidecar-lifecycle
description: Use when managing the lifetime of a sidecar child in a Tauri v2 app — stashing `CommandChild` in `Mutex`Option...`` managed state, draining `CommandEvent::{Stdout,Stderr,Terminated,Error}` on a `tokio::spawn` receiver, supervised restart-on-crash with exponential backoff, killing on `RunEvent::ExitRequested` (and the Windows `taskkill /T /F /PID` escalation when grandchildren survive), choosing graceful SIGTERM vs immediate SIGKILL, and HTTP health-check polling against the sidecar's port.
---

# Tauri v2 — Sidecar Lifecycle

Tauri spawns sidecars; it does **not** supervise them. Crash detection,
restart, signal handling, kill-on-exit — all yours. This skill is the
playbook for keeping the child process honest from `setup` to
`ExitRequested`.

See [[tauri-sidecar]] for spawn basics and [[tauri-sidecar-node-sidecar]]
for the Node/Bun-specific bits.

## The minimum viable structure

You need one piece of managed state: a slot that holds the live
`CommandChild`, plus a way to tell whether you're shutting down (so the
receiver task doesn't try to restart during a clean exit):

```rust
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use tauri_plugin_shell::process::CommandChild;
use tokio::sync::Mutex;

pub struct Sidecar {
    pub child: Mutex<Option<CommandChild>>,
    pub shutting_down: AtomicBool,
}

impl Sidecar {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            child: Mutex::new(None),
            shutting_down: AtomicBool::new(false),
        })
    }
}
```

Register in `setup`, spawn the child, hand the `rx` stream to a Tokio
task. The full pattern lives in `templates/lifecycle.rs`; the key shape
is:

```rust
.setup(|app| {
    let state = Sidecar::new();
    app.manage(state.clone());
    spawn_supervised(app.handle().clone(), state);
    Ok(())
})
```

## Draining the event stream

`shell().sidecar("name")?.spawn()?` returns `(rx, child)`. The `rx` is a
Tokio `mpsc::Receiver<CommandEvent>` — you **must** drive it on a task,
or the OS pipes back up and the sidecar blocks on stdout.

```rust
tauri::async_runtime::spawn(async move {
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) => {
                // structured-log the line; parse if NDJSON
            }
            CommandEvent::Stderr(line) => {
                eprintln!("[sidecar:err] {}", String::from_utf8_lossy(&line));
            }
            CommandEvent::Error(msg) => {
                // pipe IO error, not a process exit
                eprintln!("[sidecar:pipe-err] {msg}");
            }
            CommandEvent::Terminated(payload) => {
                eprintln!("[sidecar] exited code={:?} signal={:?}",
                          payload.code, payload.signal);
                break;   // loop exit ⇒ child handle is gone
            }
            _ => {}
        }
    }
    // Reached when sidecar dies. Trigger restart here if not shutting down.
});
```

`CommandEvent` is non-exhaustive — match a catch-all `_ =>` so a future
variant doesn't break compilation.

## Crash-restart with backoff

A long-running sidecar will occasionally die. Restart it, but cap the
attempt rate so a crashloop doesn't burn CPU. Exponential backoff capped
at ~30 s is the standard shape:

```rust
let mut delay_ms: u64 = 250;
loop {
    if state.shutting_down.load(Ordering::SeqCst) { break; }
    match app.shell().sidecar("myproxy") {
        Ok(cmd) => match cmd.args(["--port", "4142"]).spawn() {
            Ok((rx, child)) => {
                *state.child.lock().await = Some(child);
                drain(rx).await;                 // returns when child exits
                *state.child.lock().await = None;
                delay_ms = 250;                  // reset backoff after a clean run
            }
            Err(e) => eprintln!("[sidecar] spawn failed: {e}"),
        },
        Err(e) => eprintln!("[sidecar] resolve failed: {e}"),
    }
    if state.shutting_down.load(Ordering::SeqCst) { break; }
    tokio::time::sleep(Duration::from_millis(delay_ms)).await;
    delay_ms = (delay_ms * 2).min(30_000);
}
```

Reset the delay only after the child ran long enough to count as
"healthy" — `templates/lifecycle.rs` uses a 30 s uptime threshold so a
sidecar that crashes immediately on every start doesn't keep ramming the
restart loop with delay=250 ms.

## Kill on exit — the cardinal rule

Without this code, **every** sidecar leaks on macOS when the user quits
the app. Tauri's window-close does not propagate to children.

```rust
tauri::Builder::default()
    .setup(/* ... */)
    .build(tauri::generate_context!())?
    .run(|handle, event| {
        if matches!(event, RunEvent::ExitRequested { .. }) {
            let state = handle.state::<Arc<Sidecar>>().inner().clone();
            state.shutting_down.store(true, Ordering::SeqCst);
            tauri::async_runtime::block_on(async move {
                if let Some(child) = state.child.lock().await.take() {
                    let _ = child.kill();
                }
            });
        }
    });
```

Three details that catch people:

1. `Option::take()` consumes the handle. A second `ExitRequested`
   (Tauri can fire it more than once across windows) finds `None` and
   becomes a no-op — desired.
2. Set `shutting_down` **before** kill. Otherwise the receiver task sees
   `Terminated` and tries to restart against a state that's tearing down.
3. `block_on` is correct here. `ExitRequested` runs on the main thread;
   we want kill to complete before Tauri proceeds to `Exit`.

## Graceful SIGTERM vs SIGKILL

`CommandChild::kill()` is `SIGTERM` on POSIX (TerminateProcess on Win).
For a JS/Bun/Node sidecar that's enough — the runtime exits its loop
and runs shutdown hooks. For a Rust sidecar you wrote, install a
`tokio::signal` handler:

```rust
tokio::select! {
    _ = tokio::signal::ctrl_c() => {}
    _ = sigterm() => {}
    _ = server.serve() => {}
}
```

If the child holds resources that need flushing (sqlite WAL, open
sockets), you may want a two-stage shutdown:

1. `child.kill()` → wait up to 5 s for `Terminated`.
2. If not exited, escalate. On POSIX, kill the same PID with `SIGKILL`;
   on Windows, `taskkill /T /F /PID <pid>` (the `/T` is critical — it
   walks child processes; raw `TerminateProcess` only kills the direct
   PID and orphans grandchildren).

`templates/lifecycle.rs` shows the escalation. PID lookup is via
`CommandChild::pid()`.

## Windows: the grandchild-orphan trap

When your sidecar spawns its own children (e.g., a Node sidecar that
forks workers), `kill()` on the immediate child does **not** kill the
grandchildren. The workers become reparented to PID 1 / `services.exe`
and leak forever.

Two fixes:

- **Job objects** (preferred): create a Windows Job Object, assign
  the sidecar to it with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`. Killing
  the job kills the whole tree. Use the `windows` crate.
- **`taskkill /T`** (simpler, less robust): after `kill()` times out,
  shell out:

```rust
#[cfg(windows)]
fn taskkill_tree(pid: u32) {
    let _ = std::process::Command::new("taskkill")
        .args(["/T", "/F", "/PID", &pid.to_string()])
        .status();
}
```

## Healthcheck pattern

If the sidecar is an HTTP server, "process alive" doesn't mean "ready
to serve". Poll its health endpoint after spawn before treating it as
up:

```rust
async fn wait_ready(port: u16) -> Result<(), &'static str> {
    let deadline = Instant::now() + Duration::from_secs(10);
    let url = format!("http://127.0.0.1:{port}/_health");
    while Instant::now() < deadline {
        if reqwest::get(&url).await.is_ok_and(|r| r.status().is_success()) {
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    Err("sidecar not healthy in 10s")
}
```

Emit a Tauri event when ready so the WebView can stop showing a spinner.
For the inverse case — sidecar was healthy and went silent — a periodic
poll (every 5–10 s) can pre-empt a wedge that hasn't actually crashed
yet. On three failures, force-kill and let restart logic take over.

## Verification

1. Launch the app; sidecar comes up; WebView functions.
2. `kill -9 <sidecar-pid>` from another terminal — backoff restart fires,
   WebView recovers.
3. Quit the app via menu/⌘Q. `ps aux | grep <name>` is empty.
4. Force-quit the Tauri shell (`kill -9` the app PID). Sidecar **will**
   orphan in this case — there's no way around it without an OS-level
   process group. Document it.
5. On Windows: spawn a sidecar that forks workers, quit the app, check
   Task Manager for orphans. If any, you need the job-object fix.

## Gotchas

- **Don't hold a `std::sync::Mutex` across `.await`.** Use Tokio's.
  This is the #1 sidecar-state deadlock — see
  [[tauri-commands-state-injection]].
- **`spawn()` is fallible.** "Binary not found" usually means the
  triple suffix is wrong; "not allowed" means the capability is
  missing — see [[tauri-sidecar-target-triples]] and [[tauri-security-scopes]].
- **`rx.recv().await` returning `None`** ≠ child exited cleanly; it
  just means all senders dropped. Always pair with a `Terminated` match
  for the actual exit info.
- **Backoff state should live in the supervisor task**, not the managed
  `Sidecar`. Sharing it across attempts in state leads to off-by-one
  reset bugs after a clean run.
- **Don't `tokio::spawn` the supervisor from a sync context** without
  `tauri::async_runtime` — the default Tokio runtime is not
  guaranteed to be active in `setup`. Use `tauri::async_runtime::spawn`.

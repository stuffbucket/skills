// Spawn a Tauri v2 sidecar with kill-on-exit lifecycle.
//
// Pattern:
//   1. Wrap the CommandChild in managed state so we can reach it from
//      the RunEvent loop later.
//   2. Spawn the sidecar in setup() and store the child.
//   3. Drain the CommandEvent channel on a Tokio task.
//   4. On RunEvent::ExitRequested, take() the child and kill() it.
//
// Wrap CommandChild in Mutex<Option<...>> because:
//   - Tauri's managed-state API requires Send + Sync.
//   - kill() consumes the handle; Option::take() makes a second call
//     a harmless no-op.

use std::sync::Mutex;
use tauri::{Manager, RunEvent};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

struct Sidecar(Mutex<Option<CommandChild>>);

impl Sidecar {
    fn new() -> Self {
        Self(Mutex::new(None))
    }
    fn set(&self, child: CommandChild) {
        *self.0.lock().expect("sidecar mutex poisoned") = Some(child);
    }
    fn take(&self) -> Option<CommandChild> {
        self.0.lock().expect("sidecar mutex poisoned").take()
    }
}

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(Sidecar::new())
        .setup(|app| {
            // sidecar("myproxy") resolves bundle.externalBin[i] = "binaries/myproxy"
            // and picks the triple-suffixed file at build time.
            let (mut rx, child) = app
                .shell()
                .sidecar("myproxy")?
                .args(["--port", "4142"])
                .env("RUST_LOG", "info")
                .spawn()
                .map_err(|e| tauri::Error::Anyhow(e.into()))?;

            app.state::<Sidecar>().set(child);

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            println!("[sidecar] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            eprintln!("[sidecar] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Terminated(payload) => {
                            eprintln!("[sidecar] exited: {payload:?}");
                            // Optional: emit an event so the UI can show
                            // a "sidecar crashed" state.
                            let _ = handle.emit("sidecar:terminated", payload);
                            break;
                        }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // Single kill site. The tray's "Quit" handler just calls
    // app.exit(0), which fires ExitRequested.
    app.run(|handle, event| {
        if let RunEvent::ExitRequested { .. } = event {
            if let Some(child) = handle.state::<Sidecar>().take() {
                // SIGTERM on POSIX, TerminateProcess on Windows.
                let _ = child.kill();
            }
        }
    });
}

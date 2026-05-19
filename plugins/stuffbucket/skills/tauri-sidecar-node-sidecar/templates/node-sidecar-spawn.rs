//! Spawn a Node/Bun sidecar and talk to it over stdio with newline-delimited JSON.
//!
//! Pattern: each request gets an integer `id`; the sidecar echoes the same `id`
//! in its response. A `HashMap<u64, oneshot::Sender<Value>>` correlates them.
//!
//! For HTTP-server-style sidecars, prefer plain `fetch()` from the WebView
//! and skip this file — see the SKILL's pattern A.

use std::{collections::HashMap, sync::Arc, time::Duration};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager, RunEvent};
use tauri_plugin_shell::{ShellExt, process::{CommandChild, CommandEvent}};
use tokio::{sync::{oneshot, Mutex}, time::timeout};

pub struct NodeSidecar {
    child: Mutex<Option<CommandChild>>,
    pending: Mutex<HashMap<u64, oneshot::Sender<Value>>>,
    next_id: std::sync::atomic::AtomicU64,
}

impl NodeSidecar {
    pub fn new() -> Self {
        Self {
            child: Mutex::new(None),
            pending: Mutex::new(HashMap::new()),
            next_id: std::sync::atomic::AtomicU64::new(1),
        }
    }

    pub fn install(app: &AppHandle) -> tauri::Result<()> {
        let (mut rx, child) = app.shell().sidecar("mytool")?.spawn()?;

        let state = Arc::new(NodeSidecar::new());
        *state.child.try_lock().unwrap() = Some(child);
        app.manage(state.clone());

        // Reader task: parses each stdout line as `{ "id": N, ... }` and
        // routes it to the matching oneshot.
        tauri::async_runtime::spawn(async move {
            while let Some(ev) = rx.recv().await {
                match ev {
                    CommandEvent::Stdout(line) => {
                        let Ok(v) = serde_json::from_slice::<Value>(&line) else {
                            eprintln!("[sidecar] non-JSON stdout: {:?}", line);
                            continue;
                        };
                        let Some(id) = v.get("id").and_then(Value::as_u64) else {
                            continue;
                        };
                        if let Some(tx) = state.pending.lock().await.remove(&id) {
                            let _ = tx.send(v);
                        }
                    }
                    CommandEvent::Stderr(line) => {
                        eprintln!("[sidecar:err] {}", String::from_utf8_lossy(&line));
                    }
                    CommandEvent::Terminated(p) => {
                        eprintln!("[sidecar] terminated: code={:?} signal={:?}",
                                  p.code, p.signal);
                        break;
                    }
                    _ => {}
                }
            }
        });
        Ok(())
    }

    /// Send a request, await the matching response.
    pub async fn request(&self, op: &str, payload: Value) -> Result<Value, String> {
        let id = self.next_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let (tx, rx) = oneshot::channel();
        self.pending.lock().await.insert(id, tx);

        let line = serde_json::to_vec(&json!({ "id": id, "op": op, "payload": payload }))
            .map_err(|e| e.to_string())?;
        let mut buf = line;
        buf.push(b'\n');

        let mut guard = self.child.lock().await;
        let child = guard.as_mut().ok_or("sidecar not running")?;
        child.write(&buf).map_err(|e| e.to_string())?;
        drop(guard);

        match timeout(Duration::from_secs(30), rx).await {
            Ok(Ok(v)) => Ok(v),
            Ok(Err(_)) => Err("sidecar dropped reply channel".into()),
            Err(_) => {
                self.pending.lock().await.remove(&id);
                Err("sidecar timeout".into())
            }
        }
    }

    /// Best-effort kill. Idempotent.
    pub async fn kill(&self) {
        if let Some(child) = self.child.lock().await.take() {
            let _ = child.kill();
        }
    }
}

/// Wire into `tauri::Builder::default().setup(...).build(...).run(|app, ev| ...)`.
pub fn handle_exit(app: &AppHandle, event: &RunEvent) {
    if matches!(event, RunEvent::ExitRequested { .. }) {
        let state = app.state::<Arc<NodeSidecar>>().inner().clone();
        tauri::async_runtime::block_on(async move { state.kill().await });
    }
}

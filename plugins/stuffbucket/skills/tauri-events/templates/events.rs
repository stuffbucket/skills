// Tauri v2 — events and channels reference handler.
//
// Wire into your builder:
//   tauri::Builder::default()
//     .invoke_handler(tauri::generate_handler![
//       broadcast_status,
//       notify_window,
//       run_task,
//     ])

use serde::Serialize;
use tauri::{ipc::Channel, AppHandle, Emitter, EventTarget, Listener};

// ---------- Global event ----------

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusChanged {
  pub state: String,
  pub at_ms: u64,
}

#[tauri::command]
pub fn broadcast_status(app: AppHandle, state: String) -> Result<(), String> {
  let payload = StatusChanged {
    state,
    at_ms: std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .map(|d| d.as_millis() as u64)
      .unwrap_or(0),
  };
  // Broadcast to every webview that listens for "status-changed".
  app.emit("status-changed", payload).map_err(|e| e.to_string())
}

// ---------- Targeted emit ----------

#[tauri::command]
pub fn notify_window(app: AppHandle, label: String, message: String) -> Result<(), String> {
  // Only the webview with the given label receives this.
  app
    .emit_to(EventTarget::webview_window(&label), "notice", message)
    .map_err(|e| e.to_string())
}

// ---------- Channel streaming ----------

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum ProgressEvent {
  Started { total: u64 },
  Tick { done: u64 },
  Finished { ok: bool },
}

#[tauri::command]
pub async fn run_task(
  total: u64,
  on_event: Channel<ProgressEvent>,
) -> Result<(), String> {
  on_event
    .send(ProgressEvent::Started { total })
    .map_err(|e| e.to_string())?;

  for i in 1..=total {
    // Imagine real work here; channels handle high-frequency sends.
    on_event
      .send(ProgressEvent::Tick { done: i })
      .map_err(|e| e.to_string())?;
  }

  on_event
    .send(ProgressEvent::Finished { ok: true })
    .map_err(|e| e.to_string())?;
  Ok(())
}

// ---------- Rust-side listener (e.g. in setup) ----------

pub fn wire_internal_listeners(app: &AppHandle) {
  let id = app.listen("frontend-ready", |event| {
    println!("frontend says: {}", event.payload());
  });
  // Keep `id` if you need to call app.unlisten(id) later.
  let _ = id;

  app.once("first-paint", |_event| {
    println!("first paint observed");
  });
}

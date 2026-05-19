// Drop-in: managed state with nested locks, registered in `setup`,
// consumed from a command and a background tokio task.
//
// Cargo.toml needs:
//   tokio = { version = "1", features = ["sync", "rt-multi-thread", "macros"] }
//   parking_lot = "0.12"
//   serde = { version = "1", features = ["derive"] }

use std::collections::HashMap;
use std::sync::Arc;

use parking_lot::RwLock;
use serde::Serialize;
use tauri::{AppHandle, Manager, State};
use tokio::sync::Mutex as AsyncMutex;

/// What the rest of the app sees. Cheap to `clone()` — the Arcs share storage.
#[derive(Clone, Default)]
pub struct AppState {
    /// Anything touched across `.await` lives behind a tokio Mutex.
    pub cache: Arc<AsyncMutex<HashMap<String, String>>>,
    /// Sync-only, hot-read counters live behind a parking_lot RwLock.
    pub metrics: Arc<RwLock<Metrics>>,
}

#[derive(Default, Clone, Serialize)]
pub struct Metrics {
    pub hits: u64,
    pub misses: u64,
}

// ---- commands -------------------------------------------------------------

#[tauri::command]
pub async fn cache_get(
    key: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    // Hold the async lock across the (trivial) await — safe with tokio::Mutex.
    let map = state.cache.lock().await;
    let value = map.get(&key).cloned();

    // Drop the async guard before touching the sync lock to keep critical
    // sections small. (Not required for correctness here, just hygiene.)
    drop(map);

    let mut metrics = state.metrics.write();
    if value.is_some() {
        metrics.hits += 1;
    } else {
        metrics.misses += 1;
    }

    Ok(value)
}

#[tauri::command]
pub fn metrics_snapshot(state: State<'_, AppState>) -> Metrics {
    // Sync command — parking_lot's read guard is fine here.
    state.metrics.read().clone()
}

// ---- registration ---------------------------------------------------------

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // `manage` BEFORE the first window loads. `setup` is the place.
            app.manage(AppState::default());

            // Hand a clone to a background task — AppHandle is cheap to clone.
            let app_handle: AppHandle = app.handle().clone();
            tokio::spawn(async move {
                let state = app_handle.state::<AppState>();
                let mut map = state.cache.lock().await;
                map.insert("warmup".into(), "ready".into());
                // Lock drops at end of scope; the spawned task exits.
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![cache_get, metrics_snapshot])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

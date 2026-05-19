//! Pure-Rust splashscreen orchestration.
//!
//! `setup` returns immediately so the splash window paints. A spawned tokio
//! task runs the real init steps (DB migration, sidecar warmup, config load).
//! When init finishes — successfully or not — the main window is shown and
//! the splash is closed in the correct order to avoid a wallpaper flash.
//!
//! Drop into `src-tauri/src/lib.rs`.

use tauri::{async_runtime::spawn, AppHandle, Manager};
use tokio::time::{sleep, Duration};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            spawn(async move {
                let result = init(&handle).await;
                if let Err(err) = &result {
                    eprintln!("[splash] init failed: {err:?}");
                    // In production: emit a `splash://error` event so the
                    // splash window can show a retry button instead of closing.
                }
                swap_to_main(&handle);
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Show main first, then close splash. Reversing this order causes a brief
/// flash of desktop wallpaper while the main window paints.
fn swap_to_main(app: &AppHandle) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.close();
    }
}

async fn init(app: &AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Step 1: filesystem readiness
    let data_dir = app.path().app_data_dir()?;
    tokio::fs::create_dir_all(&data_dir).await?;

    // Step 2: DB migrations (placeholder — call your real migrator)
    run_migrations(&data_dir).await?;

    // Step 3: warm a sidecar / load config / check license
    sleep(Duration::from_millis(400)).await; // placeholder for real work

    // Never: std::thread::sleep — it would park the tokio worker thread.

    Ok(())
}

async fn run_migrations(_data_dir: &std::path::Path) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // e.g. sqlx::migrate!().run(&pool).await?;
    Ok(())
}

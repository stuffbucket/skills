// update-flow.rs — Rust-side equivalent of update-ui.ts.
//
// Use this when the check is driven from Rust (tray menu, background task,
// command invoked from JS that doesn't want to ferry progress events through
// the IPC boundary). For a UI-driven flow, prefer the JS API.
//
// Cargo.toml:
//   tauri-plugin-updater = "2"
//   tauri-plugin-process = "2"
//   tokio = { version = "1", features = ["full"] }
//   semver = "1"

use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_updater::{Update, UpdaterExt};

const MANDATORY_TAG: &str = "[MANDATORY]";

pub fn init(app: tauri::Builder<Wry>) -> tauri::Builder<Wry> {
    app.plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_updater::Builder::new()
                // Custom comparator: betas accept other betas; stable accepts only stable+.
                .version_comparator(|current, update| {
                    let current_is_beta = current.pre.as_str().contains("beta");
                    let update_is_beta = update.pre.as_str().contains("beta");
                    if current_is_beta {
                        update.version >= current
                    } else if update_is_beta {
                        false // stable users don't get pushed to betas
                    } else {
                        update.version > current
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![check_and_install])
}

/// Tauri command — call from JS as `invoke('check_and_install')` to drive the
/// whole flow from Rust. Use this when JS shouldn't see the progress stream
/// (e.g. background tray-only check).
#[tauri::command]
async fn check_and_install(app: AppHandle) -> Result<UpdateOutcome, String> {
    match app.updater().map_err(stringify)?.check().await {
        Ok(Some(update)) => {
            let mandatory = update.body.as_deref().unwrap_or("").contains(MANDATORY_TAG);
            install_update(app, update, mandatory).await
        }
        Ok(None) => Ok(UpdateOutcome::NoUpdate),
        Err(e) => Err(stringify(e)),
    }
}

#[derive(serde::Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum UpdateOutcome {
    NoUpdate,
    Installed { version: String, mandatory: bool },
}

async fn install_update(
    app: AppHandle,
    update: Update,
    mandatory: bool,
) -> Result<UpdateOutcome, String> {
    let version = update.version.clone();
    let mut downloaded = 0u64;

    update
        .download_and_install(
            |chunk_length, content_length| {
                downloaded += chunk_length as u64;
                // Emit to JS for any window listening to update-progress.
                let payload = serde_json::json!({
                    "downloaded": downloaded,
                    "contentLength": content_length,
                });
                let _ = app.emit("update-progress", payload);
            },
            || {
                let _ = app.emit("update-finished", ());
            },
        )
        .await
        .map_err(stringify)?;

    // Defer restart by ~500ms so the JS side can show "installed, restarting".
    let app_clone = app.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        app_clone.restart();
    });

    Ok(UpdateOutcome::Installed { version, mandatory })
}

/// Background task — spawn from `setup` to check on a schedule without
/// blocking anything else.
pub fn spawn_periodic_check(app: AppHandle) {
    tokio::spawn(async move {
        // Initial delay so we don't compete with cold start.
        tokio::time::sleep(std::time::Duration::from_secs(30)).await;
        loop {
            if let Ok(updater) = app.updater() {
                if let Ok(Some(update)) = updater.check().await {
                    // Emit to JS — let the UI decide whether to prompt.
                    let payload = serde_json::json!({
                        "version": update.version.to_string(),
                        "currentVersion": update.current_version,
                        "notes": update.body.clone().unwrap_or_default(),
                    });
                    let _ = app.emit("update-available", payload);
                }
            }
            // Next check in 6 hours.
            tokio::time::sleep(std::time::Duration::from_secs(6 * 60 * 60)).await;
        }
    });
}

fn stringify<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

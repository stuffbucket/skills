// src-tauri/src/lib.rs
//
// Example Tauri v2 builder wiring several common official plugins.
// Pair with capabilities-plugins.json for the matching ACL grants.
//
// Plugins shown: opener, dialog, fs, store, notification, log.

use tauri_plugin_log::{Target, TargetKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Logging first so other plugins can use it during setup.
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: None }),
                    Target::new(TargetKind::Webview),
                ])
                .level(log::LevelFilter::Info)
                .build(),
        )
        // "Open URL / file with OS handler" — preferred over shell.open.
        .plugin(tauri_plugin_opener::init())
        // Native file pickers and OS dialogs.
        .plugin(tauri_plugin_dialog::init())
        // Scoped filesystem access. Scopes live on the permissions, not here.
        .plugin(tauri_plugin_fs::init())
        // JSON key/value persistence in the app data dir.
        .plugin(tauri_plugin_store::Builder::default().build())
        // OS notifications.
        .plugin(tauri_plugin_notification::init())
        .setup(|_app| {
            // App-specific setup. e.g. register a deep-link handler:
            //   #[cfg(desktop)]
            //   _app.handle().plugin(tauri_plugin_single_instance::init(
            //       |app, _argv, _cwd| { /* focus main window */ },
            //   ))?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![/* your #[command]s */])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

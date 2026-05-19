// src-tauri/src/lib.rs
use tauri::Manager;
use tauri_plugin_deep_link::DeepLinkExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // single-instance must be added BEFORE deep-link so cold-second-launches
        // get routed into the running process on Windows/Linux.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // Focus the main window.
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_focus();
                let _ = w.unminimize();
            }
            // Pick the deep-link URL out of argv on Windows/Linux.
            if let Some(url) = argv.iter().find(|a| a.starts_with("myapp://")) {
                let _ = app.emit("deep-link", url.clone());
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            // Cold-launch URL (mac/iOS/Android also surface this).
            if let Ok(Some(urls)) = app.deep_link().get_current() {
                println!("cold launch urls: {urls:?}");
            }

            // Live listener — on macOS this is the primary path; on Win/Linux the
            // single-instance hook above re-emits.
            let app_handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    let _ = app_handle.emit("deep-link", url.to_string());
                }
            });

            // Dev-only: register schemes at runtime so cargo-run works without bundling.
            #[cfg(all(desktop, debug_assertions))]
            {
                let _ = app.deep_link().register_all();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

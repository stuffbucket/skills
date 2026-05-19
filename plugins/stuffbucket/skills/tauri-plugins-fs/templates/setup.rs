// src-tauri/src/lib.rs
use tauri_plugin_fs::FsExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Extend scope at runtime — e.g. after the user picks a folder
            // via the dialog plugin. The capability JSON sets the static base;
            // this adds dynamic entries on top.
            let scope = app.fs_scope();
            scope.allow_directory("/opt/myapp/data", /* recursive */ true)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Cargo.toml — enable the `watch` feature for file watching:
//
// [dependencies]
// tauri-plugin-fs = { version = "2", features = ["watch"] }

// src-tauri/src/lib.rs
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Exec / sidecar.
        .plugin(tauri_plugin_shell::init())
        // Open URLs / files / reveal in dir.
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Cargo.toml:
//
// [dependencies]
// tauri-plugin-shell  = "2"
// tauri-plugin-opener = "2"
//
// For a sidecar, also add the binary to tauri.conf.json:
// "bundle": { "externalBin": ["binaries/proxy"] }
// and place `binaries/proxy-<target-triple>[.exe]` next to it.

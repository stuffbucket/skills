// src-tauri/src/lib.rs
use tauri_plugin_http::reqwest;

#[tauri::command]
async fn fetch_status(url: String) -> Result<u16, String> {
    // Rust-side requests go through reqwest directly; the capability scope
    // only applies to JS-initiated fetch(). Validate URLs here yourself if
    // they come from user input.
    let res = reqwest::Client::builder()
        .user_agent("MyApp/1.0")
        .connect_timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    Ok(res.status().as_u16())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![fetch_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Cargo.toml:
// [dependencies]
// tauri-plugin-http = "2"
// # Add `features = ["unsafe-headers"]` only if you need Origin/Cookie/etc.

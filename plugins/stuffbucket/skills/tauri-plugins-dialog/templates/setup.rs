// src-tauri/src/lib.rs
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

#[tauri::command]
async fn pick_image(app: tauri::AppHandle) -> Result<Option<String>, String> {
    // Async variant — does not block the runtime; resolves via callback.
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .add_filter("Images", &["png", "jpg", "jpeg", "webp"])
        .pick_file(move |path| {
            let _ = tx.send(path.map(|p| p.to_string()));
        });
    rx.await.map_err(|e| e.to_string())
}

#[tauri::command]
fn pick_image_blocking(app: tauri::AppHandle) -> Option<String> {
    // Blocking variant — pins the calling thread. Safe from a sync command,
    // not from the main event loop thread.
    app.dialog()
        .file()
        .add_filter("Images", &["png", "jpg"])
        .blocking_pick_file()
        .map(|p| p.to_string())
}

#[tauri::command]
fn alert(app: tauri::AppHandle, msg: String) {
    app.dialog()
        .message(msg)
        .title("MyApp")
        .kind(MessageDialogKind::Info)
        .blocking_show();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![pick_image, pick_image_blocking, alert])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

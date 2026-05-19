//! Multi-window helpers — dedup-by-label `open_or_focus`, parent-linked
//! child windows, and a close handler that hides instead of quitting.
//!
//! Drop into `src-tauri/src/` and register `open_detail` / `open_settings`
//! in your `invoke_handler!`.

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

/// Open `label` if missing, otherwise focus the existing window.
/// Use this whenever the user "opens" a window — never bare `build()`.
pub fn open_or_focus(
    app: &AppHandle,
    label: &str,
    url: WebviewUrl,
    configure: impl FnOnce(WebviewWindowBuilder) -> WebviewWindowBuilder,
) -> tauri::Result<()> {
    if let Some(existing) = app.get_webview_window(label) {
        let _ = existing.unminimize();
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(());
    }
    let builder = WebviewWindowBuilder::new(app, label, url);
    configure(builder).build()?;
    Ok(())
}

#[tauri::command]
pub async fn open_detail(app: AppHandle, id: String) -> Result<(), String> {
    let label = format!("detail-{id}");
    open_or_focus(
        &app,
        &label,
        WebviewUrl::App(format!("detail.html?id={id}").into()),
        |b| {
            let b = b.title(format!("Detail #{id}")).inner_size(800.0, 600.0);
            // Link to main for macOS modal-like z-order behavior
            if let Some(main) = app.get_webview_window("main") {
                b.parent(&main).unwrap_or_else(|_| WebviewWindowBuilder::new(
                    &app, &format!("detail-{id}-fallback"), WebviewUrl::App("detail.html".into())
                ))
            } else {
                b
            }
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_settings(app: AppHandle) -> Result<(), String> {
    open_or_focus(
        &app,
        "settings",
        WebviewUrl::App("settings.html".into()),
        |b| b.title("Settings").inner_size(600.0, 500.0).resizable(false),
    )
    .map_err(|e| e.to_string())
}

/// Install a close handler that hides instead of closing (menubar pattern).
/// Call from `setup` for any window that should survive the OS close button.
pub fn hide_on_close(app: &AppHandle, label: &str) -> tauri::Result<()> {
    let win = app
        .get_webview_window(label)
        .ok_or_else(|| tauri::Error::WindowNotFound)?;
    let win_clone = win.clone();
    win.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = win_clone.hide();
        }
    });
    Ok(())
}

/// Broadcast a payload to a specific window by label.
pub fn notify_window<S: serde::Serialize + Clone>(
    app: &AppHandle,
    label: &str,
    event: &str,
    payload: S,
) -> tauri::Result<()> {
    app.emit_to(label, event, payload)
}

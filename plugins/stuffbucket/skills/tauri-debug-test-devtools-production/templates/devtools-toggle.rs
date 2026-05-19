// src-tauri/src/devtools.rs
//
// Feature-gated devtools toggle. Builds to a no-op when the `devtools`
// Cargo feature is off (e.g. App Store builds, or release channels where
// you don't want the inspector available at all).
//
// Wire from lib.rs:
//
//   tauri::Builder::default()
//       .plugin(tauri_plugin_global_shortcut::Builder::new().build())
//       .setup(|app| {
//           crate::devtools::register(app.handle())?;
//           Ok(())
//       })
//       ...
//
// Capability (add to src-tauri/capabilities/default.json):
//   "permissions": ["global-shortcut:allow-register", "global-shortcut:allow-unregister"]

#[cfg(feature = "devtools")]
pub fn register(app: &tauri::AppHandle) -> tauri::Result<()> {
    use tauri::Manager;
    use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

    // Cmd+Alt+I on macOS, Ctrl+Shift+I elsewhere — matches the native inspector defaults.
    #[cfg(target_os = "macos")]
    let shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::ALT), Code::KeyI);
    #[cfg(not(target_os = "macos"))]
    let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyI);

    let app_handle = app.clone();
    app.global_shortcut().on_shortcut(shortcut, move |_app, _sc, event| {
        // Fire on press only; on_shortcut delivers both press and release.
        if event.state() != ShortcutState::Pressed {
            return;
        }
        let Some(window) = app_handle.get_webview_window("main") else {
            return;
        };
        if window.is_devtools_open() {
            window.close_devtools();
        } else {
            window.open_devtools();
        }
    })?;

    Ok(())
}

#[cfg(not(feature = "devtools"))]
pub fn register(_app: &tauri::AppHandle) -> tauri::Result<()> {
    // No-op: release builds compiled without devtools have no inspector to open.
    // is_devtools_open / open_devtools / close_devtools are gated on the same
    // Cargo feature in the tauri crate.
    Ok(())
}

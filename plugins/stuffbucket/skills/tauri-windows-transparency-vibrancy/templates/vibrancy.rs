//! Apply vibrancy / Mica / Acrylic to a transparent Tauri v2 window.
//!
//! Requires the window to have `transparent: true` in tauri.conf.json (and
//! usually `decorations: false`). Add the crate first:
//!
//!     cargo add window-vibrancy
//!
//! Then call `apply_window_effects(&window)` from your `setup` hook.

use tauri::{Manager, WebviewWindow};

#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

#[cfg(target_os = "windows")]
use window_vibrancy::{apply_acrylic, apply_blur, apply_mica};

/// Apply the best-available vibrancy effect for the host OS.
/// Silently no-ops on Linux (use CSS `backdrop-filter` instead).
pub fn apply_window_effects(window: &WebviewWindow) -> tauri::Result<()> {
    #[cfg(target_os = "macos")]
    {
        apply_vibrancy(
            window,
            NSVisualEffectMaterial::HudWindow,
            Some(NSVisualEffectState::Active),
            Some(12.0), // corner radius in points
        )
        .map_err(|e| tauri::Error::WebviewCreate(format!("vibrancy: {e:?}").into()))?;
    }

    #[cfg(target_os = "windows")]
    {
        // Try Mica (Win11 22H2+) → Acrylic (Win10 1809+) → Blur (Aero).
        // Pass `Some(true)` to force dark Mica; pass `None` to follow theme.
        if apply_mica(window, None).is_err() {
            if apply_acrylic(window, Some((18, 18, 18, 180))).is_err() {
                let _ = apply_blur(window, Some((18, 18, 18, 180)));
            }
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        // Linux compositors handle transparency themselves; rely on CSS
        // backdrop-filter for blur. Nothing to do here.
        let _ = window;
    }

    Ok(())
}

/// Convenience wrapper for use directly inside `setup`.
pub fn install(app: &tauri::App, label: &str) -> tauri::Result<()> {
    let window = app
        .get_webview_window(label)
        .ok_or(tauri::Error::WindowNotFound)?;
    apply_window_effects(&window)
}

// Example wiring:
//
// #[cfg_attr(mobile, tauri::mobile_entry_point)]
// pub fn run() {
//     tauri::Builder::default()
//         .setup(|app| {
//             install(app, "main")?;
//             Ok(())
//         })
//         .run(tauri::generate_context!())
//         .expect("error while running tauri application");
// }

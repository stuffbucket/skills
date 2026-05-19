// Tauri v2 — targeted emit reference for a multi-window app.
//
// Window layout assumed:
//   - "main"        : primary window
//   - "settings"    : preferences window
//   - "popup-*"     : transient popovers created on demand (e.g. "popup-toast-1")
//
// Wire into your builder:
//   tauri::Builder::default()
//     .invoke_handler(tauri::generate_handler![
//       push_config_to_settings,
//       broadcast_theme,
//       close_all_popups,
//     ])

use serde::Serialize;
use tauri::{AppHandle, Emitter, EventTarget};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
  pub auto_update: bool,
  pub telemetry: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Theme {
  pub accent_hex: String,
  pub mode: String, // "dark" | "light" | "system"
}

// 1. Single target: push to one named window.
#[tauri::command]
pub fn push_config_to_settings(app: AppHandle, config: AppConfig) -> Result<(), String> {
  app
    .emit_to("settings", "config-updated", config)
    .map_err(|e| e.to_string())
}

// 2. Multi-label set: hit main + settings, skip popups.
#[tauri::command]
pub fn broadcast_theme(app: AppHandle, theme: Theme) -> Result<(), String> {
  app
    .emit_to(
      EventTarget::labels(["main", "settings"]),
      "theme-changed",
      theme,
    )
    .map_err(|e| e.to_string())
}

// 3. Predicate target: close every popup, leave main/settings alone.
#[tauri::command]
pub fn close_all_popups(app: AppHandle) -> Result<(), String> {
  app
    .emit_filter("close-popups", (), |target| match target {
      EventTarget::WebviewWindow { label } => label.starts_with("popup-"),
      EventTarget::Webview { label } => label.starts_with("popup-"),
      _ => false,
    })
    .map_err(|e| e.to_string())
}

// 4. Broadcast for contrast — every listener app-wide.
pub fn announce_shutdown(app: &AppHandle) {
  let _ = app.emit("app-shutting-down", ());
}

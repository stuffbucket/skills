// src/mobile.rs
//
// The Rust half of the mobile bridge. Each method here serializes its args,
// hops over to Kotlin/Swift via PluginHandle::run_mobile_plugin, and
// deserializes the result. The function name string ("openCamera") MUST
// match the Kotlin @Command fun / Swift @objc func name exactly.
//
// Desktop has a parallel src/desktop.rs implementing the same surface in
// pure Rust; src/lib.rs picks one based on #[cfg(mobile)] / #[cfg(desktop)].

use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::models::*;

// iOS factory function (defined in Swift) — see ios/Sources/MyPlugin/MyPlugin.swift.
#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_my_plugin);

/// Initializes the mobile plugin. Called from the desktop/mobile shim in lib.rs.
pub fn init<R: Runtime, C: serde::de::DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<MyPlugin<R>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin("com.plugin.myplugin", "MyPlugin")?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_my_plugin)?;

    Ok(MyPlugin(handle))
}

/// The plugin's public Rust API. App code reaches this via the
/// MyPluginExt trait defined in lib.rs (e.g. `app.my_plugin().open_camera(...)`).
pub struct MyPlugin<R: Runtime>(pub(crate) PluginHandle<R>);

// ---------------------------------------------------------------------------
// Arg / result types. camelCase rename is critical — Android / iOS args are
// camelCase on the wire and the native side won't find snake_case fields.
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CameraRequest {
    pub quality: u32,
    pub allow_edit: bool,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct Photo {
    pub path: std::path::PathBuf,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionResponse {
    pub camera: tauri::plugin::PermissionState,
}

// ---------------------------------------------------------------------------
// API methods. One per native command. The string passed to run_mobile_plugin
// must match the @Command name on Android / @objc func name on iOS.
// ---------------------------------------------------------------------------

impl<R: Runtime> MyPlugin<R> {
    pub fn ping(&self) -> crate::Result<()> {
        self.0.run_mobile_plugin::<()>("ping", ()).map_err(Into::into)
    }

    pub fn open_camera(&self, payload: CameraRequest) -> crate::Result<Photo> {
        self.0
            .run_mobile_plugin("openCamera", payload)
            .map_err(Into::into)
    }

    /// Standard Tauri permission probe. Returns the current OS-level grant
    /// state for every alias the native plugin declares.
    pub fn check_permissions(&self) -> crate::Result<PermissionResponse> {
        self.0
            .run_mobile_plugin("checkPermissions", ())
            .map_err(Into::into)
    }

    /// Drives the OS consent dialog. On Android this maps to the @Permission
    /// strings declared on @TauriPlugin; on iOS it calls into the overridden
    /// requestPermissions(_:).
    pub fn request_permissions(&self) -> crate::Result<PermissionResponse> {
        self.0
            .run_mobile_plugin("requestPermissions", ())
            .map_err(Into::into)
    }
}

// src/scope.rs
//
// Lives in `src/` so the runtime crate can `use crate::scope::Entry` from
// command handlers, AND build.rs can `#[path = "src/scope.rs"] mod scope;`
// to feed it into `tauri_plugin::Builder::global_scope_schema(...)`.
//
// `schemars::JsonSchema` is what gives capability authors autocomplete in
// VS Code / RustRover when they write the `"scope"` array against your plugin.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// One entry in the plugin's global scope. Consumers list these under
/// `"scope": [ ... ]` in their capability files.
#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    /// Hostname the plugin is allowed to talk to. Wildcards permitted:
    /// `*.example.com` matches one label, `**.example.com` matches any depth.
    pub host: String,

    /// Optional port restriction. `None` means "any port".
    #[serde(default)]
    pub port: Option<u16>,
}

// Runtime usage from a command handler (do NOT include in this file; shown
// here for reference):
//
// use tauri::ipc::GlobalScope;
// use crate::scope::Entry;
//
// #[tauri::command]
// async fn fetch<R: tauri::Runtime>(
//     app: tauri::AppHandle<R>,
//     scope: GlobalScope<'_, Entry>,
//     url: String,
// ) -> crate::Result<String> {
//     let host = url::Url::parse(&url)?.host_str().unwrap_or("").to_string();
//     let allowed = scope.allows().iter().any(|e| host_matches(&e.host, &host));
//     if !allowed { return Err(crate::Error::ScopeDenied(host)); }
//     // ... perform request ...
//     Ok(String::new())
// }

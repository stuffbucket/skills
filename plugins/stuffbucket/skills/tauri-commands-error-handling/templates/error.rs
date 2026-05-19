// Production error type for Tauri v2 commands.
//
// Cargo.toml needs:
//   thiserror = "1"
//   serde     = { version = "1", features = ["derive"] }
//   tracing   = "0.1"

use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error("not found: {path}")]
    NotFound { path: String },

    #[error("unauthorized")]
    Auth,

    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("internal error: {0}")]
    Internal(String),
}

/// Stable JSON contract sent to JS. Add fields here freely — the internal
/// `AppError` can evolve independently.
#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum AppErrorWire<'a> {
    Io         { message: String },
    NotFound   { message: String, path: &'a str },
    Auth       { message: String },
    BadRequest { message: String },
    Internal   { message: String },
}

impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let message = self.to_string();
        let wire = match self {
            AppError::Io(_)              => AppErrorWire::Io         { message },
            AppError::NotFound { path }  => AppErrorWire::NotFound   { message, path },
            AppError::Auth               => AppErrorWire::Auth       { message },
            AppError::BadRequest(_)      => AppErrorWire::BadRequest { message },
            AppError::Internal(_)        => AppErrorWire::Internal   { message },
        };
        wire.serialize(s)
    }
}

/// Log the full error chain on the Rust side; the wire shape drops it.
/// Use at the top of every command body that returns `Result<_, AppError>`:
///
///     #[tauri::command]
///     fn do_thing() -> Result<(), AppError> {
///         logged("do_thing", || inner_do_thing())
///     }
pub fn logged<T, F: FnOnce() -> Result<T, AppError>>(
    op: &'static str,
    f: F,
) -> Result<T, AppError> {
    f().map_err(|e| {
        tracing::error!(op, error = ?e, "command failed");
        e
    })
}

// ---- example commands -----------------------------------------------------

#[tauri::command]
pub fn read_config(path: String) -> Result<serde_json::Value, AppError> {
    logged("read_config", || {
        if !std::path::Path::new(&path).exists() {
            return Err(AppError::NotFound { path });
        }
        let bytes = std::fs::read(&path)?;
        let json: serde_json::Value = serde_json::from_slice(&bytes)
            .map_err(|e| AppError::BadRequest(e.to_string()))?;
        Ok(json)
    })
}

/// Wrapping an unsafe / FFI call so a native panic doesn't kill the WebView.
#[tauri::command]
pub fn risky() -> Result<i32, AppError> {
    let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        // pretend this is FFI
        42
    }));
    r.map_err(|_| AppError::Internal("native call panicked".into()))
}

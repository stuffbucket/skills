//! tauri-plugin-my-plugin — skeleton.
//!
//! Consumers call `tauri_plugin_my_plugin::init()` and chain it onto their
//! `tauri::Builder`. The plugin manages a `MyState` and exposes a single
//! `greet` command, callable from JS as `plugin:my-plugin|greet`.
//!
//! Replace `my-plugin` / `MyPlugin` / `MyPluginExt` with your plugin name.

use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime, State,
};

// ----- Errors ---------------------------------------------------------------

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("name must not be empty")]
    EmptyName,
}

impl Serialize for Error {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, Error>;

// ----- State ----------------------------------------------------------------

#[derive(Default)]
pub struct MyState {
    counter: Mutex<u64>,
}

impl MyState {
    pub fn bump(&self) -> u64 {
        let mut g = self.counter.lock().unwrap();
        *g += 1;
        *g
    }

    pub fn current(&self) -> u64 {
        *self.counter.lock().unwrap()
    }
}

// ----- Extension trait (so consumers can do `app.my_plugin()`) --------------

pub trait MyPluginExt<R: Runtime> {
    fn my_plugin(&self) -> &MyState;
}

impl<R: Runtime, T: Manager<R>> MyPluginExt<R> for T {
    fn my_plugin(&self) -> &MyState {
        self.state::<MyState>().inner()
    }
}

// ----- Commands -------------------------------------------------------------

mod commands {
    use super::{Error, MyState, Result};
    use tauri::{command, AppHandle, Runtime, State};

    #[derive(serde::Serialize)]
    pub struct GreetResponse {
        pub message: String,
        pub call_count: u64,
    }

    #[command]
    pub async fn greet<R: Runtime>(
        _app: AppHandle<R>,
        state: State<'_, MyState>,
        name: String,
    ) -> Result<GreetResponse> {
        if name.trim().is_empty() {
            return Err(Error::EmptyName);
        }
        let n = state.bump();
        Ok(GreetResponse {
            message: format!("Hello, {name}!"),
            call_count: n,
        })
    }
}

// ----- Optional plugin config (drop the `, Config` if you don't need it) ----

#[derive(Default, Deserialize)]
pub struct Config {
    #[serde(default)]
    pub greeting_prefix: Option<String>,
}

// ----- Public init() --------------------------------------------------------

pub fn init<R: Runtime>() -> TauriPlugin<R, Option<Config>> {
    Builder::<R, Option<Config>>::new("my-plugin")
        .invoke_handler(tauri::generate_handler![commands::greet])
        .setup(|app, _api| {
            // `_api.config()` would yield `&Option<Config>` here.
            app.manage(MyState::default());
            Ok(())
        })
        .on_event(|_app, event| {
            if let tauri::RunEvent::Exit = event {
                // flush state, close handles, etc.
            }
        })
        .build()
}

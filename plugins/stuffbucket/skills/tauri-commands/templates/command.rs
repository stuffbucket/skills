// src-tauri/src/commands.rs
//
// Full example: managed state + async + thiserror enum with tagged Serialize +
// AppHandle injection. Wire it up in `lib.rs`:
//
//     mod commands;
//     tauri::Builder::default()
//         .manage(commands::Db::default())
//         .invoke_handler(tauri::generate_handler![
//             commands::get_note,
//             commands::save_note,
//         ])
//         .run(tauri::generate_context!())
//         .expect("error while running tauri application");

use std::collections::HashMap;
use tauri::{AppHandle, Manager, State};
use tokio::sync::Mutex;

#[derive(Default)]
pub struct Db {
    notes: Mutex<HashMap<String, String>>,
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("note `{0}` not found")]
    NotFound(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

// Tagged serialize so JS gets `{ kind: 'notFound' | 'io', message: string }`.
#[derive(serde::Serialize)]
#[serde(tag = "kind", content = "message")]
#[serde(rename_all = "camelCase")]
enum ErrorKind {
    NotFound(String),
    Io(String),
}

impl serde::Serialize for Error {
    fn serialize<S: serde::ser::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let msg = self.to_string();
        let kind = match self {
            Self::NotFound(_) => ErrorKind::NotFound(msg),
            Self::Io(_) => ErrorKind::Io(msg),
        };
        kind.serialize(s)
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub body: String,
    pub config_dir: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveNoteArgs {
    pub note_id: String,
    pub body: String,
}

// Async command: takes State<'_, _> + AppHandle. Note the `Result<_, Error>` —
// required because State has a lifetime and we're inside `async fn`.
#[tauri::command]
pub async fn get_note(
    app: AppHandle,
    state: State<'_, Db>,
    id: String,
) -> Result<Note, Error> {
    let notes = state.notes.lock().await;
    let body = notes
        .get(&id)
        .cloned()
        .ok_or_else(|| Error::NotFound(id.clone()))?;
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| Error::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?
        .display()
        .to_string();
    Ok(Note { id, body, config_dir })
}

#[tauri::command]
pub async fn save_note(state: State<'_, Db>, args: SaveNoteArgs) -> Result<(), Error> {
    let mut notes = state.notes.lock().await;
    notes.insert(args.note_id, args.body);
    Ok(())
}

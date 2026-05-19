// src-tauri/src/context_menu.rs
//
// Dynamic right-click context menu. The frontend invokes
// `show_context_menu` on `oncontextmenu`, passing the clicked element's
// kind + payload. We build a context-appropriate menu and pop it at the
// cursor.

use tauri::{
    menu::{MenuBuilder, PredefinedMenuItem},
    AppHandle, Manager, Window,
};

#[derive(Default)]
pub struct ClipboardLog(pub std::sync::Mutex<Vec<String>>);

#[tauri::command]
pub fn show_context_menu(
    app: AppHandle,
    window: Window,
    kind: String,          // "link" | "row" | "blank"
    payload: Option<String>, // e.g. row_id or href
    selected: bool,
) -> tauri::Result<()> {
    let mut b = MenuBuilder::new(&app);

    match kind.as_str() {
        "link" => {
            let href = payload.unwrap_or_default();
            b = b
                .text("open", format!("Open {href}"))
                .text("copy-url", "Copy Link Address")
                .separator()
                .item(&PredefinedMenuItem::copy(&app, None)?);
        }
        "row" => {
            let id = payload.unwrap_or_default();
            b = b.text(format!("row-{id}-edit"), "Edit");
            b = if selected {
                b.text(format!("row-{id}-deselect"), "Deselect")
            } else {
                b.text(format!("row-{id}-select"), "Select")
            };
            b = b
                .separator()
                .text(format!("row-{id}-delete"), "Delete");
        }
        _ => {
            // Blank-area fallback: standard edit commands.
            b = b
                .item(&PredefinedMenuItem::cut(&app, None)?)
                .item(&PredefinedMenuItem::copy(&app, None)?)
                .item(&PredefinedMenuItem::paste(&app, None)?)
                .separator()
                .item(&PredefinedMenuItem::select_all(&app, None)?);
        }
    }

    let menu = b.build()?;
    menu.popup(window)?;
    Ok(())
}

// In lib.rs:
//
//   tauri::Builder::default()
//       .manage(ClipboardLog::default())
//       .invoke_handler(tauri::generate_handler![show_context_menu])
//       .on_menu_event(|app, event| {
//           let id = event.id().as_ref();
//           let log: tauri::State<ClipboardLog> = app.state();
//
//           match id {
//               "open"     => { /* open href via opener plugin */ }
//               "copy-url" => { log.0.lock().unwrap().push("url".into()); }
//               id if id.starts_with("row-") => {
//                   if let Some((row, action)) = id
//                       .strip_prefix("row-")
//                       .and_then(|s| s.rsplit_once('-'))
//                   {
//                       handle_row(app, row, action);
//                   }
//               }
//               _ => {}
//           }
//       })
//       .run(tauri::generate_context!())
//       .unwrap();

fn handle_row(_app: &AppHandle, _row_id: &str, _action: &str) {
    // dispatch to your domain layer
}

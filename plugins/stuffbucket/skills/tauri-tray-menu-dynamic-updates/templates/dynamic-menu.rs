// src-tauri/src/lib.rs
//
// Demonstrates the full dynamic-menu pattern:
//   - Store MenuItem / CheckMenuItem / IconMenuItem handles in managed state.
//   - Mutate them live from a spawned background task (set_text, set_icon).
//   - Toggle a CheckMenuItem from on_menu_event.
//   - Rebuild + swap the tray menu to add/remove items.

use std::sync::Mutex;
use tauri::{
    image::Image,
    menu::{CheckMenuItem, IconMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, Wry,
};

pub struct MenuRefs {
    pub status: MenuItem<Wry>,
    pub toggle: CheckMenuItem<Wry>,
    pub conn:   IconMenuItem<Wry>,
}

// Item count tracked so we know whether to rebuild.
#[derive(Default)]
pub struct AppState {
    pub recent_files: Mutex<Vec<String>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .setup(|app| {
            let status = MenuItem::with_id(app, "status", "Status: idle", false, None::<&str>)?;
            let toggle = CheckMenuItem::with_id(app, "autostart", "Start at login", true, false, None::<&str>)?;
            let conn   = IconMenuItem::with_id(
                app, "conn", "Connecting…", true,
                Some(load_icon(b"yellow")?), None::<&str>,
            )?;
            let sep  = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, Some("CmdOrCtrl+Q"))?;

            let menu = Menu::with_items(app, &[&status, &conn, &toggle, &sep, &quit])?;

            app.manage(MenuRefs {
                status: status.clone(),
                toggle: toggle.clone(),
                conn:   conn.clone(),
            });

            TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "autostart" => {
                        let refs: tauri::State<MenuRefs> = app.state();
                        let now = !refs.toggle.is_checked().unwrap_or(false);
                        let _ = refs.toggle.set_checked(now);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            // Simulate a background task that mutates the menu live.
            let app_h = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                let refs: tauri::State<MenuRefs> = app_h.state();
                let _ = refs.status.set_text("Status: syncing…");
                let _ = refs.conn.set_text("Connected");
                if let Ok(green) = load_icon(b"green") {
                    let _ = refs.conn.set_icon(Some(green));
                }
                let _ = refs.status.set_enabled(true);

                tokio::time::sleep(std::time::Duration::from_secs(3)).await;
                // Rebuild + swap to add a "Recent files" submenu.
                if let Err(e) = rebuild_with_recent(&app_h, &["a.txt", "b.txt"]) {
                    eprintln!("rebuild failed: {e}");
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn rebuild_with_recent(app: &AppHandle, files: &[&str]) -> tauri::Result<()> {
    let refs: tauri::State<MenuRefs> = app.state();

    // Reuse the existing handles — they're still valid.
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, Some("CmdOrCtrl+Q"))?;

    // Build a "Recent" submenu dynamically from the file list.
    let mut recent_items: Vec<MenuItem<Wry>> = Vec::new();
    for f in files {
        recent_items.push(MenuItem::with_id(app, format!("recent-{f}"), *f, true, None::<&str>)?);
    }
    let recent_refs: Vec<&dyn tauri::menu::IsMenuItem<Wry>> =
        recent_items.iter().map(|i| i as &dyn tauri::menu::IsMenuItem<Wry>).collect();
    let recent = tauri::menu::Submenu::with_items(app, "Recent", true, &recent_refs)?;

    let new_menu = Menu::with_items(
        app,
        &[&refs.status, &refs.conn, &refs.toggle, &sep, &recent, &quit],
    )?;

    let tray = app.tray_by_id("main-tray").expect("tray missing");
    tray.set_menu(Some(new_menu))?;
    Ok(())
}

fn load_icon(_color: &[u8]) -> tauri::Result<Image<'static>> {
    // Real code: include_bytes! a PNG per state. Requires `image-png` feature.
    Image::from_bytes(include_bytes!("../icons/icon.png"))
}

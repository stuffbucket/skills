// Menu-bar app pattern: tray icon + popover window toggled on left-click + Quit item.
//
// Cargo.toml:
//   tauri = { version = "2", features = ["tray-icon"] }
//   tauri-plugin-positioner = { version = "2", features = ["tray-icon"] }
//
// tauri.conf.json — define a "popover" window with decorations:false, visible:false,
// skipTaskbar:true, alwaysOnTop:true.

use tauri::{
    Manager,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    WindowEvent,
};
use tauri_plugin_positioner::{Position, WindowExt};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_positioner::init())
        .setup(|app| {
            // --- Menu ---------------------------------------------------------
            let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let sep    = PredefinedMenuItem::separator(app)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, Some("CmdOrCtrl+Q"))?;

            let menu = Menu::with_items(app, &[&show_i, &sep, &quit_i])?;

            // --- Tray ---------------------------------------------------------
            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false) // left-click toggles popover instead
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => toggle_popover(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // Let positioner record the tray rect for TrayCenter et al.
                    tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);

                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_popover(tray.app_handle());
                    }
                })
                .build(app)?;

            // Dismiss popover when it loses focus (menu-bar popover convention).
            if let Some(win) = app.get_webview_window("popover") {
                let win_clone = win.clone();
                win.on_window_event(move |event| {
                    if let WindowEvent::Focused(false) = event {
                        let _ = win_clone.hide();
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn toggle_popover<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    let Some(win) = app.get_webview_window("popover") else { return };
    match win.is_visible() {
        Ok(true) => { let _ = win.hide(); }
        _ => {
            let _ = win.move_window(Position::TrayCenter);
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

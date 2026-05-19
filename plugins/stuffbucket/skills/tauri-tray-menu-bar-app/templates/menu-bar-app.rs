// src-tauri/src/lib.rs
//
// Full menu-bar-app pattern: tray icon + popover window anchored under the
// tray via tauri-plugin-positioner. Left-click toggles, right-click opens
// the menu, blur hides.

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use tauri_plugin_positioner::{Position, WindowExt};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_positioner::init())
        .setup(|app| {
            // Right-click menu (small: open + quit).
            let open = MenuItem::with_id(app, "open", "Open", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, Some("CmdOrCtrl+Q"))?;
            let menu = Menu::with_items(app, &[&open, &sep, &quit])?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .icon_as_template(true) // macOS: tint to match menu bar
                .menu(&menu)
                .show_menu_on_left_click(false) // left-click triggers Click event instead
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "open" => show_popover(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // REQUIRED so the positioner plugin can cache the tray rect.
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

            Ok(())
        })
        .on_window_event(|window, event| {
            // Hide when the user clicks away — classic menu-bar behaviour.
            if let WindowEvent::Focused(false) = event {
                if window.label() == "main" {
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn toggle_popover(app: &tauri::AppHandle) {
    let Some(win) = app.get_webview_window("main") else { return };
    if win.is_visible().unwrap_or(false) {
        let _ = win.hide();
    } else {
        show_popover(app);
    }
}

fn show_popover(app: &tauri::AppHandle) {
    let Some(win) = app.get_webview_window("main") else { return };
    // TrayCenter = centered horizontally under the tray icon.
    let _ = win.move_window(Position::TrayCenter);
    let _ = win.show();
    let _ = win.set_focus();
}

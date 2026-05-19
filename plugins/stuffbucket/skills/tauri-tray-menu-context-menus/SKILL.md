---
name: tauri-tray-menu-context-menus
description: Use when building right-click context menus on Tauri v2 windows — `Menu::with_items(&app, &[...])`, `menu.popup(window)` / `popup_at(window, position)`, dynamic context-aware menus rebuilt per right-click, dispatching clicks via `on_menu_event` or per-item closures, accessing managed state from menu handlers, and the JS-side `oncontextmenu` bridge that triggers the popup.
---

# Tauri v2 — Window Context Menus

A context menu is a transient native menu shown at a point in a webview
window — usually triggered by right-click (`contextmenu` in the DOM). Tauri
v2 builds the menu on the Rust side, then calls `menu.popup(window)` (or
`popup_at`) from a command the frontend invokes on `oncontextmenu`.

Why not pure HTML/CSS? Native menus give correct submenu hover, keyboard
navigation, screen-reader semantics, OS theming, and predefined items like
`Copy`/`Paste` that already wire to the webview's selection.

---

## 1. Build a menu

`Menu::with_items` is the one-shot constructor; `MenuBuilder` is the
fluent variant when you want to add items conditionally.

```rust
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle,
};

fn build_link_menu(app: &AppHandle, href: &str) -> tauri::Result<Menu<tauri::Wry>> {
    let open  = MenuItem::with_id(app, "open",  format!("Open {href}"), true, None::<&str>)?;
    let copy_url = MenuItem::with_id(app, "copy-url", "Copy Link", true, None::<&str>)?;
    let sep   = PredefinedMenuItem::separator(app)?;
    let copy  = PredefinedMenuItem::copy(app, None)?;     // wires to webview selection
    let paste = PredefinedMenuItem::paste(app, None)?;

    Menu::with_items(app, &[&open, &copy_url, &sep, &copy, &paste])
}
```

Predefined items (`copy`, `paste`, `cut`, `undo`, `redo`, `select_all`,
`separator`, `close_window`, `quit`, `about(...)`) carry OS-standard
behaviour automatically — prefer them over custom commands for clipboard
ops so the WebView's edit-context wiring works.

---

## 2. Pop the menu at the click

```rust
#[tauri::command]
fn show_context_menu(app: AppHandle, window: tauri::Window, href: Option<String>) -> tauri::Result<()> {
    let menu = build_link_menu(&app, href.as_deref().unwrap_or(""))?;
    // popup() positions at the current cursor.
    menu.popup(window)?;
    Ok(())
}
```

For an explicit anchor (e.g. anchoring to a button's bounding rect):

```rust
use tauri::{LogicalPosition, Position};

menu.popup_at(window, Position::Logical(LogicalPosition::new(x, y)))?;
```

`popup` resolves the cursor automatically; `popup_at` requires you to pass
window-local coordinates. The JS-side `oncontextmenu` event has
`event.clientX/Y` which are already window-local logical pixels — pass
those if you need a fixed anchor.

---

## 3. Dynamic / context-aware menus

The key insight: **don't build the menu once at startup**. Build it inside
the command, so the items reflect what was right-clicked.

```rust
#[tauri::command]
fn show_row_menu(
    app: AppHandle,
    window: tauri::Window,
    row_id: String,
    selected: bool,
    state: tauri::State<'_, AppState>,   // managed state available here
) -> tauri::Result<()> {
    let mut b = tauri::menu::MenuBuilder::new(&app);
    b = b.text(format!("row-{row_id}-edit"), "Edit");
    if selected {
        b = b.text(format!("row-{row_id}-deselect"), "Deselect");
    } else {
        b = b.text(format!("row-{row_id}-select"), "Select");
    }
    b = b.separator();
    if state.allow_delete() {
        b = b.text(format!("row-{row_id}-delete"), "Delete");
    }
    let menu = b.build()?;
    menu.popup(window)?;
    Ok(())
}
```

Encode the context (`row_id`) into the menu item ID — then the
`on_menu_event` handler can parse it back. This is how you avoid global
"selected row" state for menu dispatch.

---

## 4. Dispatching clicks

Two options:

### App-level `on_menu_event`

```rust
tauri::Builder::default()
    .on_menu_event(|app, event| {
        let id = event.id().as_ref();
        if let Some(rest) = id.strip_prefix("row-") {
            // "row-42-delete" → ("42", "delete")
            if let Some((row, action)) = rest.rsplit_once('-') {
                handle_row_action(app, row, action);
            }
        }
    })
```

Fires for **all** menus in the app — tray, window menu, context menus.
Use ID prefixes to namespace.

### Per-menu `.on_event` (fluent builder)

```rust
let menu = MenuBuilder::new(&app)
    .text("foo", "Foo")
    .build()?;
// dispatch is still via on_menu_event; per-item closures live on
// TrayIconBuilder::on_menu_event, not on Menu itself.
```

For context menus the app-level `on_menu_event` is canonical. If you need
per-call dispatch (e.g. the row_id is captured in a closure), use a
oneshot channel:

```rust
use tokio::sync::oneshot;
let (tx, rx) = oneshot::channel::<String>();
// stash tx keyed by a nonce, pop it in on_menu_event when the id matches
```

In practice, encoding context into the ID is simpler.

---

## 5. Accessing managed state from a menu handler

`on_menu_event` receives `&AppHandle`, so any managed state is reachable:

```rust
.on_menu_event(|app, event| {
    let db: tauri::State<Database> = app.state();
    if event.id().as_ref() == "refresh" {
        db.refresh();
    }
})
```

For async work, spawn:

```rust
.on_menu_event(|app, event| {
    let app = app.clone();
    if event.id().as_ref() == "sync" {
        tauri::async_runtime::spawn(async move {
            let store: tauri::State<Store> = app.state();
            store.sync().await;
        });
    }
})
```

Don't `.await` inside the handler itself — it's sync.

---

## 6. JS-side bridge

The frontend listens for `contextmenu`, calls `preventDefault()` to
suppress the WebView's built-in menu, then invokes the Rust command:

```ts
import { invoke } from "@tauri-apps/api/core";

window.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const a = (e.target as HTMLElement).closest("a");
  if (a) {
    invoke("show_context_menu", { href: a.href });
  } else {
    invoke("show_context_menu", { href: null });
  }
});
```

Two notes:

- **Disable WebView default menu in production:** `withGlobalTauri: true`
  isn't needed; just ensure every `contextmenu` listener calls
  `preventDefault()`. Or set `tauri.conf.json` →
  `app.windows[].browserAccessibilityEnabled` carefully — Tauri ships the
  default WebView menu unless you suppress it.
- **Pass logical coords, not physical:** `event.clientX/Y` are CSS pixels,
  which match Tauri's `LogicalPosition`.

See `templates/context-menu.ts` for a richer dispatcher.

---

## 7. Failure modes

| Symptom                                    | Cause                                                           |
| ------------------------------------------ | --------------------------------------------------------------- |
| Native menu *and* WebView menu both appear | Forgot `e.preventDefault()` in the JS handler                   |
| Menu pops at wrong position                | Mixed logical/physical coords, or didn't use `popup_at`         |
| Click on item does nothing                 | ID not matched in `on_menu_event`                               |
| Predefined `Copy` doesn't copy selection   | Built a custom `MenuItem` instead of `PredefinedMenuItem::copy` |
| State unavailable in handler               | Tried `State<'_, T>` argument — use `app.state::<T>()` instead  |

---

## Templates

- `templates/context-menu.rs` — full command + dispatcher with dynamic items.
- `templates/context-menu.ts` — JS bridge wiring `oncontextmenu`.

Pairs with `tauri-tray-menu` (parent), `tauri-tray-menu-dynamic-updates`
(for menus that mutate after being built), and `tauri-commands-state-injection`
(for state access patterns in handlers).

---
name: tauri-tray-menu-dynamic-updates
description: Use when mutating Tauri v2 menus at runtime — stashing `MenuItem` / `CheckMenuItem` / `IconMenuItem` handles in managed state (`AppHandle::manage(MenuRefs { ... })`), calling `set_text` / `set_enabled` / `set_checked` / `set_icon` from background tasks, and rebuilding+swapping the whole menu when you need to insert or remove items (`tray.set_menu(Some(new_menu))` for tray menus, `app.set_menu(new_menu)` for the macOS app menu).
---

# Tauri v2 — Dynamic Menu Updates

Menus in Tauri v2 are made of strongly-typed item handles (`MenuItem`,
`CheckMenuItem`, `IconMenuItem`, `Submenu`). Each handle has setters:
`set_text`, `set_enabled`, `set_checked` (on `CheckMenuItem`), `set_icon`
(on `IconMenuItem`). Mutating any of those updates the native menu live —
no rebuild required.

What you **cannot** do live: insert or remove items, reorder, change an
item's type (e.g. plain → checkbox). For those you rebuild the whole menu
and swap it in.

The whole pattern hinges on keeping the handles reachable from wherever
the mutation happens — usually managed state.

---

## 1. The shape: store handles in state

```rust
use tauri::{
    menu::{CheckMenuItem, IconMenuItem, MenuItem},
    AppHandle, Manager, Wry,
};

pub struct MenuRefs {
    pub status: MenuItem<Wry>,        // "Status: idle" → "Status: syncing"
    pub toggle: CheckMenuItem<Wry>,   // "Start at login" — on/off
    pub icon:   IconMenuItem<Wry>,    // status indicator with a colored dot
}

// In setup:
let status = MenuItem::with_id(app, "status", "Status: idle", false, None::<&str>)?;
let toggle = CheckMenuItem::with_id(app, "autostart", "Start at login", true, false, None::<&str>)?;
let icon   = IconMenuItem::with_id(app, "connection", "Connecting…", true,
    Some(load_yellow_dot(app)?), None::<&str>)?;

app.manage(MenuRefs { status: status.clone(), toggle: toggle.clone(), icon: icon.clone() });
```

The handles are `Clone` (cheap — they wrap an internal `Arc`). Keep one
copy in the menu, one copy in state.

---

## 2. Mutate from anywhere

Anywhere you have an `AppHandle` (commands, event handlers, spawned
tasks), reach for the refs:

```rust
fn on_sync_started(app: &AppHandle) {
    let refs: tauri::State<MenuRefs> = app.state();
    let _ = refs.status.set_text("Status: syncing…");
    let _ = refs.icon.set_text("Connected");
    let _ = refs.icon.set_icon(Some(load_green_dot(app).unwrap()));
}

#[tauri::command]
fn set_autostart(checked: bool, refs: tauri::State<'_, MenuRefs>) -> tauri::Result<()> {
    refs.toggle.set_checked(checked)?;
    Ok(())
}
```

Setters return `tauri::Result<()>` because the native call can fail
(e.g. window closed on Windows). In a fire-and-forget background task,
`let _ =` is fine.

From a spawned task:

```rust
let app = app.clone();
tauri::async_runtime::spawn(async move {
    let result = long_running_sync().await;
    let refs: tauri::State<MenuRefs> = app.state();
    let _ = refs.status.set_text(match result {
        Ok(_)  => "Status: idle",
        Err(_) => "Status: error",
    });
});
```

`tauri::State<T>` is fetched via `app.state::<T>()` — no need to thread
state through manually.

---

## 3. Checkbox sync with `on_menu_event`

Toggle the check state when the user clicks; mirror to disk if
relevant. Tauri does **not** flip `CheckMenuItem` automatically — your
handler must.

```rust
.on_menu_event(|app, event| {
    if event.id().as_ref() == "autostart" {
        let refs: tauri::State<MenuRefs> = app.state();
        let now = !refs.toggle.is_checked().unwrap_or(false);
        let _ = refs.toggle.set_checked(now);
        persist_autostart(now);
    }
})
```

---

## 4. When you must rebuild

Setters cover text/enabled/checked/icon. For these you **rebuild**:

- Add or remove a menu item.
- Change item ordering.
- Change a separator into an item (or vice versa).
- Change a `MenuItem` into a `Submenu`.
- Replace a submenu's contents.

The pattern is: build a new `Menu`, then call the right `set_menu` for
the surface.

### Tray menu

```rust
let new_menu = Menu::with_items(app, &[&item_a, &item_b, &sep, &quit])?;

let tray = app.tray_by_id("main-tray").unwrap();
tray.set_menu(Some(new_menu.clone()))?;
```

`tray_by_id` requires you built the tray with `TrayIconBuilder::with_id(...)`.
Without an ID, hold a `TrayIcon` handle yourself.

If you stash item refs in `MenuRefs`, **update the refs to point at the
new items**, otherwise subsequent setters mutate detached handles that
aren't on screen:

```rust
{
    let mut refs = app.state::<std::sync::Mutex<MenuRefs>>().lock().unwrap();
    refs.status = new_status_item;
    refs.toggle = new_toggle_item;
}
```

(Use `Mutex<MenuRefs>` when refs themselves get reassigned; plain
`MenuRefs` is fine when only setters are called.)

### macOS app menu (the system menu bar)

```rust
app.set_menu(new_menu)?;
```

`set_menu` returns the previous menu, so you can stash and restore. On
Windows/Linux, `app.set_menu` sets the **default window menu** for newly
created windows — existing windows keep theirs unless you call
`window.set_menu(new_menu)`.

### Window menu (Windows/Linux per-window)

```rust
window.set_menu(new_menu)?;
window.hide_menu()?;        // toggle visibility without destroying it
window.show_menu()?;
```

---

## 5. Loading icons for `IconMenuItem`

Requires the `image-png` or `image-ico` feature on `tauri`:

```toml
tauri = { version = "2", features = ["tray-icon", "image-png"] }
```

```rust
use tauri::image::Image;

fn load_green_dot(app: &AppHandle) -> tauri::Result<Image<'_>> {
    // Embed at build time; `Image::from_bytes` borrows from the binary.
    Image::from_bytes(include_bytes!("../icons/dot-green.png"))
}
```

`set_icon(Some(image))` swaps the icon, `set_icon(None)` clears it.
On macOS, `icon_as_template(true)` on `IconMenuItem::with_id_and_template`
makes the OS auto-tint for dark/light mode.

---

## 6. Quick reference — setter coverage

| Type                 | `set_text`        | `set_enabled` | `set_checked` | `set_icon` | `set_accelerator` |
| -------------------- | ----------------- | ------------- | ------------- | ---------- | ----------------- |
| `MenuItem`           | yes               | yes           | —             | —          | yes               |
| `CheckMenuItem`      | yes               | yes           | yes           | —          | yes               |
| `IconMenuItem`       | yes               | yes           | —             | yes        | yes               |
| `Submenu`            | yes               | yes           | —             | yes (2.8+) | —                 |
| `PredefinedMenuItem` | text varies by OS | yes           | —             | —          | —                 |

`PredefinedMenuItem` text is OS-controlled for most variants (`copy`,
`paste`, `quit`); only `about` and a few others accept custom text.

---

## 7. Failure modes

| Symptom                                                    | Cause                                                                               |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Setter call compiles but UI doesn't change                 | Mutated a stale handle after a rebuild + swap                                       |
| `set_icon` won't compile                                   | Missing `image-png` / `image-ico` feature on `tauri`                                |
| Check state doesn't flip on click                          | Forgot to call `set_checked` in `on_menu_event`                                     |
| `app.set_menu` doesn't update existing windows (Win/Linux) | That call only sets the default for new windows — call `window.set_menu` per window |
| Background task can't reach state                          | Use `app.state::<MenuRefs>()`, not `State<'_, T>` arg (that's command-only)         |

---

## Templates

- `templates/dynamic-menu.rs` — full setup with `MenuRefs`, mutation from
  a background task, checkbox toggle, and a rebuild+swap example.

Pairs with `tauri-tray-menu` (parent), `tauri-tray-menu-context-menus`
(building menus), and `tauri-commands-state-injection` (state patterns).

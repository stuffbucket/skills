---
name: tauri-plugins-dialog
description: Use when showing native pickers or modal dialogs in a Tauri v2 app — `open()` / `save()` for files, `message()` / `ask()` / `confirm()` for prompts, multi-select, directory mode, file-type filters, the `dialog:allow-open` / `dialog:allow-save` / `dialog:allow-message` / `dialog:allow-ask` / `dialog:allow-confirm` permissions, and the `blocking_` vs async variants in Rust.
---

# Tauri v2: Dialog Plugin

Native OS dialogs — the system file picker, the system alert, the system yes/no. Looks correct per
platform without you doing any work; cannot be styled.

## Install

```sh
npm run tauri add dialog
```

Manual: `tauri-plugin-dialog = "2"`, `@tauri-apps/plugin-dialog`,
`.plugin(tauri_plugin_dialog::init())`.

## JS API

```ts
import { open, save, message, ask, confirm } from '@tauri-apps/plugin-dialog';

// File picker (single)
const path = await open({
  multiple: false,
  directory: false,
  filters: [
    { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
    { name: 'All',    extensions: ['*'] },
  ],
});
// → string | null

// Multi-select
const paths = await open({ multiple: true }); // → string[] | null

// Folder picker
const folder = await open({ directory: true }); // → string | null

// Save picker — returns the path; you write it yourself (via fs plugin).
const dest = await save({
  defaultPath: 'export.json',
  filters: [{ name: 'JSON', extensions: ['json'] }],
});

// Prompts — all return a boolean.
await message('Update applied.', { title: 'MyApp', kind: 'info' });
const yes = await ask('Discard unsaved changes?', { kind: 'warning' });
const ok  = await confirm('Delete this file permanently?', { kind: 'warning' });
```

Return shapes:

| Function           | Returns                          |                                       |
| ------------------ | -------------------------------- | ------------------------------------- |
| `open` (single)    | `string \                        | null`                                 |
| `open` (multi)     | `string[] \                      | null`                                 |
| `open` (directory) | `string \                        | null` (or `string[]` with `multiple`) |
| `save`             | `string \                        | null`                                 |
| `message`          | `void` (resolves when dismissed) |                                       |
| `ask`, `confirm`   | `boolean`                        |                                       |

`null` means the user cancelled. Always handle it.

Filter shape:

```ts
{ name: 'Display name', extensions: ['ext1', 'ext2'] }
```

Extensions are without leading dot. Use `'*'` for "all files" — required on Windows to expose that
option.

## Rust API

Both async (recommended) and blocking variants exist. **Blocking variants pin the calling thread
until the dialog returns** — don't call them from an async command without `spawn_blocking`, and
never from the main event loop thread.

```rust
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
async fn pick_file(app: tauri::AppHandle) -> Option<String> {
    app.dialog()
        .file()
        .add_filter("Images", &["png", "jpg", "jpeg"])
        .blocking_pick_file()                 // blocking
        .map(|p| p.to_string())
}

#[tauri::command]
async fn pick_file_async(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_file(move |path| {
        let _ = tx.send(path.map(|p| p.to_string()));
    });
    rx.await.map_err(|e| e.to_string())
}
```

Builder methods: `.add_filter(name, exts)`, `.set_directory(path)`, `.set_file_name(name)`,
`.set_parent(window)`. For a multi-pick: `.pick_files()`. For a folder: `.pick_folder()`. For save:
`.save_file()`.

Message dialogs:

```rust
app.dialog()
    .message("Settings saved.")
    .title("MyApp")
    .kind(tauri_plugin_dialog::MessageDialogKind::Info)
    .blocking_show();
```

## Permissions

| Permission             | Allows                                   |
| ---------------------- | ---------------------------------------- |
| `dialog:default`       | All of the below — convenient, but broad |
| `dialog:allow-open`    | File / folder pickers                    |
| `dialog:allow-save`    | Save picker                              |
| `dialog:allow-message` | `message()`                              |
| `dialog:allow-ask`     | `ask()`                                  |
| `dialog:allow-confirm` | `confirm()`                              |

There is no per-path scope on the dialog itself — the user chose the path, the OS owns the picker.
**You still need fs permissions to do anything with the resulting path.** Common flow:

1. `open()` returns `/Users/me/foo.txt`.
2. You pass that path to `readTextFile()`.
3. fs plugin enforces its scope on that path.

If you want to read arbitrary user-picked files, your fs scope needs to cover that root
(`$HOME/**/*`) or you need to extend the scope at runtime in Rust:

```rust
use tauri_plugin_fs::FsExt;
app.fs_scope().allow_file(&picked_path)?;
```

## Platform quirks

- **macOS**: dialogs are app-modal — they steal focus but don't block other apps. The dialog
  inherits the parent window if you call `.set_parent(&main_window)`.
- **Windows**: `extensions: ['*']` is the only way to get "All files" in the dropdown. Without it,
  the dropdown will show only your declared filter types.
- **iOS**: `open()` returns `file://` URIs.
- **Android**: `open()` returns content URIs (`content://…`). The fs plugin can read them via the
  standard read APIs; don't try to manipulate them as filesystem paths.

## Templates

- `templates/setup.rs` — both blocking and async pick examples.
- `templates/usage.ts` — pickers + prompts with full filter shape.
- `templates/capability.json` — granular permissions instead of `dialog:default`.

## Related

- `tauri-plugins-fs` — required downstream for reading/writing the picked path.
- `tauri-plugins` — install flow and decision matrix.

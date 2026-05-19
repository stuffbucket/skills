import { open, save, message, ask, confirm } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

// Pick a JSON file, read it. The fs scope must cover the returned path.
export async function importJson() {
  const path = await open({
    multiple: false,
    filters: [
      { name: 'JSON', extensions: ['json'] },
      { name: 'All',  extensions: ['*'] },  // needed for "All files" on Windows
    ],
  });
  if (!path) return null;                   // user cancelled
  const text = await readTextFile(path);
  return JSON.parse(text);
}

// Multi-select.
export async function importImages() {
  const paths = await open({
    multiple: true,
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
  });
  return paths ?? [];
}

// Folder picker.
export async function pickWorkspace() {
  return await open({ directory: true });
}

// Save flow: get a destination, then write yourself via fs.
export async function exportJson(data: unknown) {
  const dest = await save({
    defaultPath: 'export.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (!dest) return false;
  await writeTextFile(dest, JSON.stringify(data, null, 2));
  return true;
}

// Prompts.
export async function confirmDelete(name: string) {
  return await confirm(`Permanently delete "${name}"?`, { kind: 'warning' });
}
export async function notify(msg: string) {
  await message(msg, { title: 'MyApp', kind: 'info' });
}
export async function discardChanges() {
  return await ask('Discard unsaved changes?', { kind: 'warning' });
}

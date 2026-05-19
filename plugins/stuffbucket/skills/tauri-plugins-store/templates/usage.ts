import { load } from '@tauri-apps/plugin-store';

interface WindowState { x: number; y: number; w: number; h: number }

const SCHEMA_VERSION = 2;

export async function openSettings() {
  // autoSave: 250 → debounce disk writes by 250ms after each set.
  const store = await load('settings.json', { autoSave: 250 });

  const v = (await store.get<number>('__v')) ?? 0;
  if (v < 1) {
    const old = await store.get<string>('colorMode');
    if (old) {
      await store.set('theme', old);
      await store.delete('colorMode');
    }
  }
  if (v < 2) {
    // Example: split a single 'window' object into x/y/w/h on a typed key.
    const win = await store.get<WindowState>('window');
    if (win) {
      await store.set('lastWindow', win);
      await store.delete('window');
    }
  }
  await store.set('__v', SCHEMA_VERSION);

  return {
    async getTheme()        { return (await store.get<string>('theme')) ?? 'system'; },
    async setTheme(t: string) { await store.set('theme', t); },
    async getWindow()       { return store.get<WindowState>('lastWindow'); },
    async setWindow(w: WindowState) { await store.set('lastWindow', w); },
    async flush()           { await store.save(); }, // force, ignoring debounce
  };
}

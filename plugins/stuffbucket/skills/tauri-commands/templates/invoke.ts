// Matching JS side for templates/command.rs.
// Place near your UI code; import where needed.

import { invoke } from '@tauri-apps/api/core';

// Discriminated error union — mirrors the Rust ErrorKind tagged Serialize.
export type CommandError =
  | { kind: 'notFound'; message: string }
  | { kind: 'io'; message: string };

export interface Note {
  id: string;
  body: string;
  configDir: string;
}

export async function getNote(id: string): Promise<Note> {
  // `invoke<T>` is a TS-only hint — keep it in sync with the Rust return type.
  // Args object uses camelCase keys (Tauri's default rename).
  return await invoke<Note>('get_note', { id });
}

export async function saveNote(noteId: string, body: string): Promise<void> {
  // Struct args: the Rust side accepts `args: SaveNoteArgs`, so JS nests under `args`.
  await invoke<void>('save_note', { args: { noteId, body } });
}

// Typed error handling at the call site:
export async function loadNoteSafely(id: string): Promise<Note | null> {
  try {
    return await getNote(id);
  } catch (raw) {
    const err = raw as CommandError;
    switch (err.kind) {
      case 'notFound':
        return null;
      case 'io':
        console.error('IO failure:', err.message);
        throw raw;
      default:
        // Exhaustiveness check — TS will error if a new ErrorKind variant is
        // added on the Rust side but not handled here.
        const _exhaustive: never = err;
        throw raw;
    }
  }
}

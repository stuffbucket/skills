// Typed bridge for the AppError wire format produced by templates/error.rs.
//
// Pair this with the matching Rust enum. Whenever you add a variant on one
// side, the `never` exhaustiveness check below makes the other side a compile
// error until they're back in sync.

import { invoke, type InvokeArgs } from '@tauri-apps/api/core';

export type CommandError =
  | { kind: 'io';         message: string }
  | { kind: 'notFound';   message: string; path: string }
  | { kind: 'auth';       message: string }
  | { kind: 'badRequest'; message: string }
  | { kind: 'internal';   message: string };

/** Thin wrapper around `invoke` that guarantees the rejection is a CommandError. */
export async function call<T>(name: string, args?: InvokeArgs): Promise<T> {
  try {
    return await invoke<T>(name, args);
  } catch (raw) {
    throw normalize(raw);
  }
}

function normalize(raw: unknown): CommandError {
  if (
    raw &&
    typeof raw === 'object' &&
    'kind' in raw &&
    'message' in raw
  ) {
    return raw as CommandError;
  }
  // Fallback: a non-AppError rejection (panic, plugin error, serialization
  // failure). Surface it as `internal` so call sites still have one shape.
  return { kind: 'internal', message: String(raw) };
}

/** Exhaustive handler — adding a Rust variant without updating this fails to compile. */
export function describe(err: CommandError): string {
  switch (err.kind) {
    case 'io':         return `I/O failure: ${err.message}`;
    case 'notFound':   return `Missing: ${err.path}`;
    case 'auth':       return 'Please sign in again.';
    case 'badRequest': return `Bad input: ${err.message}`;
    case 'internal':   return `Unexpected: ${err.message}`;
    default: {
      const _exhaustive: never = err;
      return _exhaustive;
    }
  }
}

// Example call site:
//
//   try {
//     const cfg = await call<Config>('read_config', { path });
//   } catch (e) {
//     const err = e as CommandError;
//     if (err.kind === 'notFound') return promptCreate(err.path);
//     showToast(describe(err));
//   }

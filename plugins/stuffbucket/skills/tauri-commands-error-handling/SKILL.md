---
name: tauri-commands-error-handling
description: Use when designing production error handling for Tauri v2 commands — `thiserror` enums, manual `Serialize` impls emitting `{ kind, message }` for JS discriminated unions, `Result` returns, `?` propagation, panic safety at the IPC boundary, structured logging via `tracing`, and a typed `CommandError` union with exhaustiveness on the JS side.
---

# Tauri v2 — Commands: Production Error Handling

The default "return `Result<T, String>`" pattern in the Tauri docs works for a
prototype and **falls apart** the moment the frontend wants to branch on the
error. This skill is the upgrade path: typed errors on both sides, structured
logging, and a clean panic story.

See [[tauri-commands]] for command basics, [[tauri-commands-state-injection]]
for state, [[tauri-commands-async-patterns]] for async deadlock cases that
*produce* errors worth typing.

## The shape we're going for

JS receives a discriminated union:

```ts
type CommandError =
  | { kind: 'io';        message: string }
  | { kind: 'notFound';  message: string; path: string }
  | { kind: 'auth';      message: string }
  | { kind: 'internal';  message: string };
```

Rust commands return `Result<T, AppError>` and propagate with `?`. No
stringly-typed branching, no parsing error messages on the frontend.

## Rust: `thiserror` enum + manual `Serialize`

`thiserror` gives us idiomatic `Display`/`From`. The catch: Tauri requires the
error type implement `serde::Serialize`, and `thiserror` does **not** derive it
for you. Worse, the obvious `#[derive(Serialize)]` on an enum with `#[from]`
variants will explode because the inner errors (`std::io::Error`, etc.) aren't
`Serialize`. So we hand-roll it.

```rust
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error("not found: {path}")]
    NotFound { path: String },

    #[error("unauthorized")]
    Auth,

    #[error("internal error: {0}")]
    Internal(String),
}

// The shape we actually send to JS — a tagged union.
#[derive(serde::Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum AppErrorWire<'a> {
    Io       { message: String },
    NotFound { message: String, path: &'a str },
    Auth     { message: String },
    Internal { message: String },
}

impl serde::Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let msg = self.to_string();
        let wire = match self {
            AppError::Io(_)             => AppErrorWire::Io       { message: msg },
            AppError::NotFound { path } => AppErrorWire::NotFound { message: msg, path },
            AppError::Auth              => AppErrorWire::Auth     { message: msg },
            AppError::Internal(_)       => AppErrorWire::Internal { message: msg },
        };
        wire.serialize(s)
    }
}
```

**Why two enums?** `AppError` carries real Rust error chains (with `Backtrace`,
`source()`, etc.) so server-side logging works. `AppErrorWire` is the JSON
contract — small, stable, no secrets. Decoupling them means you can add fields
to the internal error without changing the API.

## Using it — `?` everywhere

```rust
#[tauri::command]
fn read_config(path: String) -> Result<Config, AppError> {
    let bytes = std::fs::read(&path)?;                     // io::Error → AppError::Io
    let cfg: Config = serde_json::from_slice(&bytes)
        .map_err(|e| AppError::Internal(e.to_string()))?;  // map foreign errors explicitly
    Ok(cfg)
}
```

For "wrap any error" cases, prefer an explicit `.map_err` over a blanket
`From<anyhow::Error>` — the latter swallows the variant info JS needs to branch.

## Logging — log before serializing

`AppError`'s `Debug`/`Display` carry the chain; the wire shape doesn't. Always
log on the Rust side:

```rust
use tracing::error;

#[tauri::command]
fn do_thing() -> Result<(), AppError> {
    inner().map_err(|e| {
        error!(error = ?e, "do_thing failed");  // full chain, source(), backtrace
        e
    })
}
```

A middleware-ish wrapper macro can centralize this — see `templates/error.rs`.

## Panic safety at the IPC boundary

A panic inside a command in Tauri v2 dev mode kills the WebView; in a release
build it can take the whole app down. Defensive options:

1. **Don't panic.** `unwrap()` / `expect()` in commands is a bug. Convert to
   `AppError::Internal` with `.map_err(|e| AppError::Internal(e.to_string()))`
   or `.ok_or_else(...)`.
2. **For FFI / `unsafe` blocks** wrap with `std::panic::catch_unwind`:

   ```rust
   let r = std::panic::catch_unwind(|| dangerous_native_call());
   r.map_err(|_| AppError::Internal("native call panicked".into()))?;
   ```

3. **Global panic hook** — log the panic, then let it propagate:

   ```rust
   std::panic::set_hook(Box::new(|info| {
       tracing::error!(panic = %info, "panic at the command boundary");
   }));
   ```

`catch_unwind` requires `UnwindSafe`. For non-`UnwindSafe` types (most stateful
things), wrap them in `AssertUnwindSafe(|| { ... })` and accept the risk: a
poisoned mutex post-panic is still better than a dead WebView.

## JS side — typed `CommandError` + exhaustiveness

```ts
import { invoke, InvokeArgs } from '@tauri-apps/api/core';

export type CommandError =
  | { kind: 'io';       message: string }
  | { kind: 'notFound'; message: string; path: string }
  | { kind: 'auth';     message: string }
  | { kind: 'internal'; message: string };

export async function call<T>(name: string, args?: InvokeArgs): Promise<T> {
  try {
    return await invoke<T>(name, args);
  } catch (raw) {
    throw normalize(raw);
  }
}

function normalize(raw: unknown): CommandError {
  if (raw && typeof raw === 'object' && 'kind' in raw) return raw as CommandError;
  return { kind: 'internal', message: String(raw) };
}
```

Then at call sites the compiler enforces every branch:

```ts
try {
  const cfg = await call<Config>('read_config', { path });
} catch (e) {
  const err = e as CommandError;
  switch (err.kind) {
    case 'io':       return showToast(err.message);
    case 'notFound': return promptCreate(err.path);
    case 'auth':     return redirectLogin();
    case 'internal': return reportBug(err.message);
    default: {
      const _exhaustive: never = err;
      throw _exhaustive;
    }
  }
}
```

The `never` line is load-bearing — adding a new variant in Rust without
updating the JS becomes a compile error.

## Templates

- `templates/error.rs` — full `AppError` with wire enum, `?` propagation,
  tracing wrapper.
- `templates/error.ts` — `CommandError` union, `call()` helper, exhaustiveness
  pattern.

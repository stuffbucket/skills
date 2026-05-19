---
name: tauri-sidecar
description: Use when bundling an external binary (Go/Rust/Python/Node) with a Tauri v2 app and running it as a sidecar process — including target-triple naming, externalBin config, shell:allow-execute permissions, stdin/stdout piping, and lifecycle (kill on app exit).
---

# Tauri v2 sidecar binaries and resources

## Why sidecar

A sidecar is a helper binary bundled inside the Tauri app and launched as a
child process at runtime. Use it when you need something the WebView can't
do: a local HTTP server, a CLI tool, a language runtime (Python, Node), a
native helper in Go/Rust. The Tauri shell does process management,
arg-passing, and stdio piping; the sidecar stays a normal executable that
you can also run standalone for debugging.

Don't sidecar for: simple FS access (use `tauri-plugin-fs`), shelling out to
system binaries the user already has (use `Command::new`), or anything you
could do as a `#[tauri::command]` in Rust (cheaper, no extra process).

## Target-triple naming

Each binary in `bundle.externalBin` must exist on disk with a
`-<TARGET_TRIPLE>` suffix. Tauri picks the right one at build time per
target. There's no fallback — wrong name → "binary not found".

Get the host triple:

```sh
rustc --print host-tuple   # Rust ≥ 1.84
rustc -vV | grep '^host:'  # older Rust
```

Common triples:

| OS / arch           | Triple                      |
| ------------------- | --------------------------- |
| macOS Apple Silicon | `aarch64-apple-darwin`      |
| macOS Intel         | `x86_64-apple-darwin`       |
| Linux x64           | `x86_64-unknown-linux-gnu`  |
| Linux ARM           | `aarch64-unknown-linux-gnu` |
| Windows x64         | `x86_64-pc-windows-msvc`    |

So `binaries/myproxy` configured in `externalBin` requires
`src-tauri/binaries/myproxy-aarch64-apple-darwin` (and one file per target
you ship). Windows binaries keep their `.exe` extension *after* the triple:
`myproxy-x86_64-pc-windows-msvc.exe`.

## Config: tauri.conf.json

```json
{
  "bundle": {
    "externalBin": ["binaries/myproxy"],
    "resources": {
      "../web-dist": "web-dist"
    }
  }
}
```

The `externalBin` path is relative to `src-tauri/`. Use `bundle.resources`
for read-only static files (HTML, JSON, assets) that the sidecar or the
WebView reads at runtime — see "Resources" below.

`..` in resource paths becomes `_up_` in the bundled output. Map to a clean
name (`"../web-dist": "web-dist"`) instead of leaving the escape visible.

## Permissions: capabilities/default.json

The shell plugin gates sidecar execution. Without an `shell:allow-execute`
entry naming the sidecar, `spawn()` returns "not allowed".

See `templates/capabilities-sidecar.json` for the full pattern. Minimal:

```json
{
  "identifier": "shell:allow-execute",
  "allow": [
    {
      "name": "binaries/myproxy",
      "sidecar": true,
      "args": ["--port", { "validator": "^\\d{2,5}$" }]
    }
  ]
}
```

- `sidecar: true` — required; without it the entry matches a *system*
  binary of that name, not your bundled one.
- `args` — narrows what arg vector is allowed. Use `true` to allow any
  args (looser), or list literal strings and `{ "validator": "<regex>" }`
  slots for positional values. Mismatched args at runtime → rejection.
- `shell:allow-spawn` — long-running spawn with the streaming `rx` channel
  (what you almost always want for a server sidecar). `allow-execute`
  covers the one-shot `execute()` form.
- `shell:allow-kill` — needed if you call `child.kill()` from JS. Rust's
  `CommandChild::kill()` doesn't go through the permission layer.

## Run from JavaScript

```ts
import { Command } from '@tauri-apps/plugin-shell'

const sidecar = Command.sidecar('binaries/myproxy', ['--port', '4142'])
sidecar.stdout.on('data', (line) => console.log('[proxy]', line))
sidecar.stderr.on('data', (line) => console.error('[proxy]', line))
sidecar.on('close', ({ code }) => console.log('proxy exited', code))

const child = await sidecar.spawn()  // long-running; returns Child
// child.write('input\n'); await child.kill()
```

For a one-shot tool: `const { stdout, code } = await sidecar.execute()`.

The first arg to `Command.sidecar` is the path string from
`externalBin` — no triple suffix, Tauri resolves that.

See `templates/spawn-sidecar.ts`.

## Run from Rust

```rust
use tauri_plugin_shell::{ShellExt, process::CommandEvent};

let (mut rx, child) = app
    .shell()
    .sidecar("myproxy")?
    .args(["--port", "4142"])
    .env("RUST_LOG", "info")
    .spawn()?;

// Stash child in managed state so you can kill it later.
app.state::<Sidecar>().set(child);

tauri::async_runtime::spawn(async move {
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) => { /* parse */ }
            CommandEvent::Stderr(line) => { /* log */ }
            CommandEvent::Terminated(payload) => {
                eprintln!("sidecar exited: {payload:?}");
                break;
            }
            _ => {}
        }
    }
});
```

`sidecar("myproxy")` takes just the basename — no `binaries/` prefix, no
triple. The `rx` channel yields `CommandEvent::{Stdout, Stderr, Error,
Terminated}` until the process ends; iterate it on a Tokio task so the
main thread isn't blocked.

`child.write(b"...\n")?` pipes to the sidecar's stdin.

See `templates/spawn-sidecar.rs` for a complete pattern including
managed-state storage and kill-on-exit.

## Lifecycle: kill on app exit

The single biggest sidecar bug on macOS is leaking the child process when
the user quits. Tauri does not kill sidecars automatically. The fix:

1. Store the `CommandChild` in managed state (`app.manage(Sidecar::new())`).
2. In `app.run(|handle, event| { ... })`, match `RunEvent::ExitRequested`
   and call `child.kill()` exactly once.

```rust
app.run(|handle, event| {
    if let RunEvent::ExitRequested { .. } = event {
        if let Some(child) = handle.state::<Sidecar>().take() {
            let _ = child.kill();   // SIGTERM on POSIX, TerminateProcess on Win
        }
    }
});
```

`kill()` consumes the handle — wrap it in `Mutex<Option<CommandChild>>`
and use `Option::take()` so a second exit signal is a harmless no-op.

If your sidecar holds resources (sockets, file locks), make sure it
handles SIGTERM cleanly. Bun-compiled and Node binaries do by default; a
naive Rust binary may need a `tokio::signal::ctrl_c()` handler.

## Resources: read-only bundled files

For static assets the sidecar (or the WebView) needs to read — built
frontend dist, JSON config templates, vendored libs — use
`bundle.resources` instead of `externalBin`. They land in a
platform-specific resource directory you resolve at runtime.

```json
"bundle": {
  "resources": {
    "../web-dist": "web-dist",
    "templates/": "templates/"
  }
}
```

From Rust:

```rust
let dir = app.path().resource_dir()?;
let html = std::fs::read_to_string(dir.join("web-dist/index.html"))?;
```

From JS:

```ts
import { resolveResource } from '@tauri-apps/api/path'
const p = await resolveResource('web-dist/index.html')
```

Grant fs access for the WebView path with `fs:scope` on `$RESOURCE/**/*`
(needed only if the JS side reads them directly; sidecar-side reads
bypass the plugin entirely).

**Dev caveat:** `tauri dev` does NOT materialise the `resources` mapping —
that's a bundler step. If your sidecar reads bundled resources, either
ship them inside the sidecar binary (Bun import attributes, `include_bytes!`,
Go embed) or detect dev and fall back to a path relative to CWD. See
`shell/src-tauri/src/lib.rs::locate_dev_settings_dist` in this repo for a
working example.

## Node.js sidecars

Node can't ship as `node script.js` — the user won't have Node installed.
Compile to a single binary first, then sidecar it like any other.

Options (all produce one file you can drop in `src-tauri/binaries/`):

| Tool                  | Use when                           |
| --------------------- | ---------------------------------- |
| `@yao-pkg/pkg`        | Plain Node, broadest API coverage  |
| `bun build --compile` | Bun runtime; smaller, faster start |
| `deno compile`        | Deno runtime                       |

Bun example (the pattern this repo uses for its own proxy sidecar — see
`scripts/build-sidecar.ts` for a polished version with mtime-based skip,
git-sha stamping, and dev/CI force flags):

```sh
bun build --compile \
  --target=bun-darwin-arm64 \
  src/main.ts \
  --outfile=src-tauri/binaries/myproxy-aarch64-apple-darwin
```

Repeat per target. Wire it into your build pipeline before `tauri build`.

## Verification checklist

Before declaring sidecar wiring done:

1. `ls src-tauri/binaries/` shows one binary per target triple you ship.
2. `bundle.externalBin` lists the basename (no suffix).
3. `capabilities/*.json` has a `shell:allow-execute` entry with
   `sidecar: true` matching the basename.
4. `bun run tauri dev` (or equivalent) — sidecar spawns, you see its
   stdout in the Tauri console.
5. Quit the app. `ps aux | grep myproxy` shows no orphan.
6. `bun run tauri build` produces a bundle; install it, launch, sidecar
   still runs (this catches resource-dir misconfigurations that only
   bite in packaged builds).

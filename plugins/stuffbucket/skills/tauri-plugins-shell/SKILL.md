---
name: tauri-plugins-shell
description: Use when running an external command, spawning a sidecar, or opening a URL/file from a Tauri v2 app — `Command.create()` vs `Command.sidecar()`, `spawn`/`output`/`kill`/`write`, the `shell:allow-execute` scope with regex arg validators, `shell:allow-spawn`, `shell:allow-kill`, and the move from deprecated `shell.open()` to the modern `@tauri-apps/plugin-opener` (`openUrl` / `openPath` / `revealItemInDir`).
---

# Tauri v2: Shell & Opener Plugins

Two related plugins, one decision point:

- **shell** — for running an executable (`/usr/bin/git`, a bundled sidecar). Tight scope; every arg
  shape is declared up front.
- **opener** — for "open this URL in the browser" / "open this file with the default app" / "reveal
  in Finder". This is the modern replacement for the deprecated `shell.open()`.

If you only need to launch a URL or external file, install **opener**, not shell.

## Install

```sh
npm run tauri add shell      # if you need to exec processes
npm run tauri add opener     # if you only need open-with-default
```

Rust: `.plugin(tauri_plugin_shell::init())` / `.plugin(tauri_plugin_opener::init())`.

## Shell: `Command.create` vs `Command.sidecar`

|               | `Command.create('git', ['status'])`         | `Command.sidecar('binaries/proxy', ['--port', '4142'])`          |
| ------------- | ------------------------------------------- | ---------------------------------------------------------------- |
| Looks up      | Whatever's on `$PATH` at runtime            | Bundled binary in `src-tauri/binaries/`                          |
| Filename rule | Plain name                                  | Must be `<basename>-<target-triple>[.exe]` — see `tauri-sidecar` |
| Capability    | `shell:allow-execute` with `sidecar: false` | `shell:allow-execute` with `sidecar: true`                       |
| Use for       | Dev tools the user is expected to have      | Anything you ship and rely on                                    |

Sidecars are the right answer for "I need a specific version of X". `create` is fine for `git`,
`ssh`, etc. where the user-installed copy is what they want.

## Shell: API

```ts
import { Command } from '@tauri-apps/plugin-shell';

// Fire-and-collect: one Promise with stdout/stderr/code at the end.
const out = await Command.create('git', ['status', '--porcelain']).execute();
if (out.code !== 0) throw new Error(out.stderr);

// Spawn long-running: stream events.
const cmd = Command.sidecar('binaries/proxy', ['--port', '4142']);
cmd.stdout.on('data', (line) => console.log('out:', line));
cmd.stderr.on('data', (line) => console.warn('err:', line));
cmd.on('close', ({ code, signal }) => console.log('exited', code, signal));
const child = await cmd.spawn();

await child.write('input line\n'); // stdin
await child.kill();                  // SIGTERM (or terminate on Windows)
```

Events are line-buffered. Set `cmd.stdout.setEncoding('binary')` for raw bytes.

## Shell: scope (the actual gatekeeper)

The capability entry for `shell:allow-execute` is a list of **command shapes**. Each entry pins a
name, a binary path, and an exact arg pattern. Anything outside the pattern is rejected at the IPC
boundary.

```json
{
  "identifier": "shell:allow-execute",
  "allow": [
    {
      "name": "git-status",
      "cmd": "git",
      "args": ["status", "--porcelain"],
      "sidecar": false
    },
    {
      "name": "proxy",
      "sidecar": true,
      "args": [
        "--port",
        { "validator": "^\\d{2,5}$" }
      ]
    }
  ]
}
```

Arg forms:

- `"--port"` — literal match required
- `{ "validator": "^\\d+$" }` — regex match (anchored implicitly; use `^…$` for sanity)
- Omit `args` entirely — only allowed if you set `args: false` explicitly to mean "no args"

The `name` field is what you pass to `Command.create(name, …)` / `Command.sidecar(name, …)`. **This
is the lookup key, not the binary path.** Pick a stable identifier — refactoring it is a breaking
change.

Pair with:

- `shell:allow-spawn` — required for `.spawn()` (long-running).
- `shell:allow-kill` — required for `child.kill()`.
- `shell:allow-stdin-write` — required for `child.write()`.

For sidecar specifics (target-triple naming, externalBin, ordering), see `tauri-sidecar`.

## Opener: API

```ts
import { openUrl, openPath, revealItemInDir } from '@tauri-apps/plugin-opener';

await openUrl('https://tauri.app');                 // default browser
await openPath('/Users/me/report.pdf');             // default app for type
await openPath('/Users/me/report.pdf', 'Preview');  // with specific app (macOS-ish)
await revealItemInDir('/Users/me/report.pdf');      // Finder / Explorer / xdg
```

The opener plugin's `openUrl`/`openPath` map straight onto `xdg-open` / `open` / `start` per-OS. No
process handle is returned; this is fire-and-forget.

## Opener: scope

```json
{
  "permissions": [
    {
      "identifier": "opener:allow-open-url",
      "allow": [
        { "url": "https://*.tauri.app" },
        { "url": "https://github.com/**" },
        { "url": "mailto:*" }
      ]
    },
    {
      "identifier": "opener:allow-open-path",
      "allow": [{ "path": "$DOWNLOAD/**" }, { "path": "$DOCUMENT/**" }]
    },
    {
      "identifier": "opener:allow-reveal-item-in-dir",
      "allow": [{ "path": "$DOWNLOAD/**" }]
    }
  ]
}
```

URL patterns use a scheme + host glob (`*` = one label, `**` = path tail). Path patterns are the
same FS placeholders as the fs plugin (`$HOME`, `$APPDATA`, …).

## Why opener replaces `shell.open()`

`shell.open()` from Tauri 1.x is deprecated. Two reasons:

1. Its scope was a single regex against the URL — easy to write something that allowed more than
   intended.
2. It conflated "exec arbitrary thing" with "ask the OS to open this" — different threat models,
   different audit needs.

Opener has its own crate, narrower API (no exec), and pattern-based scopes you can read at a glance.
If you see `shell.open()` in a v1 → v2 migration, move it to opener.

## Decision: shell or opener?

| Task                                                | Plugin |
| --------------------------------------------------- | ------ |
| Open a URL in user's browser                        | opener |
| "Reveal in Finder"                                  | opener |
| Open a PDF with the default app                     | opener |
| Run `git` and read stdout                           | shell  |
| Run a bundled binary as a sidecar with stdin        | shell  |
| Long-lived child process you want to `kill()` later | shell  |

## Templates

- `templates/setup.rs` — both plugins init.
- `templates/usage.ts` — sidecar spawn + opener calls.
- `templates/capability.json` — combined `shell:allow-execute` + `opener:allow-open-*`.

## Related

- `tauri-sidecar` — bundling sidecar binaries, target triples, `externalBin`.
- `tauri-security-scopes` — deeper coverage of regex validators and "deny wins".
- `tauri-plugins` — picking which plugins to add.

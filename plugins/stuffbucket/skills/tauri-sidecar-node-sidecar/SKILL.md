---
name: tauri-sidecar-node-sidecar
description: Use when embedding a Node.js, Bun, or Deno program as a sidecar in a Tauri v2 app — picking the right single-binary compiler (`bun build --compile` / `@yao-pkg/pkg` / `deno compile` / `nexe`), naming the output for `externalBin`, running the dev loop without compiling each iteration (Vite UI on :1420 + `bun run dev` proxy on :4142 — the pattern this repo uses), the HTTP-server-as-sidecar model with capability-free localhost, the stdin/stdout pipe alternative, and making sure the child exits with the app.
---

# Tauri v2 — Node / Bun / Deno sidecar

The user doesn't have Node installed and you can't ask them to. So a JS
sidecar in a Tauri app means: compile your script to a single self-contained
binary, drop it under `src-tauri/binaries/<basename>-<triple>[.exe]`, and
spawn it like any other sidecar.

This skill is the playbook for that whole loop: which compiler to pick, how
to keep the dev iteration fast (don't recompile a 60+ MB binary on every
HTML change), and the two communication patterns that actually work — local
HTTP and stdio.

See [[tauri-sidecar]] for the broader sidecar story, [[tauri-sidecar-target-triples]]
for the naming rules and build script, and [[tauri-sidecar-lifecycle]] for
keeping the child process tame.

## Pick a compiler

| Tool                  | Runtime | When to pick it                                                                          |
| --------------------- | ------- | ---------------------------------------------------------------------------------------- |
| `bun build --compile` | Bun     | Bun-native code; smallest dev loop (~30–90 s compile, ~50–70 MB output); fast cold start |
| `@yao-pkg/pkg`        | Node    | Existing Node codebase with broad npm API usage; mature, well-trodden                    |
| `deno compile`        | Deno    | Deno-native code with explicit permissions; good security story                          |
| `nexe`                | Node    | Legacy; only when `pkg` won't handle your dependency graph                               |

All four produce one file. The naming convention is identical:
`<basename>-<TARGET_TRIPLE>[.exe]`. Tauri does not care which compiler
produced it.

This repo (`maximal`) ships a Bun-compiled proxy. See `scripts/build-sidecar.ts`
for a polished real-world example with mtime-skip, git-sha stamping, and
temp-file cleanup. The pattern generalises — see
`templates/bun-compile.sh` in this skill for a minimal cross-platform
invocation.

### Bun example

```sh
# Host build (auto-detect target):
bun build --compile src/main.ts --outfile=binaries/myproxy-$(rustc --print host-tuple)

# Cross-compile to another OS/arch:
bun build --compile --target=bun-windows-x64 \
  src/main.ts --outfile=binaries/myproxy-x86_64-pc-windows-msvc.exe
```

Bun's `--target` values:

| Target arg         | Sidecar filename suffix       |
| ------------------ | ----------------------------- |
| `bun-darwin-arm64` | `-aarch64-apple-darwin`       |
| `bun-darwin-x64`   | `-x86_64-apple-darwin`        |
| `bun-linux-x64`    | `-x86_64-unknown-linux-gnu`   |
| `bun-linux-arm64`  | `-aarch64-unknown-linux-gnu`  |
| `bun-windows-x64`  | `-x86_64-pc-windows-msvc.exe` |

### pkg example

```sh
npx @yao-pkg/pkg . \
  --targets node20-macos-arm64,node20-win-x64,node20-linux-x64 \
  --out-path binaries
# then rename pkg's outputs to add the Rust triple suffix Tauri expects
```

`pkg` writes `<name>-<plat>-<arch>` by default; you'll need a rename
step. The template script handles it.

## Two communication patterns

### A. Local HTTP server (most JS sidecars want this)

The JS program is a real HTTP server bound to `127.0.0.1:<port>`; the
WebView calls it with `fetch()`. No `invoke()`, no Rust glue, no streaming
serialization — just normal web code.

Advantages:

- **No capability needed for the WebView's outbound HTTP** if the CSP
  `connect-src` allows `http://localhost:<port>` and you're not using the
  `tauri-plugin-http` plugin.
- **Standalone-debuggable**: run the binary outside Tauri, point a browser
  at it, full devtools.
- **SSE, WebSockets, multipart, etc. all "just work"** — they're HTTP.

This is what `maximal` does: the proxy listens on `:4142`, the settings UI
in `shell/src/` calls it. The Tauri shell only ever spawns the binary; it
never proxies the traffic.

Pin the port (`:4142` here) or do a port-bind dance and emit the port
back to JS via a Tauri event. Fixed ports are simpler but risk collision;
production sidecars usually prefer `port: 0` + event emit. See
`shell/src-tauri/src/lib.rs` for how this repo lands on a fixed port.

### B. Stdin/stdout pipe

For a one-shot tool or a request/response that doesn't need a network port,
spawn with the shell plugin and pipe newline-delimited JSON:

```rust
let (mut rx, mut child) = app.shell().sidecar("mytool")?.spawn()?;
child.write(b"{\"op\":\"render\",\"input\":\"...\"}\n")?;

while let Some(event) = rx.recv().await {
    if let CommandEvent::Stdout(line) = event {
        let resp: Response = serde_json::from_slice(&line)?;
        // ...
    }
}
```

See `templates/node-sidecar-spawn.rs` for a complete request/response
helper with timeouts.

Pros: no port. Cons: every message is JSON-stringified twice (once for
stdio, once for IPC to JS). For high-throughput data, HTTP is better.

## The dev-loop trap (and the fix)

A compiled JS sidecar is 50–70 MB. Recompiling on every iteration kills
flow. The repo's CLAUDE.md spells out the working pattern:

```sh
# Terminal A — proxy with file watch on :4142 (the same port the
# packaged sidecar uses).
bun run dev -- start --port 4142

# Terminal B — Vite for the WebView UI.
bun run app:ui   # serves shell/src/ at http://localhost:1420/
```

The UI's HTTP client (`shell/src/api.ts`) branches on `import.meta.env.DEV`
and points at `:4142` in dev, or at `/` (same-origin sidecar) in production.
A `safeInvoke()` wrapper swallows Tauri-only `invoke()` calls when running
in a plain browser. Result: every HTML/CSS/TS edit hot-reloads under
Vite, and you never touch the 30–90 s Bun compile during UI work.

Only run `tauri dev` (with the real sidecar) when you change Rust code or
the IPC surface. The `bun run app:sidecar` script in this repo is
mtime-gated, so even those runs skip the compile when nothing under
`src/` has changed.

## Capabilities

Even a "no plugin needed" HTTP pattern needs the shell capability for the
`spawn()` itself:

```json
{
  "identifier": "shell:allow-spawn",
  "allow": [
    {
      "name": "binaries/myproxy",
      "sidecar": true,
      "args": ["--port", { "validator": "^\\d{2,5}$" }]
    }
  ]
}
```

`allow-spawn` is the long-running form (you get an `rx` stream). Use
`allow-execute` for one-shot tools. If you `child.kill()` from JS, add
`shell:allow-kill`.

The WebView's `fetch('http://localhost:4142/...')` does **not** need
`shell:` — it's a normal browser request. It does need the CSP
`connect-src` to allow that origin. The default Tauri CSP is permissive
enough; tightening it (recommended) means adding `http://localhost:4142`
explicitly.

## Make sure the child dies

This is the #1 sidecar bug on macOS: orphaned Bun/Node processes after
quit. Tauri does not kill sidecars automatically. See
[[tauri-sidecar-lifecycle]] for the full pattern; the short version is
`app.manage(Mutex<Option<CommandChild>>)` + `kill()` on `RunEvent::ExitRequested`.

Node and Bun handle SIGTERM cleanly by default (they exit the event loop
and run shutdown handlers). If you've installed your own SIGINT/SIGTERM
listeners, make sure they actually exit — a swallowed signal becomes an
orphan.

## Verification

1. `ls src-tauri/binaries/` shows one file per target triple.
2. `file src-tauri/binaries/myproxy-<triple>` reports a binary (not a
   shell script, not a 1 KB stub).
3. Run the binary standalone outside Tauri: it should serve / respond.
4. `tauri dev` spawns it; the WebView talks to it; you see logs in the
   Tauri console.
5. Quit. `ps aux | grep myproxy` reports nothing.
6. `tauri build` produces an installer; install + launch; sidecar still
   works in the packaged app.

## Gotchas

- **`pkg` can't bundle native `.node` modules** that load via dynamic
  paths. Use `bun build --compile` or vendor the prebuild explicitly.
- **`bun build --compile` writes temp files** in CWD as
  `.<hex>-<n>.bun-build`; an interrupted compile leaves orphans. Sweep
  them in your build script (the repo's `scripts/build-sidecar.ts` does).
- **Bun-compiled binaries are stripped of source maps** by default —
  stack traces show `compiled/...` paths. Pass
  `--sourcemap=external` if you need to debug.
- **CORS** when the WebView hits `http://localhost:4142`: same-origin
  with `tauri://` (or `http://tauri.localhost`) is not automatic. Either
  send `Access-Control-Allow-Origin: *` from the sidecar or use
  `tauri-plugin-http` to proxy.
- **Dev port collision.** If you run two copies of the dev shell, the
  second sidecar's port-bind fails silently inside the Tauri console.
  Always check the proxy's stdout for "listening on" before debugging
  WebView 502s.

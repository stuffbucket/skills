---
name: tauri-setup-vite
description: Use when wiring Vite into a Tauri v2 project — writing `vite.config.ts`, setting `package.json` scripts, configuring `frontendDist`/`devUrl` in `tauri.conf.json`, exposing `TAURI_ENV_*` vars to the frontend, fixing iOS/Android HMR over `TAURI_DEV_HOST`, or diagnosing port/host mismatches between Vite and Tauri.
---

# Vite + Tauri v2 Integration

The Vite frontend and Tauri shell are two processes that must agree on **one port** and **one
host**. Almost every "blank window on `tauri dev`" or "HMR not connecting on iPhone" symptom traces
back to a mismatch between four values:

- `server.port` in `vite.config.ts`
- `server.host` (or `TAURI_DEV_HOST`)
- `build.devUrl` in `tauri.conf.json`
- `build.frontendDist` (production) pointing at Vite's output dir

This skill documents the exact pairing the Tauri team ships in `create-tauri-app`, plus the why
behind each line. Copy from `templates/vite.config.ts` and `templates/package.json` for a known-good
baseline.

## Checklist

- [ ] Vite `server.port` matches the port in `tauri.conf.json#build.devUrl`. Default in this skill:
  **1420** (not Vite's default 5173 — Tauri's scaffolder picks 1420 to avoid clashes with other Vite
  projects).
- [ ] `strictPort: true` so Vite fails fast if the port is taken — Tauri will not auto-rebind.
- [ ] `clearScreen: false` so Rust compile errors stay visible.
- [ ] `host: process.env.TAURI_DEV_HOST || false` so `tauri dev` on a physical phone exposes Vite on
  the LAN.
- [ ] HMR `protocol: 'ws'`, separate port (e.g. 1421) when `TAURI_DEV_HOST` is set.
- [ ] `watch.ignored: ['**/src-tauri/**']` to stop Vite re-bundling on Rust edits.
- [ ] `envPrefix: ['VITE_', 'TAURI_ENV_*']` so `import.meta.env.TAURI_ENV_PLATFORM` works in the
  frontend.
- [ ] `build.target` keyed on `TAURI_ENV_PLATFORM` (`chrome105` on Windows, `safari13` on
  macOS/Linux).
- [ ] `build.frontendDist` in `tauri.conf.json` set to `../dist` (relative to `src-tauri/`).

## tauri.conf.json snippet

```json
{
  "build": {
    "beforeDevCommand": "bun run dev",
    "beforeBuildCommand": "bun run build",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  }
}
```

Swap `bun` for `npm`/`pnpm`/`yarn`/`deno task` to taste — Tauri just runs the string as a shell
command.

## Why these settings

| Setting                               | Why                                                                                                                                                                        |        |                                                                                                                                                                                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `strictPort: true`                    | If Vite picks a different port (e.g. 5174), Tauri still loads `http://localhost:1420` and shows a blank window. Failing fast surfaces the real problem.                    |        |                                                                                                                                                                                                                                                |
| `clearScreen: false`                  | Vite clears the terminal on start; on a Rust build error you'd lose the cargo output.                                                                                      |        |                                                                                                                                                                                                                                                |
| `host: TAURI_DEV_HOST \               | \                                                                                                                                                                          | false` | When running `tauri ios dev` / `tauri android dev`, the CLI sets `TAURI_DEV_HOST` to your machine's LAN IP and the webview on the phone loads from that IP. Without this binding Vite only listens on `localhost`, unreachable from the phone. |
| HMR `protocol: 'ws'` + separate port  | The webview on iOS/Android can't share the HTTP port for HMR upgrades; a dedicated ws port (1421) avoids CORS/upgrade quirks.                                              |        |                                                                                                                                                                                                                                                |
| `watch.ignored: src-tauri`            | Editing Rust files would otherwise trigger Vite full reloads in addition to cargo rebuilds.                                                                                |        |                                                                                                                                                                                                                                                |
| `envPrefix: ['VITE_', 'TAURI_ENV_*']` | Tauri exposes platform metadata as `TAURI_ENV_PLATFORM`, `TAURI_ENV_ARCH`, `TAURI_ENV_DEBUG`, etc. Without the prefix, Vite strips them from `import.meta.env`.            |        |                                                                                                                                                                                                                                                |
| `target` per platform                 | Tauri uses Edge WebView2 on Windows (Chromium 105+) and WKWebView on macOS/Linux (Safari 13+ surface). Targeting them keeps bundles small and avoids Babel polyfill bloat. |        |                                                                                                                                                                                                                                                |

## Project layout (Vite SPA, the common case)

```text
my-app/
  index.html
  package.json
  vite.config.ts
  src/
    main.ts
  src-tauri/
    Cargo.toml
    tauri.conf.json
    src/lib.rs
    src/main.rs
```

Vite's output goes to `dist/` at the repo root; `frontendDist: "../dist"` is relative to
`src-tauri/`.

## SPA vs SSR pitfalls

Tauri serves **static files** from `frontendDist` in production. That means:

- **SPA (Vite default):** works out of the box. `index.html` + JS bundle + asset hashing.
- **SSR (Nuxt, SvelteKit, Next):** must be configured for **static export / SSG**. There is no Node
  server inside the Tauri shell. Use each framework's static adapter; see those framework-specific
  docs. Generic Vite (`vite build` → `dist/`) is the path of least resistance.

## Bridging env vars to the frontend

Inside `vite.config.ts` you read `process.env.TAURI_ENV_PLATFORM` (Node side, build-time). Inside
the frontend (`src/main.ts`), use:

```ts
const platform = import.meta.env.TAURI_ENV_PLATFORM; // 'macos' | 'windows' | 'linux' | 'ios' | 'android'
const isDebug  = import.meta.env.TAURI_ENV_DEBUG === 'true';
```

`TAURI_ENV_*` is only populated when launched via `tauri dev`/`tauri build`. Under plain `vite dev`
(no Tauri), these are undefined — guard against that for browser-only iteration.

## Common failures

| Symptom                                                                          | Cause                                   | Fix                                        |
| -------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------ |
| Tauri window is blank, terminal shows `failed to load url http://localhost:1420` | Vite port mismatch                      | align `server.port` and `devUrl`           |
| `Error: Port 1420 is already in use`                                             | another Vite instance                   | kill it; `strictPort: true` is intentional |
| HMR works on desktop but phone says "connecting…" forever                        | `host` not set when `TAURI_DEV_HOST` is | use the template's ternary                 |
| Production build loads but shows 404s for `/assets/*`                            | `frontendDist` points wrong             | relative to `src-tauri/`, so `../dist`     |
| `import.meta.env.TAURI_ENV_PLATFORM` is undefined in built app                   | `envPrefix` missing `TAURI_ENV_*`       | add it                                     |
| Vite reruns on every Rust save                                                   | missing `watch.ignored`                 | add `['**/src-tauri/**']`                  |
| Production Windows build crashes on optional chaining                            | `build.target` too modern               | clamp to `chrome105` on Windows            |

## Templates

- `templates/vite.config.ts` — drop-in, mobile-ready, TS strict.
- `templates/package.json` — minimal scripts block (Bun-flavoured; works under npm/pnpm/yarn by
  swapping the runner).

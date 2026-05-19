---
name: tauri-plugin-dev-guest-js
description: Use when authoring the npm-package half of a Tauri v2 plugin — the `guest-js/index.ts` exporting friendly wrappers around `invoke('plugin:my-plugin/cmd_name', args)`, typed `Channel` streaming wrappers, `addPluginListener('plugin-name', 'event-name', cb)` for native-emitted events, the `package.json` `exports` map for dual ESM/CJS, bundling with `tsup` or `rollup`, lockstep versioning with the Rust crate, and the publish workflow.
---

# The Guest JS Package

A Tauri plugin's npm package is the typed JS surface app developers actually import. The Rust crate
exposes commands at the IPC string `plugin:<name>|<cmd_name>` — uncomfortable to type and easy to
typo. The guest-js package wraps each command in a named export with proper TypeScript types so
consumers write `await openCamera({ quality: 90 })` instead of
`invoke('plugin:my-plugin|open_camera', { quality: 90 })`.

Builds on `tauri-plugin-dev` (the crate side) and `tauri-plugin-dev-mobile-bridges` (native commands
you might wrap).

## Layout

```text
guest-js/
├── index.ts            # the public surface
└── (optional more .ts) # split per feature if it gets big
dist-js/                # build output: index.js (ESM), index.cjs, index.d.ts
package.json
tsup.config.ts          # or rollup.config.js
```

`guest-js/` is the **source**, `dist-js/` is the **publish artifact**. Both are tracked in git in
most plugin repos so consumers depending on a git ref still work without a build step.

## The basic command wrapper

```ts
// guest-js/index.ts
import { invoke } from '@tauri-apps/api/core';

export interface CameraRequest {
  quality: number;
  allowEdit?: boolean;
  note?: string | null;
}

export interface Photo {
  path: string;
}

export async function openCamera(req: CameraRequest): Promise<Photo> {
  return await invoke<Photo>('plugin:my-plugin|open_camera', { req });
}
```

Two things to get right:

1. **The command identifier is `plugin:<runtime-name>|<rust-fn-name>`.** The runtime name is the
   string passed to `Builder::new("my-plugin")` in `src/lib.rs` — **not** the crate name. Snake_case
   for the function name, matching `#[tauri::command]` exactly.
2. **`invoke` args are an object whose keys map to the Rust handler's parameter names.** A Rust
   handler `async fn open_camera(req: CameraRequest)` wants `{ req: {...} }`, not `{...}` flat. To
   go flat, the Rust side has to take individual params (`async fn open_camera(quality: u32,
   allow_edit: bool)`) and then the JS side passes `{ quality, allowEdit }` (camelCase, Tauri
   rewrites it).

## Streaming via `Channel<T>`

For long-running commands that emit progress, wrap the channel construction so the caller doesn't
have to:

```ts
import { invoke, Channel } from '@tauri-apps/api/core';

export type DownloadEvent =
  | { event: 'started'; data: { id: number } }
  | { event: 'progress'; data: { bytes: number; total: number } }
  | { event: 'finished'; data: { id: number } };

export async function download(
  url: string,
  onEvent: (e: DownloadEvent) => void,
): Promise<void> {
  const channel = new Channel<DownloadEvent>();
  channel.onmessage = onEvent;
  return await invoke('plugin:my-plugin|download', { url, onEvent: channel });
}
```

The Rust side declares `on_event: Channel<DownloadEvent>` as a parameter and calls `.send(...)`.
Channels survive a single command call — for sustained streams (e.g. a tray clock tick), use plugin
events instead. See `tauri-events-channels-streaming` for the channel deep dive.

## Listening to plugin events (`addPluginListener`)

Native code (Kotlin/Swift `trigger(...)`) or Rust setup hooks (`app.emit(...)`) push named events.
Wrap `addPluginListener` so consumers don't have to remember the plugin-name string:

```ts
import { addPluginListener, type PluginListener } from '@tauri-apps/api/core';

export async function onCameraOpened(
  handler: (data: { path: string }) => void,
): Promise<PluginListener> {
  return await addPluginListener('my-plugin', 'cameraOpened', handler);
}
```

Caller gets a `PluginListener` they can `.unregister()` later. **Listening is gated by the same
capability + permission system as commands** — the plugin must declare an event listener permission
(commonly bundled into `default`) and the app's capability has to grant it. Document that in your
README.

## `package.json` for a dual ESM/CJS publish

Modern bundlers prefer ESM; some legacy app code still imports CJS. Ship both with an `exports` map:

```jsonc
{
  "name": "@my-org/plugin-my-plugin",
  "version": "0.1.0",
  "description": "JS bindings for the my-plugin Tauri plugin.",
  "type": "module",
  "main": "./dist-js/index.cjs",
  "module": "./dist-js/index.js",
  "types": "./dist-js/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist-js/index.d.ts",
      "import": "./dist-js/index.js",
      "require": "./dist-js/index.cjs"
    }
  },
  "files": ["dist-js", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsup",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.4.0"
  },
  "peerDependencies": {
    "@tauri-apps/api": "^2.0.0"
  }
}
```

Key points:

- **`@tauri-apps/api` as a peer dep**, not a direct dep — the app brings its own copy and they must
  match.
- **`files`** restricts what gets uploaded: just the build output + docs. Source `guest-js/` lives
  in git but not in the published tarball.
- **`prepublishOnly`** is the safety net so `npm publish` never ships a stale `dist-js/`.

## Building with `tsup`

`tsup` is the lowest-friction option — one config produces ESM, CJS, and `.d.ts` files in a single
pass:

```ts
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['guest-js/index.ts'],
  outDir: 'dist-js',
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['@tauri-apps/api', '@tauri-apps/api/core'],
});
```

`external` keeps the Tauri API import out of the bundle — consumers always have their own copy via
the peer dep.

`rollup` works too and is what the official tauri-apps/plugins-workspace repo uses; pick `tsup`
unless you need rollup-specific plugins.

## Lockstep versioning with the Rust crate

The npm package and the Cargo crate ship as a pair. Diverging versions confuse everyone. Two
strategies:

1. **Single-version-of-truth**: a release script reads `Cargo.toml`'s `version`, writes the same
   string into `package.json`, then publishes both. Cleanest, most plugin authors do this.
2. **Independent versions**: tolerable for tiny patch-level changes (e.g. fixing a typo in a
   TypeScript JSDoc comment) but breaks audit trails. Avoid.

If you support Tauri 1.x AND 2.x out of one repo, use a major-version split (1.x → branch `v1`, 2.x
→ branch `v2`) rather than two npm tags on `latest`.

## Publishing workflow

Manual:

```sh
# 1. Bump versions in lockstep
#    edit Cargo.toml + package.json so both are 0.2.0

# 2. Build + smoke-test against a real app
bun run build

# 3. Tag and push
git tag v0.2.0 && git push --tags

# 4. Publish (npm runs prepublishOnly → tsup → publishes dist-js/)
npm publish --access public
cargo publish
```

In CI, gate `cargo publish` and `npm publish` on the same tag push so a half-published release (one
but not the other) becomes impossible.

## Common traps

- **Wrong command identifier**: typo'd `plugin:my-plugin|open_camera` (e.g. `open-camera` with
  hyphens) silently fails with "command not found". Centralize the string in one constant per
  command.
- **Field-name casing**: Rust `allow_edit` ↔ TS `allowEdit`. Tauri rewrites snake_case ↔ camelCase
  across the boundary, so write TS in camelCase. The Rust struct should derive `#[serde(rename_all =
  "camelCase")]` so error messages line up too.
- **Forgetting `peerDependencies`**: bundling your own `@tauri-apps/api` doubles the global IPC
  client and breaks event listeners. Always peer-dep.
- **Publishing `guest-js/` instead of `dist-js/`**: the `files` array (or `.npmignore`) must scope
  to the build output. Consumers can't `import` raw TS.
- **Missing `exports` map**: some bundlers fall back to `main` and silently ship the CJS build to
  ESM consumers, breaking tree-shaking. Always include the conditional exports map.

## Templates

- `templates/guest-js/index.ts` — sample wrappers covering a simple command, a `Channel<T>`
  streaming command, and `addPluginListener`.
- `templates/guest-js/package.json` — `exports` map, peer dep on `@tauri-apps/api`, `prepublishOnly`
  build hook.
- `templates/guest-js/tsup.config.ts` — dual ESM/CJS + `.d.ts` build, externals correctly set.

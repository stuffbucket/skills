---
name: tauri-architecture-size-optimization
description: Use when shrinking a Tauri v2 release binary — tuning the Cargo release profile (`opt-level`, `lto`, `codegen-units`, `panic`, `strip`), enabling `build.removeUnusedCommands`, pruning default features on `tauri` and plugin crates, frontend tree-shaking via Vite `manualChunks` and dynamic imports, optional UPX compression with its platform caveats, and measuring with `cargo bloat` and `du`.
---

# Tauri v2 Size Optimization

Tauri apps are already small because the WebView is OS-provided, but a default `tauri build` still
produces a 5–15 MB binary plus frontend assets. Most of that is reducible. This skill is the
playbook in roughly the order you should apply it — Cargo profile first (biggest win for least
effort), then feature pruning, then frontend, then UPX as a last resort.

Measure before and after each step. A `du -h src-tauri/target/release/<app>` after every change
keeps you honest.

## 1. Cargo release profile (highest ROI)

Edit `src-tauri/Cargo.toml` (see `templates/Cargo.toml.profile-snippet`):

```toml
[profile.dev]
incremental = true

[profile.release]
codegen-units = 1     # one unit → more inlining, smaller code
lto = true            # link-time optimization across crates
opt-level = "s"       # "s" balances size+perf; "z" is smaller but slower
panic = "abort"       # strip unwinding tables (no panic = unwind support)
strip = true          # remove symbols
```

`opt-level` choice:

- `"s"` — recommended default. Size-optimized but still uses some loop/inlining heuristics.
- `"z"` — most aggressive size. Disables loop vectorization. Worth trying; sometimes ~5–10% smaller,
  sometimes negligibly slower in practice.
- `"3"` — performance, larger. Use only if you've measured a perf regression from `"s"`/`"z"`.

`lto = true` (equivalent to `"fat"`) is the right default. `"thin"` builds faster but optimizes
less. Only matters for release builds.

`codegen-units = 1` is the single biggest size lever after LTO. It serializes codegen (slower
compile) but lets the optimizer see everything.

`panic = "abort"` saves ~100–300 KB by removing unwinding metadata. Cost: panics crash instead of
unwinding. For a user-facing app this is usually fine — you'd rather crash and restart than continue
in a half-broken state.

### Nightly-only extras

If you build on nightly, add to `[profile.release]`:

```toml
trim-paths = "all"                      # remove embedded build paths (also privacy)
rustflags = ["-Cdebuginfo=0", "-Zthreads=8"]
```

`trim-paths` removes `/Users/<you>/…` strings from the binary. Privacy benefit, mild size benefit.

## 2. Remove unused commands

Requires Tauri 2.4+, `tauri-build` 2.1+, `tauri-plugin` 2.1+, `tauri-cli` 2.4+.

In `src-tauri/tauri.conf.json`:

```json
{
  "build": {
    "removeUnusedCommands": true
  }
}
```

The build tools generate a list of allowed commands from your capability ACL (see `tauri-security`),
and the `generate_handler!` macro drops everything not in that list. Plugins ship with many commands
you typically don't use — this prunes them at compile time.

Typical savings: 200 KB to 1 MB depending on how many plugins are in use.

Catch: if a window's capability later needs a command you pruned, the build fails — wire ACLs first,
then enable this.

## 3. Prune default features

Most Tauri crates enable a lot by default. Audit each:

```toml
[dependencies]
tauri = { version = "2", default-features = false, features = ["wry"] }
tauri-plugin-fs = { version = "2", default-features = false }
tauri-plugin-http = { version = "2", default-features = false }
```

Safe-to-disable on `tauri` itself if unused: `tray-icon`, `image-png`, `image-ico`,
`protocol-asset`, `devtools` (release builds), `macos-private-api`. Test on every target OS after —
some features are platform-conditional.

Disable default features on plugins you only use one method of (e.g., `tauri-plugin-http` defaults
pull in cookie + redirect handling). Re-enable only what you call.

Audit unused plugins entirely. A `tauri-plugin-shell` in `Cargo.toml` you don't actually invoke
still costs binary size.

## 4. Frontend tree-shaking and code-splitting

The frontend bundle ships inside the binary (or alongside it). It's often the second-largest
contributor after the Rust binary.

In `vite.config.ts`:

```ts
build: {
  target: 'es2020',
  minify: 'esbuild',
  cssMinify: true,
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom'],  // split heavy deps
      },
    },
  },
},
```

Tactics:

- **Dynamic imports** for routes/features used post-launch: `const settings = await
  import('./settings')`. Keeps initial bundle small.
- **`manualChunks`** to split vendor code so app code changes don't invalidate vendor cache during
  dev.
- **Drop polyfills** — Tauri targets modern WebViews (WKWebView, WebView2, recent webkitgtk).
  `target: 'es2020'` or newer is safe.
- **Audit with `vite build --report`** or `rollup-plugin-visualizer` to see what's actually
  shipping.

Avoid: shipping source maps in release (Vite's default `build.sourcemap: false` is correct),
bundling icon fonts when SVG sprites would do, importing whole utility libraries when one function
would do (`import { debounce } from 'lodash-es'` not `import _ from 'lodash'`).

See `templates/tauri.conf.size.json` for the size-focused Tauri config snippet.

## 5. UPX (last-resort compression)

UPX compresses the binary in-place. Apply it after `tauri build`:

```sh
upx --best --lzma src-tauri/target/release/<app>
```

Realistic gains: 50–70% smaller binary on disk. Caveats:

- **macOS code signing breaks.** UPX modifies the Mach-O; signature invalidates. You'd have to UPX
  *then* sign, but Apple's notarization will reject UPX-packed binaries in some configurations. In
  practice: don't UPX macOS release builds.
- **Windows antivirus false positives.** UPX-packed binaries trigger heuristics in many AV products
  because malware also uses UPX. Submit to Microsoft SmartScreen for reputation if you go this
  route.
- **Linux is fine.** Best target for UPX.
- **Startup cost.** UPX decompresses into memory at launch. Adds 50–200 ms cold-start, usually
  unnoticeable.
- **Doesn't actually save RAM.** The binary on disk is smaller; the runtime image is the same size.

Use UPX only if disk size matters more than these costs — typically Linux distro packaging or
download-size-sensitive scenarios. For a normal desktop app, skip it.

## 6. Measure

Don't optimize blind. Two tools:

```sh
# Per-crate / per-function size attribution. Requires `cargo install cargo-bloat`.
cargo bloat --release --crates       # what crates dominate
cargo bloat --release -n 30           # top 30 functions by size

# Just the file size, before/after each change.
du -h src-tauri/target/release/<app>
```

`cargo bloat --crates` is the highest-signal output — it tells you whether `tauri`, `regex`,
`serde_json`, or some plugin is your real cost center. Optimize where the bytes are.

For frontend, `vite build` already prints a per-chunk size report.

## Realistic targets

For a small/medium Tauri 2 app with thoughtful feature pruning:

- Rust binary: 4–8 MB stripped, no UPX
- Frontend bundle: 100–500 KB gzipped
- Final installer (dmg/msi/AppImage): 5–15 MB

Below that requires either aggressive UPX (Linux only) or stripping plugins to the bone.

## See also

- `tauri-architecture` — why the binary is small to begin with (dynamic WebView linking)
- `tauri-bundling` — installer-level packaging (compression already applied by .dmg/.msi formats)
- `tauri-security` — capability ACLs that drive `removeUnusedCommands`
- `tauri-plugins` — choosing which plugins to include in the first place

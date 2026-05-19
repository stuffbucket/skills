---
name: tauri-sidecar-target-triples
description: Use when picking, naming, or automating per-target sidecar binaries in a Tauri v2 app — Rust target triples for macOS (incl. universal `lipo`), Windows, Linux glibc baselines, iOS/Android mobile, how `tauri build --target` resolves the suffix, the strict ``basename`-`triple`[.exe]` filename rule, and writing a build script that produces every required binary atomically.
---

# Tauri v2 — Sidecar Target Triples

Tauri picks the sidecar binary by **exact filename match** against the current
build target's Rust triple. Get one character wrong and `tauri build` fails
with `binary not found`. This skill is the reference for the triples you'll
ship, how Tauri resolves them, and how to script the build so the right files
land in `src-tauri/binaries/` before `tauri build` runs.

See [[tauri-sidecar]] for the broader sidecar story and [[tauri-bundling]] for
what happens to these binaries inside the installer.

## The naming rule

For every entry in `tauri.conf.json > bundle.externalBin`, a file must exist
at `src-tauri/<path>-<TARGET_TRIPLE>` (plus `.exe` on Windows). Examples:

```text
externalBin: ["binaries/myproxy"]
→ src-tauri/binaries/myproxy-aarch64-apple-darwin
→ src-tauri/binaries/myproxy-x86_64-apple-darwin
→ src-tauri/binaries/myproxy-x86_64-pc-windows-msvc.exe
→ src-tauri/binaries/myproxy-x86_64-unknown-linux-gnu
```

The `.exe` extension goes **after** the triple, not before. `myproxy.exe-...`
is wrong; `myproxy-...-msvc.exe` is right. There is no fallback search and
no glob — Tauri concatenates `basename + "-" + triple [+ ".exe"]` and opens
that exact path.

## How `tauri build` resolves the triple

| Invocation                                    | Triple used                                                  |
| --------------------------------------------- | ------------------------------------------------------------ |
| `tauri build` (no `--target`)                 | Host triple from `rustc -vV` `host:` line                    |
| `tauri build --target aarch64-apple-darwin`   | That triple, verbatim                                        |
| `tauri build --target universal-apple-darwin` | Both Apple triples; Tauri runs `lipo`                        |
| `tauri ios build`                             | `aarch64-apple-ios` (device); simulator uses `*-sim` triples |
| `tauri android build`                         | One per ABI under `bundle.android.minSdkVersion`             |

Get the host triple yourself:

```sh
rustc --print host-tuple   # Rust >= 1.84
rustc -vV | grep '^host:'  # older toolchains
```

## Reference: triples by OS

### macOS

| Arch                     | Triple                 |
| ------------------------ | ---------------------- |
| Apple Silicon (M-series) | `aarch64-apple-darwin` |
| Intel                    | `x86_64-apple-darwin`  |

For a single universal binary, build both then merge:

```sh
lipo -create \
  binaries/myproxy-aarch64-apple-darwin \
  binaries/myproxy-x86_64-apple-darwin \
  -output binaries/myproxy-universal-apple-darwin
```

Tauri also accepts the two non-universal files and will do the `lipo` itself
when you pass `--target universal-apple-darwin`.

### Windows

| Arch          | Triple                                                              |
| ------------- | ------------------------------------------------------------------- |
| x64 (default) | `x86_64-pc-windows-msvc`                                            |
| ARM64         | `aarch64-pc-windows-msvc`                                           |
| GNU toolchain | `x86_64-pc-windows-gnu` (rare; only if you've explicitly set it up) |

Always `.exe` after the triple. Tauri's MSI/NSIS bundler will not auto-add it.

### Linux

| Arch / libc  | Triple                      |
| ------------ | --------------------------- |
| x64, glibc   | `x86_64-unknown-linux-gnu`  |
| ARM64, glibc | `aarch64-unknown-linux-gnu` |
| x64, musl    | `x86_64-unknown-linux-musl` |

**glibc baseline matters.** The binary inherits the glibc version of the
build host. A sidecar compiled on Ubuntu 24.04 (glibc 2.39) will refuse to
load on Ubuntu 20.04 (glibc 2.31). For broad reach, build inside the oldest
distro you intend to support — `manylinux` containers or an Ubuntu 20.04 LTS
runner are the standard choices. If you can't pin a baseline, ship the musl
triple instead.

### Mobile

| Platform                           | Triple                    |
| ---------------------------------- | ------------------------- |
| iOS device                         | `aarch64-apple-ios`       |
| iOS simulator (Apple Silicon host) | `aarch64-apple-ios-sim`   |
| iOS simulator (Intel host)         | `x86_64-apple-ios`        |
| Android arm64 device               | `aarch64-linux-android`   |
| Android x86_64 emulator            | `x86_64-linux-android`    |
| Android armv7 device (legacy)      | `armv7-linux-androideabi` |

Sidecars on iOS/Android are unusual — the OS sandbox limits process spawn
heavily and the App Store rejects most cases. Confirm the use case before
investing.

## The build-script pattern

Producing the right files reliably is the whole game. The repo's
`scripts/build-sidecar.ts` is a working example for a Bun-compiled proxy:
it derives the host triple from `rustc -vV`, maps it to a `bun build
--compile --target=<bun-target>` argument, mtime-skips when nothing under
`src/` has changed, sweeps interrupted `bun build` temp files, and writes
atomically to `shell/src-tauri/binaries/maximal-<triple>`.

The shape is portable to any compiler. See
`templates/build-sidecar.ts` in this skill's directory for a generalised
version that:

1. Resolves the host triple (or a `--target` override).
2. Picks the right compiler invocation (`cargo build --release --target` for
   Rust, `bun build --compile --target` for Bun, `go build` for Go,
   `pkg --target` for Node).
3. Compiles to a `.tmp` path under `src-tauri/binaries/`.
4. `chmod +x` then atomic `rename()` over the final filename.
5. Refuses to ship if the produced file is `< 1 KB` (catches silent compiler
   failures that exit 0 but leave a stub behind).

## CI matrix

A release pipeline typically runs one job per (OS runner × arch) pair, each
producing its slice of `src-tauri/binaries/`. The simplest layout:

| Runner                                      | Target triple              | Sidecar suffix                |
| ------------------------------------------- | -------------------------- | ----------------------------- |
| `macos-14` (arm64)                          | `aarch64-apple-darwin`     | `-aarch64-apple-darwin`       |
| `macos-14` + `--target x86_64-apple-darwin` | `x86_64-apple-darwin`      | `-x86_64-apple-darwin`        |
| `windows-latest`                            | `x86_64-pc-windows-msvc`   | `-x86_64-pc-windows-msvc.exe` |
| `ubuntu-22.04`                              | `x86_64-unknown-linux-gnu` | `-x86_64-unknown-linux-gnu`   |

The macOS universal bundle is then a separate job that downloads the two
arch artefacts and runs `lipo`. Pin the Ubuntu version explicitly — the
default `ubuntu-latest` floats forward and silently raises your glibc
baseline.

## Verification

Before merging a sidecar change:

```sh
ls src-tauri/binaries/
file src-tauri/binaries/myproxy-aarch64-apple-darwin   # → Mach-O 64-bit arm64
file src-tauri/binaries/myproxy-x86_64-pc-windows-msvc.exe  # → PE32+ x86_64
```

Then `tauri build` once per target you ship. The bundler prints
`Embedding external binaries` lines — confirm yours appears.

## Gotchas

- **Stale temp files.** Compilers (especially `bun build --compile`) write
  to a hex-suffixed temp file and rename. An interrupted build leaves a
  60+ MB orphan in CWD. The template sweeps `.<hex>-<n>.bun-build` and
  `*.tmp` on every run.
- **`tauri dev` doesn't always need every triple** — only the host one.
  Release matrices need all of them. CI failures here are usually a
  forgotten `--force` on the sidecar build before `tauri build`.
- **`universal-apple-darwin` is not a real Rust triple.** Don't pass it
  to `cargo build` or `rustc`. It only exists inside Tauri's CLI as the
  signal to `lipo` two real outputs together.
- **Windows ARM64.** `aarch64-pc-windows-msvc` exists, but ARM64 WebView2
  has historically shipped late. Test before promising the SKU.

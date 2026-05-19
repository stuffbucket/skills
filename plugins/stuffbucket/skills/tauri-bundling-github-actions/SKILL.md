---
name: tauri-bundling-github-actions
description: Use when wiring a production GitHub Actions release pipeline for a Tauri v2 app — `tauri-apps/tauri-action@v0` matrix across `macos-latest` (Apple Silicon) / `macos-13` (Intel) / `windows-latest` / `ubuntu-22.04` / `ubuntu-22.04-arm`, declaring per-platform signing secrets (Apple notarization, Windows code-sign, Linux GPG, updater Ed25519, MS Store), tag-triggered vs manual `workflow_dispatch`, draft-release-then-publish, conditional updater artifact generation, and caching cargo + node_modules.
---

# Tauri v2 — GitHub Actions release pipeline

Pairs with [[tauri-bundling]] (host skill), the three per-OS sub-skills
([[tauri-bundling-macos-signing]], [[tauri-bundling-windows-signing]],
[[tauri-bundling-linux-packaging]]), and [[tauri-updater-signing-keys]].

The official `tauri-apps/tauri-action` does the heavy lifting: it calls `tauri build` with the right
`--target`, picks up signing env vars, optionally creates/updates a GitHub Release, uploads bundle
artifacts, and (when updater secrets are present) signs + uploads the `latest.json` manifest. Your
workflow's job is to wire up the matrix, secrets, and triggers.

---

## 1. Matrix shape

For a typical desktop release you want four-to-five runners running in parallel:

| Runner                         | Target                 | Produces                             |
| ------------------------------ | ---------------------- | ------------------------------------ |
| `macos-latest` (Apple Silicon) | `aarch64-apple-darwin` | `.app`, `.dmg`, updater artifact     |
| `macos-13` (Intel)             | `x86_64-apple-darwin`  | `.app`, `.dmg`, updater artifact     |
| `ubuntu-22.04` (x86_64)        | host default           | `.AppImage`, `.deb`, `.rpm`, updater |
| `ubuntu-22.04-arm` (aarch64)   | host default           | `.AppImage`, `.deb`, `.rpm`, updater |
| `windows-latest`               | host default           | `.msi`, `-setup.exe`, updater        |

Why not universal macOS? Universal binaries double download size for ~zero user benefit when
shipping over the updater (which downloads per-arch). Ship separate arm64/x86_64 dmgs.

`ubuntu-22.04-arm` is Linux-aarch64 — only available on public repos as of late 2024. On private
repos, drop it or self-host.

For mobile, add separate jobs (not matrix legs — they need different toolchains entirely). See
[[tauri-bundling-mobile-stores]].

---

## 2. Triggers

Two common patterns:

**Tag-triggered (recommended for product releases):**

```yaml
on:
  push:
    tags:
      - 'v*'
```

Pushing `v1.2.3` cuts a release named `v1.2.3` from that tag.

**Manual dispatch + push-to-release-branch (the official template):**

```yaml
on:
  workflow_dispatch:
  push:
    branches:
      - release
```

Useful when releases are gated by a human "go" rather than a tag conversation.

You can also combine — tags for prod, dispatch for hotfix dry-runs.

---

## 3. Required secrets per platform

Define in *Repo Settings → Secrets and variables → Actions*. **Never** put these in workflow files.

### Updater (all platforms)

- `TAURI_SIGNING_PRIVATE_KEY` — the Ed25519 private key contents (full file body)
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the passphrase you set on key generation

### macOS (Developer ID, distribute outside the Store)

- `APPLE_CERTIFICATE` — base64 `.p12` (`openssl base64 -A -in cert.p12`)
- `APPLE_CERTIFICATE_PASSWORD` — `.p12` export password
- `APPLE_SIGNING_IDENTITY` — full identity string like `Developer ID Application: Name (TEAMID)`
- `APPLE_ID` + `APPLE_PASSWORD` + `APPLE_TEAM_ID` (Apple ID notarization)
- `KEYCHAIN_PASSWORD` — any throwaway string used for the ephemeral keychain

Alternative for notarization (preferred):

- `APPLE_API_KEY` (the `.p8` *contents*, or a path), `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`

### Windows

Pick one of three:

- `WINDOWS_CERTIFICATE` (base64 `.pfx`) + `WINDOWS_CERTIFICATE_PASSWORD`
- Or a custom `signCommand` plus `AZURE_TENANT_ID` + `AZURE_CLIENT_ID` + `AZURE_CLIENT_SECRET` for
  Key Vault / Trusted Signing

### Linux signing

- `TAURI_SIGNING_RPM_KEY` — armored GPG private key contents
- `TAURI_SIGNING_RPM_KEY_PASSPHRASE`
- `APPIMAGETOOL_SIGN_PASSPHRASE` + `SIGN=1` + `SIGN_KEY` for AppImage

### GitHub

- `GITHUB_TOKEN` — provided automatically, just needs `permissions: contents: write`

---

## 4. The workflow

See `templates/release.yml` for the full battle-tested workflow. Key structural points (skim before
copying):

### Permissions

```yaml
permissions:
  contents: write   # to create releases + upload assets
```

The default `GITHUB_TOKEN` cannot write releases without this.

### Matrix include style (not cross-product)

```yaml
strategy:
  fail-fast: false
  matrix:
    include:
      - platform: macos-latest
        args: --target aarch64-apple-darwin
      - platform: macos-13
        args: --target x86_64-apple-darwin
      - platform: ubuntu-22.04
        args: ''
      - platform: ubuntu-22.04-arm
        args: ''
      - platform: windows-latest
        args: ''
```

`fail-fast: false` — one OS failing should not cancel the others.

### Per-OS prerequisite install

Ubuntu needs WebKit + GTK + AppIndicator headers; macOS/Windows runners have everything.

```yaml
- name: Install Linux deps
  if: startsWith(matrix.platform, 'ubuntu')
  run: |
    sudo apt-get update
    sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

### Caching

Two layers — Rust target dir and the JS package cache. Both are big wins on incremental release
builds.

```yaml
- name: Setup Node
  uses: actions/setup-node@v4
  with:
    node-version: lts/*
    cache: bun           # or pnpm / yarn / npm

- name: Setup Rust
  uses: dtolnay/rust-toolchain@stable
  with:
    targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin' || (matrix.platform == 'macos-13' && 'x86_64-apple-darwin' || '') }}

- uses: swatinem/rust-cache@v2
  with:
    workspaces: './src-tauri -> target'
```

### The action call

```yaml
- uses: tauri-apps/tauri-action@v0
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    # macOS
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
    APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
    KEYCHAIN_PASSWORD: ${{ secrets.KEYCHAIN_PASSWORD }}
    # Windows
    WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}
    WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
    # Updater
    TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
  with:
    tagName: app-v__VERSION__         # __VERSION__ is replaced with package.json version
    releaseName: 'App v__VERSION__'
    releaseBody: 'See the assets to download this version and install.'
    releaseDraft: true                # create as draft; publish manually after smoke-tests
    prerelease: false
    args: ${{ matrix.args }}
```

### Draft-then-publish

Always `releaseDraft: true` — you do not want broken artifacts to ship to your updater before you've
inspected them. Workflow ends with the release in draft state. Publish it manually (or via a
follow-up `gh release edit --draft=false` job that runs after smoke tests pass).

The updater's `latest.json` redirects via `releases/latest/download/...` only consider published
releases, so drafting is naturally safe.

---

## 5. The macOS keychain step

If you set the `APPLE_CERTIFICATE` secret, `tauri-action` handles the keychain import automatically.
If you're rolling your own (custom `signCommand`, or signing post-build), you need the steps from
[[tauri-bundling-macos-signing]] §5. The action's source is at
<https://github.com/tauri-apps/tauri-action> — read `src/index.ts` if you ever need to debug.

---

## 6. ARM Apple Silicon runner (the easy one)

GitHub's `macos-latest` is now Apple Silicon by default. Building `aarch64-apple-darwin` is native
and fast (~3–5 min for a typical Tauri app vs 10–15 for cross-compiled).

For Intel (`x86_64-apple-darwin`) pin `macos-13` — `macos-latest` no longer ships an Intel runner.
You'll need to `rustup target add x86_64-apple-darwin` and cross-compile, since `macos-13` itself is
now retiring; check GitHub's current runner inventory before locking a tag.

---

## 7. Mobile job (separate from desktop matrix)

iOS needs a macOS runner with Xcode; Android needs a Linux/macOS runner with the SDK. Put them in
their own jobs, not the desktop matrix, to keep concerns separate.

```yaml
build-ios:
  runs-on: macos-latest
  if: github.ref_type == 'tag'
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - uses: dtolnay/rust-toolchain@stable
      with:
        targets: aarch64-apple-ios
    - run: bun install
    - run: bun run tauri ios init
    - run: bun run tauri ios build --export-method app-store-connect
      env:
        APPLE_API_KEY_ID: ${{ secrets.APPLE_API_KEY_ID }}
        APPLE_API_ISSUER: ${{ secrets.APPLE_API_ISSUER }}
        IOS_CERTIFICATE: ${{ secrets.IOS_CERTIFICATE }}
        IOS_CERTIFICATE_PASSWORD: ${{ secrets.IOS_CERTIFICATE_PASSWORD }}
        IOS_MOBILE_PROVISION: ${{ secrets.IOS_MOBILE_PROVISION }}
```

---

## 8. Common failure modes

| Symptom                                                              | Cause                                                               | Fix                                                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Job-level `Error: HttpError: Resource not accessible by integration` | Missing `permissions: contents: write`                              | Add at workflow or job level                                                                   |
| macOS: "errSecInternalComponent" mid-build                           | Keychain wasn't unlocked after import                               | Confirm `KEYCHAIN_PASSWORD` env is the *same* secret used for `unlock-keychain`                |
| Notarization stuck at "In Progress" 30+ min                          | Apple-side queue; not a bug                                         | `--wait` will eventually return; or use `notarytool log` to inspect                            |
| Windows: `signtool` not found                                        | Workflow ran on a `macos`/`ubuntu` runner by mistake                | Check matrix `platform`; signtool ships with VS Build Tools on `windows-latest`                |
| Linux build runs but installer missing libwebkit                     | Built on `ubuntu-24.04` runner targeting `22.04` users              | Pin runner to `ubuntu-22.04` for max compat                                                    |
| Updater artifact missing for one platform                            | `TAURI_SIGNING_PRIVATE_KEY` not propagated to that matrix leg       | Secrets are workflow-wide; double-check the env block is at the *step* level, not just one leg |
| Different version numbers on different artifacts                     | `package.json` and `Cargo.toml` versions out of sync                | Bump both in lockstep, e.g. via `bun run release`                                              |
| `tauri-action` skips creating release                                | `tagName` not set, or release already exists with a *different* tag | Use `__VERSION__` placeholder, not a hardcoded value                                           |

---

## See also

- [[tauri-bundling]] — host skill
- [[tauri-bundling-macos-signing]] — secrets and identity strings
- [[tauri-bundling-windows-signing]] — signtool / Azure paths
- [[tauri-bundling-linux-packaging]] — distro deps + signing
- [[tauri-bundling-mobile-stores]] — iOS/Android job shape
- [[tauri-updater-signing-keys]] — `TAURI_SIGNING_PRIVATE_KEY` provisioning
- [[tauri-updater-github-releases]] — manifest hosting on the release `tauri-action` cuts
- `templates/release.yml` — drop-in `.github/workflows/release.yml` with every env-var stub wired

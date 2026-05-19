---
name: tauri-updater
description: Use when adding auto-updates to a Tauri v2 app — generating signing keys, configuring the updater plugin, hosting the update manifest (static JSON or GitHub releases), and wiring the check/download/install flow in JS or Rust. Pairs with [[tauri-bundling]] for OS code signing / notarization (separate from the updater signature).
---

# Tauri v2 Auto-Updater

The updater plugin verifies a **Tauri-specific Ed25519 signature** on every
artifact before installing it. This is mandatory and cannot be disabled — it's
how Tauri proves the bundle came from you and not a tampered mirror.

This is **independent of OS code signing**. macOS still wants notarization,
Windows still wants Authenticode, otherwise the *updated* binary launches with
Gatekeeper / SmartScreen prompts even though Tauri's signature was valid. See
[[tauri-bundling]].

## 1. Generate the signing keypair (once per app, ever)

```sh
bunx tauri signer generate -w ~/.tauri/myapp.key
# also: `npm run tauri signer generate -- -w ...`, `cargo tauri signer ...`
```

Outputs:

- `~/.tauri/myapp.key` — **private key**. Signs releases. NEVER commit it,
  NEVER lose it. Losing it means no existing install can ever receive another
  update from you. Treat it like a code-signing cert: 1Password, GitHub
  Actions secret, hardware token — pick one.
- `~/.tauri/myapp.key.pub` — **public key**. Goes literally inside
  `tauri.conf.json`. The *contents*, not the path.

In CI, expose the private key as two env vars **before** `tauri build` —
`.env` files are NOT read:

```sh
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/myapp.key)"   # or the raw string
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""                   # if you set one
```

## 2. Configure `tauri.conf.json`

```json
{
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6...PASTE PUBLIC KEY CONTENTS...",
      "endpoints": [
        "https://github.com/owner/repo/releases/latest/download/latest.json"
      ]
    }
  }
}
```

`endpoints` is tried in order until one returns 200. URLs may contain:

| placeholder           | example value                        |
| --------------------- | ------------------------------------ |
| `{{target}}`          | `darwin`, `linux`, `windows`         |
| `{{arch}}`            | `x86_64`, `aarch64`, `i686`, `armv7` |
| `{{current_version}}` | the running app's version            |

So a dynamic server can do `https://updates.myapp.com/{{target}}/{{arch}}/{{current_version}}`
and respond with either `200` + JSON (see §4) or `204` for "you're up to date".

The plugin also moved **out of core in v2** — install both halves:

```sh
cargo add tauri-plugin-updater --target 'cfg(any(target_os = "macos", windows, target_os = "linux"))'
bun add @tauri-apps/plugin-updater @tauri-apps/plugin-process
```

And register in `src-tauri/src/lib.rs`:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      #[cfg(desktop)]
      app.handle().plugin(tauri_plugin_updater::Builder::new().build());
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
```

## 3. Capability permission

In v2 nothing is allowed by default. Add to your window's capability file:

```json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": ["updater:default", "process:default"]
}
```

`process:default` covers `relaunch()`. See `templates/capabilities-updater.json`.

## 4. The static JSON manifest

The shape the JS/Rust client expects when the endpoint is a flat file
(GitHub release asset, S3 object, CDN URL):

```json
{
  "version": "1.4.2",
  "notes": "Bug fixes and performance improvements",
  "pub_date": "2026-05-18T15:00:00Z",
  "platforms": {
    "darwin-aarch64":  { "signature": "...", "url": "https://.../MyApp.app.tar.gz" },
    "darwin-x86_64":   { "signature": "...", "url": "https://.../MyApp.app.tar.gz" },
    "linux-x86_64":    { "signature": "...", "url": "https://.../MyApp.AppImage" },
    "windows-x86_64":  { "signature": "...", "url": "https://.../MyApp-setup.exe" }
  }
}
```

Required: `version`, plus `url` + `signature` for the platform the client asks
about. Optional: `notes`, `pub_date`. Platform keys are `OS-ARCH`.

`signature` is the **contents** of the `.sig` file that `tauri build` emits
next to each updater artifact (when `createUpdaterArtifacts: true`). You can
also sign manually:

```sh
bunx tauri signer sign -k ~/.tauri/myapp.key path/to/MyApp.app.tar.gz
```

See `templates/latest.json`.

## 5. GitHub Releases as the endpoint

The conventional layout — zero infra:

1. CI builds on macOS / Linux / Windows runners with the private key in env.
2. Each runner uploads its bundle + `.sig` to the release.
3. A final job assembles `latest.json` by reading the `.sig` files and
   uploads it as another asset.
4. `endpoints` points at
   `https://github.com/owner/repo/releases/latest/download/latest.json` —
   GitHub permanently redirects `/latest/download/<name>` to whatever the
   newest release tagged it as.

`tauri-action` (the official GitHub Action) does all of this for you and
emits `latest.json` automatically — recommended unless you have a reason to
hand-roll it.

## 6. Checking from JavaScript

```ts
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

const update = await check();
if (update) {
  await update.downloadAndInstall((event) => {
    // event.event: 'Started' | 'Progress' | 'Finished'
  });
  await relaunch();
}
```

`check()` returns `null` (or `undefined` in older builds — guard with `if (update)`)
when nothing newer is available. `check()` also accepts `{ proxy, timeout, headers, target }`
for private/staging endpoints. Full progress + error handling in
`templates/update-check.ts`.

On Windows the installer **exits the running app** mid-install — surface a
"restart to update" UI before calling `downloadAndInstall` so the user isn't
surprised. On macOS/Linux the relaunch after `relaunch()` is in-process.

## 7. Checking from Rust

```rust
use tauri_plugin_updater::UpdaterExt;

async fn update(app: tauri::AppHandle) -> tauri_plugin_updater::Result<()> {
  if let Some(update) = app.updater()?.check().await? {
    let mut downloaded = 0;
    update
      .download_and_install(
        |chunk, total| { downloaded += chunk; println!("{downloaded}/{total:?}"); },
        || println!("download finished"),
      )
      .await?;
    app.restart();
  }
  Ok(())
}
```

Use the Rust path when you want to check at startup before any window is
shown, or when you want runtime control over endpoints / pubkey / target via
`app.updater_builder()` (e.g. opt-in beta channels, downgrade-allowed
`version_comparator`).

## 8. OS code signing is still your problem

The Tauri signature gets the bytes onto disk verified. It does NOT make
Gatekeeper happy. After your first auto-update on an un-notarized macOS
build, the user gets "MyApp.app is damaged and can't be opened." Same story
with Windows SmartScreen.

Checklist before shipping auto-updates:

- macOS: Developer ID Application cert + `notarytool` notarization + staple.
- Windows: Authenticode-signed `.exe`/`.msi` (EV cert avoids SmartScreen
  reputation cold-start).
- Linux: nothing extra; AppImage works as-is.

All of that is configured in your bundler/CI, not the updater plugin — see
[[tauri-bundling]].

## Common failure modes

- **"signature error"** — `pubkey` in `tauri.conf.json` doesn't match the
  private key that signed the artifact. Re-paste from `~/.tauri/myapp.key.pub`.
- **Manifest never updates** — GitHub's `latest/download/latest.json` redirect
  only follows the GitHub-Release-marked-as-Latest flag. Draft / pre-release
  uploads are invisible to it.
- **`updater` permission missing** — runtime error in the JS console:
  `updater.check not allowed`. Add `updater:default` to the capability file.
- **`createUpdaterArtifacts` off** — `tauri build` produces a `.app` / `.msi`
  but no `.sig` and no `.tar.gz`. Without the updater artifact + sig pair
  there is nothing to host.
- **Private key leaked** — rotate is painful: you must ship one final
  manually-installed release with the new `pubkey`, since existing installs
  only trust the old key. Plan accordingly; protect the key.

## Templates

- `templates/latest.json` — example manifest for a 4-platform release.
- `templates/update-check.ts` — full JS flow with progress, errors, restart.
- `templates/capabilities-updater.json` — minimal capability granting
  `updater:default` and `process:default`.

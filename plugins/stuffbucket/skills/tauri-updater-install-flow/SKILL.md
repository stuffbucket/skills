---
name: tauri-updater-install-flow
description: Use when wiring the Tauri v2 updater's check / download / install UX — `import { check } from '@tauri-apps/plugin-updater'`, `update.downloadAndInstall(handler)` with `Started` / `Progress` / `Finished` events, mapping those to a progress bar in the UI, calling `relaunch()` from `@tauri-apps/plugin-process` to restart, implementing skip-this-version with `version_comparator`, deferred install ("download now, install on next launch") by separating `download()` and `install()`, gating mandatory vs optional updates, and the equivalent Rust flow via `app.updater()?.check().await?`. Pairs with [[tauri-updater-signing-keys]] for keys and [[tauri-updater-github-releases]] for the manifest source.
---

# Tauri v2 Updater: Install Flow

The check → download → install handshake is short, but each step has a UI
contract worth getting right: users hate silent restarts, partial downloads,
and updaters that re-prompt every launch. This skill is the user-facing half;
keys and hosting are covered in [[tauri-updater-signing-keys]] and
[[tauri-updater-github-releases]].

## 1. Install the JS plugin

```sh
bun add @tauri-apps/plugin-updater @tauri-apps/plugin-process
```

Permissions in `src-tauri/capabilities/default.json`:

```json
{
  "permissions": [
    "updater:default",
    "process:allow-restart"
  ]
}
```

Without `process:allow-restart`, `relaunch()` no-ops silently (no error in
the UI, just a stuck app post-install — easy to miss in QA).

## 2. The minimum viable check

```ts
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

const update = await check();
if (update) {
  console.log(`Update ${update.version} available`);
  await update.downloadAndInstall();
  await relaunch();
}
```

`check()` returns `Update | null`:

- `null` — manifest says you're current, OR endpoint returned `204`, OR network
  failed across all endpoints. The plugin throws only on signature errors —
  ordinary "no update" is a `null`. Don't gate UI on the absence of a throw.
- `Update` — has `version`, `currentVersion`, `date`, `body` (release notes),
  and the `downloadAndInstall` / `download` / `install` methods.

## 3. Progress UI — the `Started` / `Progress` / `Finished` events

```ts
let downloaded = 0;
let contentLength = 0;

await update.downloadAndInstall((event) => {
  switch (event.event) {
    case "Started":
      contentLength = event.data.contentLength ?? 0;
      progressBar.max = contentLength;
      statusText.textContent = `Downloading ${update.version}…`;
      break;
    case "Progress":
      downloaded += event.data.chunkLength;
      progressBar.value = downloaded;
      statusText.textContent =
        `${formatBytes(downloaded)} / ${formatBytes(contentLength)}`;
      break;
    case "Finished":
      progressBar.value = contentLength;
      statusText.textContent = "Installing…";
      break;
  }
});
```

Important properties:

- `contentLength` is **optional** — some servers (esp. dynamic ones) don't
  send `Content-Length`. Fall back to an indeterminate spinner when it's
  missing rather than dividing by zero.
- Events fire on the JS event loop; throwing inside the handler does **not**
  cancel the download. To cancel, you'd need to abort the whole flow before
  starting — there's no in-flight cancel API today.
- After `Finished` the bundle is **already installed** on the OS. The next step
  is your call: relaunch now (`relaunch()`), or defer.

See `templates/update-ui.ts` for a full reference implementation including
DOM bindings, error states, and "skip this version" wiring.

## 4. Deferred install ("install on next launch")

`downloadAndInstall` is a convenience for `download() → install()`. Split them
when you want to download in the background and apply the update on the next
clean app start — much friendlier than yanking the user out of their work:

```ts
const update = await check();
if (update) {
  // Phase 1: silent background download. Resolves once the bundle is on disk.
  await update.download((event) => updateBackgroundProgress(event));
  // Phase 2: defer. Store a flag and install on next app start.
  localStorage.setItem("pendingUpdate", update.version);
  showBanner(`Update ${update.version} ready — restart to install`);
}
```

On next launch, call `update.install()` (no re-download needed; the bundle is
cached in the app's update dir):

```ts
// At app boot:
const pending = localStorage.getItem("pendingUpdate");
if (pending) {
  const update = await check();
  if (update?.version === pending) {
    await update.install();
    localStorage.removeItem("pendingUpdate");
    await relaunch();
  }
}
```

Caveat: the cached bundle is **per-version**. If a newer release lands while
the user is on the pending one, the install will fail (signature mismatch
against the newer manifest). Re-`check()` and re-download in that case.

## 5. Skip-this-version

The updater itself has no built-in "skip" — implement it in JS:

```ts
const SKIPPED_KEY = "skippedUpdateVersion";

const update = await check();
if (!update) return;

const skipped = localStorage.getItem(SKIPPED_KEY);
if (skipped === update.version) {
  // user previously declined this exact version; stay quiet
  return;
}

const choice = await showUpdateDialog(update); // 'install' | 'later' | 'skip'
if (choice === "skip") {
  localStorage.setItem(SKIPPED_KEY, update.version);
} else if (choice === "install") {
  localStorage.removeItem(SKIPPED_KEY);
  await update.downloadAndInstall();
  await relaunch();
}
```

For Rust-side skip logic with a custom comparator, see §7.

## 6. Mandatory vs optional updates

There's no `mandatory: true` field in the manifest — gate it client-side. Two
patterns:

**Field in `notes` / `body`.** Embed a sentinel:

```ts
const mandatory = update.body.includes("[MANDATORY]");
if (mandatory) {
  // No "skip" button. Disable app UI until install completes.
  await update.downloadAndInstall();
  await relaunch();
}
```

**Minimum-supported-version pin.** Bake the floor into your config or fetch
it from a separate endpoint, and refuse to start the app below it:

```ts
const MIN_VERSION = "1.4.0";
if (semverLt(currentVersion, MIN_VERSION)) {
  await blockingUpdateUI(); // user cannot dismiss
}
```

The latter survives users on bad networks (no `check()` succeeded → app still
refuses to run on an ancient version).

## 7. `version_comparator` (Rust-side custom logic)

When the default semver comparison isn't enough — e.g. you want to treat
`1.4.2-beta` as **newer than** `1.4.2` for users on a beta channel:

```rust
use tauri_plugin_updater::UpdaterExt;

tauri::Builder::default()
    .plugin(
        tauri_plugin_updater::Builder::new()
            .version_comparator(|current, update| {
                // Custom rule: if local has "-beta" suffix, accept any version >= current.
                // Otherwise, fall back to standard semver gt.
                if current.pre.as_str().starts_with("beta") {
                    update.version >= current
                } else {
                    update.version > current
                }
            })
            .build(),
    )
```

`current` and `update` are `semver::Version`. Return `true` to treat the
remote as installable. This is the right hook for staged rollouts, channel
gating, and the rare "downgrade is intentional" case.

## 8. Rust-side install flow

When the update flow lives in Rust (e.g. background-check from a tray menu),
the API mirrors JS — see `templates/update-flow.rs` for the full version:

```rust
use tauri_plugin_updater::UpdaterExt;

async fn check_for_update(app: tauri::AppHandle) -> tauri::Result<()> {
    if let Some(update) = app.updater()?.check().await? {
        let mut downloaded = 0;
        update
            .download_and_install(
                |chunk_length, content_length| {
                    downloaded += chunk_length;
                    println!("downloaded {downloaded} of {content_length:?}");
                },
                || {
                    println!("download finished");
                },
            )
            .await?;
        println!("update installed");
        app.restart();
    }
    Ok(())
}
```

`app.restart()` is the Rust equivalent of `relaunch()` — same end result.

## 9. When to check

Don't `check()` on every launch — it adds a network hop to cold start, and
GitHub will rate-limit. Sensible policies:

| Trigger                             | Notes                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| On launch, debounced to once per 6h | Store `lastCheckAt` in `tauri-plugin-store` or localStorage.                  |
| On a tray menu item                 | "Check for updates…" — manual, always runs.                                   |
| On a long-running interval          | `setInterval(check, 6 * 3600 * 1000)` for apps users leave open for days.     |
| **Never** automatically             | Reserved for apps shipped via stores (App Store / MS Store do it themselves). |

## 10. Common failure modes

| Symptom                                                        | Cause                                                                                                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `check()` resolves null but you know there's a new release     | Manifest `version` not strictly greater than installed, OR endpoint returned 204, OR all endpoints failed. Check devtools network tab. |
| `signature mismatch` thrown during download                    | Manifest signature doesn't match the artifact at `url`. Almost always: artifact was re-uploaded without regenerating signature.        |
| Progress events fire, "Finished" fires, but no install happens | OS code-signing issue (macOS Gatekeeper, Windows SmartScreen) blocked the swap silently. Check Console.app / Event Viewer.             |
| `relaunch()` does nothing                                      | Missing `process:allow-restart` capability.                                                                                            |
| User sees update prompt every launch even after install        | `version` in your manifest equals the **newly installed** version. Bump the manifest, or your "skip" wasn't persisted.                 |

## See also

- [[tauri-updater]] — parent.
- [[tauri-updater-signing-keys]] — keys consumed by the verifier this flow uses.
- [[tauri-updater-github-releases]] — where the manifest at `endpoints` lives.
- [[tauri-events-channels-streaming]] — for streaming download progress to a
  separate progress window via `Channel<T>`.

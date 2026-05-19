---
name: tauri-updater-github-releases
description: Use when hosting Tauri v2 update artifacts and the `latest.json` manifest on GitHub Releases — wiring `tauri-apps/tauri-action` to build + sign + upload a multi-OS matrix (darwin-aarch64, darwin-x86_64, linux-x86_64, windows-x86_64), using the `latest/download/latest.json` redirect so installed apps always hit the current release, expanding the `{{target}}` / `{{arch}}` / `{{current_version}}` placeholders in `plugins.updater.endpoints`, providing fallback hosts via the endpoints array, and manually uploading + crafting `latest.json` if you're not using tauri-action. Pairs with [[tauri-updater-signing-keys]] for key wiring and [[tauri-updater-install-flow]] for the client-side check/download UX.
---

# Tauri v2 Updater: GitHub Releases as Update Server

GitHub Releases is the cheapest, most reliable host for Tauri update
artifacts — `tauri-action` automates the whole thing (build matrix, sign,
upload, generate `latest.json`). Use it unless you already have a CDN you
prefer.

The trick that makes it work: GitHub serves
`https://github.com/<owner>/<repo>/releases/latest/download/<file>` as a
**302 redirect to the file in whichever release is marked Latest**. Embed
that URL in the updater's `endpoints` array and you never have to touch the
manifest URL again — promote a new release to Latest, and every installed
client picks it up on next check.

## 1. The `endpoints` configuration

`tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "pubkey": "...",
      "endpoints": [
        "https://github.com/my-org/my-app/releases/latest/download/latest.json",
        "https://releases.myapp.com/latest.json"
      ]
    }
  }
}
```

The plugin tries endpoints **in order** and uses the first that returns a
valid 200. A second URL (your own host, a backup CDN, an S3 bucket) is
prudent — GitHub does go down. Endpoints support template variables that the
plugin substitutes at check time:

| Placeholder           | Example expansion                    |
| --------------------- | ------------------------------------ |
| `{{current_version}}` | `1.4.2` (version installed locally)  |
| `{{target}}`          | `darwin`, `linux`, `windows`         |
| `{{arch}}`            | `aarch64`, `x86_64`, `i686`, `armv7` |

For the `latest.json` pattern above, you don't need placeholders — the manifest
itself enumerates every target. Use placeholders when your server is
**dynamic**, e.g. `/check?version={{current_version}}&target={{target}}`.

## 2. The `latest.json` manifest

`tauri-action` generates this for you. The format:

```json
{
  "version": "1.4.2",
  "notes": "See https://github.com/my-org/my-app/releases/tag/v1.4.2",
  "pub_date": "2025-12-01T10:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVRVDR5N...",
      "url": "https://github.com/my-org/my-app/releases/download/v1.4.2/myapp_1.4.2_aarch64.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "...",
      "url": "https://github.com/my-org/my-app/releases/download/v1.4.2/myapp_1.4.2_x64.app.tar.gz"
    },
    "linux-x86_64": {
      "signature": "...",
      "url": "https://github.com/my-org/my-app/releases/download/v1.4.2/myapp_1.4.2_amd64.AppImage"
    },
    "windows-x86_64": {
      "signature": "...",
      "url": "https://github.com/my-org/my-app/releases/download/v1.4.2/myapp_1.4.2_x64-setup.nsis.zip"
    }
  }
}
```

Hard rules:

- `version` must be **semver** and **higher than the installed version**, or
  `check()` returns null and nothing happens. The plugin compares with
  `semver::Version` semantics — `1.4.2` > `1.4.2-beta.1`, watch out.
- Platform keys are **exactly** `<os>-<arch>` from the table above. Typos
  silently make that platform skip updates.
- `signature` is the **contents of the `.sig` file** (base64 blob), not a URL.
- `url` must be a direct download. GitHub release asset URLs are fine; pages
  that 302 to a download are also fine.
- `pub_date` is optional but recommended — used by the JS API to show "released
  3 days ago" UI. Format is RFC 3339 / ISO 8601 with a `Z` suffix.

## 3. Dynamic-server response (alternative to static `latest.json`)

If you run a backend, return one of:

- **`204 No Content`** — no update available. The plugin treats this as
  "you're current" without raising an error.
- **`200 OK`** with the same JSON shape as one **platform entry**, top-level:

  ```json
  {
    "version": "1.4.2",
    "url": "https://...",
    "signature": "...",
    "notes": "...",
    "pub_date": "2025-12-01T10:00:00Z"
  }
  ```

  Use this when you want server-side targeting (gradual rollouts, kill
  switches, A/B). The server reads `{{target}}` / `{{arch}}` /
  `{{current_version}}` from the URL and picks the right artifact.

## 4. `tauri-action` workflow

The official action handles the entire matrix — see
`templates/github-actions-updater.yml` for the full file. The shape:

```yaml
strategy:
  matrix:
    include:
      - platform: macos-latest
        args: --target aarch64-apple-darwin
      - platform: macos-latest
        args: --target x86_64-apple-darwin
      - platform: ubuntu-22.04
        args: ""
      - platform: windows-latest
        args: ""
```

Each leg runs `tauri-action`, which:

1. Runs `tauri build` with the matrix `args`.
2. Reads the Tauri-signed `.sig` files.
3. Creates (or appends to) the GitHub Release named `App v__VERSION__`.
4. Uploads bundle + `.sig`.
5. After all legs finish, generates and uploads `latest.json` summarizing
   every platform.

You **must** set `updaterJsonPreferNsis: true` (Windows) for Tauri 2 NSIS
installers — the older MSI updater is deprecated.

## 5. Manual upload (without `tauri-action`)

If you build locally / on self-hosted runners:

```sh
# 1. Build each target (run on the appropriate OS or via cross).
bunx tauri build --target aarch64-apple-darwin
bunx tauri build --target x86_64-apple-darwin
# ...

# 2. Collect outputs. The Tauri-signed bundle pairs are next to the unsigned ones:
#   src-tauri/target/<triple>/release/bundle/<format>/MyApp_<ver>_<arch>.<ext>
#   src-tauri/target/<triple>/release/bundle/<format>/MyApp_<ver>_<arch>.<ext>.sig

# 3. Create the release and upload artifacts.
gh release create v1.4.2 \
  --title "v1.4.2" \
  --notes-file CHANGELOG.md \
  src-tauri/target/aarch64-apple-darwin/release/bundle/macos/MyApp_1.4.2_aarch64.app.tar.gz \
  src-tauri/target/aarch64-apple-darwin/release/bundle/macos/MyApp_1.4.2_aarch64.app.tar.gz.sig \
  # ...repeat for every platform...

# 4. Build latest.json (templates/latest.json is a starting point) and upload it.
gh release upload v1.4.2 latest.json
```

`gh release create` flips the new release to Latest automatically, which is
exactly what the `releases/latest/download/...` redirect needs.

## 6. Bundle formats the updater accepts

| OS      | Format                                      | Notes                                                                                    |
| ------- | ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| macOS   | `.app.tar.gz`                               | The updater unpacks and swaps the bundle. NOT `.dmg`.                                    |
| Linux   | `.AppImage` (preferred), `.AppImage.tar.gz` | Self-update only works for AppImage — `.deb`/`.rpm` updates require the package manager. |
| Windows | `.nsis.zip`                                 | NSIS installer in a ZIP. Set `updaterJsonPreferNsis: true`. Legacy MSI is deprecated.    |

The build produces these alongside the user-facing `.dmg` / `.msi` — same
`tauri build`, different files. The `.sig` companion file is what tauri-action
hashes into `latest.json`.

## 7. Endpoints array fallback strategy

```json
"endpoints": [
  "https://github.com/my-org/my-app/releases/latest/download/latest.json",
  "https://updater-fallback.myapp.com/latest.json",
  "https://s3.amazonaws.com/myapp-updates/latest.json"
]
```

Behavior:

- The plugin requests endpoint 1. If it returns 200 + valid JSON + valid
  signature on the referenced artifact, that wins.
- Network failure, 4xx, 5xx, malformed JSON → fall through to endpoint 2,
  then 3.
- **Signature verification failure does NOT fall through** — that's an attack
  signal, not a transport failure. Aborts immediately.

Keep fallbacks **byte-identical** to the primary. Diverging manifests across
endpoints means the client sees different versions on retry — confusing for
users, hostile to your bug reports.

## 8. Common failure modes

| Symptom                                     | Cause                                                                                                       |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `check()` always returns null               | Manifest `version` <= installed version. Bump the tag and rebuild.                                          |
| Specific OS never sees updates              | Platform key typo in `latest.json` (`darwin-x64` instead of `darwin-x86_64`).                               |
| `signature mismatch`                        | `.sig` was regenerated after upload, or the manifest references a stale signature. Re-upload both together. |
| `404 latest.json`                           | Release is in **Draft** status — the `latest` redirect skips drafts. Publish it.                            |
| Updates work in dev but not in packaged app | `createUpdaterArtifacts: false` in conf — packaged build never produced the `.sig` files.                   |

## See also

- [[tauri-updater]] — parent skill.
- [[tauri-updater-signing-keys]] — generating the keys this workflow uses.
- [[tauri-updater-install-flow]] — wiring the client UI to consume this manifest.
- [[tauri-bundling]] — OS-level signing (Apple notarization, Authenticode) that
  must happen **alongside** the Tauri signature.

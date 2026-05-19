---
name: tauri-bundling
description: Use when packaging a Tauri v2 app for release — building per-OS installers (dmg, msi, nsis, appimage, deb, rpm), code signing (macOS notarization + Apple Developer ID, Windows Authenticode, Linux AppImage signing), store submission (App Store, MS Store, Google Play), or wiring a GitHub Actions release pipeline.
---

# Tauri v2 Bundling & Distribution

A hub skill for shipping a Tauri v2 app to real users. Covers the build pipeline, every supported
per-OS installer format, the code-signing requirements that gate "no scary warnings on first
launch," store submission paths, and a working CI workflow. For mobile (iOS / Android) only the
high-level submission path is here — driver-level mobile setup belongs in a separate skill.

Two templates ship with this skill:

- `templates/github-actions-release.yml` — multi-OS matrix using `tauri-apps/tauri-action`.
- `templates/tauri.conf.bundle.json` — production bundle config with identifier, publisher, and
  signing toggles per OS.

---

## 1. Build basics

The single entry point is `tauri build`. Defaults to *every* configured bundle on the host OS.

```sh
# Build everything configured for the host OS
bun run tauri build         # or npm / pnpm / yarn / cargo tauri build

# Build only specific formats
bun run tauri build --bundles dmg,app          # macOS, no Universal target
bun run tauri build --bundles msi,nsis         # Windows
bun run tauri build --bundles appimage,deb,rpm # Linux

# Build the binary only — skip bundling. Lets you wrap your own installer.
bun run tauri build --no-bundle
```

Output artifacts land in `src-tauri/target/release/bundle/<format>/`. Each bundle subdir holds the
final installer file plus, for code-signed formats, the signature sidecar.

**Versioning.** Pulled from `tauri.conf.json > version`. If absent, falls back to `Cargo.toml >
package.version`. Mobile platforms compute an integer version code from semver — see Mobile section.

**Bundle identifier.** `tauri.conf.json > identifier` (e.g. `com.acme.maximal`) must:

- Be globally unique reverse-DNS
- Match the App Store / Play Store / Microsoft Store record exactly
- Not change after first release — auto-update and signing both key off it

---

## 2. macOS — `.app`, `.dmg`, App Store

### `.app` bundle

Layout produced by `tauri build --bundles app`:

```text
<productName>.app/Contents/
├── Info.plist
├── MacOS/<app-name>          # the actual executable
├── Resources/                # icon.icns + bundled assets
├── _CodeSignature/
├── Frameworks/
├── PlugIns/
└── SharedSupport/
```

Relevant `tauri.conf.json > bundle.macOS` keys:

- `minimumSystemVersion` — default `10.13`. Bump cautiously; users on older macOS will silently fail
  to launch.
- `frameworks` — system or vendored frameworks to embed.
- `files` — arbitrary file map into the bundle.
- `entitlements` — path to your `Entitlements.plist`.

To extend `Info.plist`, drop a custom `Info.plist` next to `tauri.conf.json` in `src-tauri/`. Tauri
merges your keys over its generated ones.

> **`$PATH` gotcha.** GUI macOS apps do not inherit a login-shell `$PATH`. If you shell out (e.g. to `git`, `bun`, `node`), use the `fix-path-env` crate or hardcode absolute paths.

### `.dmg` installer

`tauri build --bundles dmg` wraps the `.app` in the standard drag-to-Applications window. Configure
under `bundle.macOS.dmg`:

```json
"dmg": {
  "background": "./assets/dmg-background.png",
  "windowSize":   { "width": 660, "height": 400 },
  "windowPosition": { "x": 200, "y": 120 },
  "appPosition":              { "x": 180, "y": 170 },
  "applicationFolderPosition":{ "x": 480, "y": 170 }
}
```

> CI gotcha: DMG icon positioning is flaky on headless runners (no WindowServer). See tauri#1731. If positions look wrong only on CI, build the DMG locally or skip the visual tweaks.

### App Store (`.pkg`)

Hard requirements:

1. **Apple Developer Program** ($99/yr) — free tier cannot notarize.
2. **App Sandbox capability** — required by App Review. Put in your `Entitlements.plist`.
3. **Bundle ID matches App Store Connect record exactly.**
4. **Universal binary.** Build with `tauri build --bundles app --target universal-apple-darwin`.
5. **Mac App Store Provisioning Profile** referenced in config.
6. **Encryption compliance** key in `Info.plist` (`ITSAppUsesNonExemptEncryption`).

Workflow:

```sh
tauri build --bundles app --target universal-apple-darwin    # universal .app
xcrun productbuild --component MyApp.app /Applications \
  --sign "3rd Party Mac Developer Installer: ACME (TEAMID)" \
  MyApp.pkg                                                  # signed .pkg
xcrun altool --upload-app -f MyApp.pkg \
  --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"        # upload
```

App Store Connect API keys live as `AuthKey_<KEY_ID>.p8` in `~/.appstoreconnect/private_keys/` or
`./private_keys/`.

### Code signing (macOS)

Two cert flavors:

- **Developer ID Application** — direct distribution (DMG, zip). Requires notarization.
- **Apple Distribution** — App Store only.

Find your installed identity:

```sh
security find-identity -v -p codesigning
```

**Local signing** — set in `tauri.conf.json`:

```json
"macOS": { "signingIdentity": "Developer ID Application: ACME (TEAMID)" }
```

…or via env: `APPLE_SIGNING_IDENTITY="Developer ID Application: ACME (TEAMID)"`.

**CI signing** — export a `.p12` and base64 it:

```sh
base64 -i Certificates.p12 | pbcopy
```

Then in CI secrets:

- `APPLE_CERTIFICATE` — base64 of the `.p12`
- `APPLE_CERTIFICATE_PASSWORD` — `.p12` password
- `APPLE_SIGNING_IDENTITY` — the human-readable cert name

`tauri-action` imports the cert into a temporary keychain automatically when these are present.

**Notarization** (required for Developer ID Application). Pick one auth method:

API key (preferred for CI):

- `APPLE_API_ISSUER` — issuer UUID
- `APPLE_API_KEY` — key ID
- `APPLE_API_KEY_PATH` — path to the `.p8` file (or `APPLE_API_KEY_BASE64`)

Or Apple ID:

- `APPLE_ID` — email
- `APPLE_PASSWORD` — app-specific password (not your iCloud password)
- `APPLE_TEAM_ID` — 10-char team ID

Tauri auto-runs `xcrun notarytool submit --wait` then `xcrun stapler staple` when these are set.
Manual equivalent:

```sh
xcrun notarytool submit MyApp.dmg --apple-id … --password … --team-id … --wait
xcrun stapler staple MyApp.dmg
```

**Hardened runtime** is on by default for Developer ID signing. Add entitlements you actually use —
`com.apple.security.cs.allow-jit`, `com.apple.security.cs.disable-library-validation` etc. —
sparingly.

**Ad-hoc signing** (no Apple account, dev only on Apple Silicon): set `signingIdentity: "-"`. Users
will still see the Gatekeeper warning.

---

## 3. Windows — MSI, NSIS, Microsoft Store

### Two installer formats

| Format   | Backend        | Pros                                                      | Cons                                                        |
| -------- | -------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| **MSI**  | WiX Toolset v3 | Group Policy / enterprise deploy, native MSI tooling      | Windows-only build host, requires VBSCRIPT optional feature |
| **NSIS** | NSIS           | Cross-compile from Linux/macOS, scriptable hooks, smaller | Less enterprise-friendly                                    |

Default with `tauri build` on Windows is MSI + NSIS. Pick one with `--bundles msi` or `--bundles
nsis`. Most projects ship NSIS for direct downloads and MSI only if they need Active Directory
deployment.

### Cross-compile from non-Windows (NSIS only)

```sh
# Linux: apt install nsis llvm lld
# macOS: brew install nsis llvm
rustup target add x86_64-pc-windows-msvc
cargo install cargo-xwin
tauri build --bundles nsis --target x86_64-pc-windows-msvc --runner cargo-xwin
```

### WebView2 distribution

WebView2 is required at runtime. Pick a strategy under `bundle.windows.webviewInstallMode`:

| Mode                   | Net required     | Installer size delta | When                                                   |
| ---------------------- | ---------------- | -------------------- | ------------------------------------------------------ |
| `downloadBootstrapper` | Yes (on install) | 0 MB                 | Default. Skip for Win7 MSIs.                           |
| `embedBootstrapper`    | Yes (on install) | +1.8 MB              | Better Win7 support.                                   |
| `offlineInstaller`     | No               | +127 MB              | Offline / air-gapped customers. Required for MS Store. |
| `fixedVersion`         | No               | +180 MB              | Pin a specific WebView2 build (regulated envs).        |

### Customization

- **WiX (MSI):** custom XML fragments via `bundle.windows.wix.fragmentPaths`, custom templates via
  `wix.template`, localization via `wix.language`.
- **NSIS:** lifecycle hooks (`preinstall`, `postinstall`, `preuninstall`, `postuninstall`) via
  `bundle.windows.nsis.installerHooks`. Far cleaner than full template replacement for dropping in
  dependencies or registry keys.

### Code signing (Windows / Authenticode)

Signed installers avoid SmartScreen warnings — but reputation accrues per cert:

- **EV cert** — instant SmartScreen reputation, hardware token required.
- **OV cert** — cheaper, but SmartScreen warns until enough installs accumulate.

Three signing backends, in increasing order of CI-friendliness:

**1. Local `.pfx` with signtool** (OV legacy path). Import the `.pfx` into the Windows keystore,
then in `tauri.conf.json`:

```json
"windows": {
  "certificateThumbprint": "AABBCC…",
  "digestAlgorithm": "sha256",
  "timestampUrl": "http://timestamp.digicert.com"
}
```

**2. Azure Key Vault** via the `relic` tool. Vault-stored cert, secret-based auth
(`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET`). Configure a custom sign command under
`bundle.windows.signCommand`.

**3. Azure Trusted Signing** (recommended for new projects) via `trusted-signing-cli`.
Microsoft-managed cert, per-signature billing, no hardware token. Requires .NET 6+ and `signtool` on
the runner.

For cross-platform CI, `osslsigncode` can sign Windows installers from Linux/macOS — useful when
matrix runners are Ubuntu.

### Microsoft Store

Tauri *does not* produce MSIX directly. The Store accepts EXE/MSI via "EXE or MSI app" registration,
but:

- Installer must be **offline** — set `webviewInstallMode` to `offlineInstaller`.
- Installer must be **code-signed**.
- Installer must **handle its own auto-updates**.
- **Publisher name ≠ product name** — set `bundle.publisher` explicitly if your `productName` and
  identifier share a token.

Use a separate `tauri.microsoftstore.conf.json` overlay to keep the Store-specific WebView2 setting
out of your normal release build:

```sh
tauri build --config tauri.microsoftstore.conf.json --bundles msi
```

---

## 4. Linux — AppImage, deb, rpm, Flatpak, Snap, AUR

### Pick a format

| Format       | Use when                                                          | Avoid when                                                                |
| ------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **AppImage** | You want one portable file, no install step, broad distro support | You care about installer size (70+ MB vs 2–6 MB) or need PATH integration |
| **deb**      | Ubuntu/Debian/Mint users via `apt`                                | You need to target Fedora/RHEL                                            |
| **rpm**      | Fedora/RHEL/openSUSE users via `dnf`                              | Debian-family users                                                       |
| **Flatpak**  | Universal sandboxed install via Flathub                           | You need raw filesystem access                                            |
| **Snap**     | Ubuntu first-party store presence                                 | Users dislike snapd overhead                                              |
| **AUR**      | Arch users — community-maintained                                 | Anyone but Arch                                                           |

### The glibc baseline problem (read this first)

> "You must build your Tauri application using the oldest base system you intend to support that also provides Tauri v2's required WebKitGTK 4.1 packages."

Build on Ubuntu 22.04 / Debian 12 (or older with backports). Building on Ubuntu 24.04 will silently
raise your minimum glibc and break 22.04 users at runtime. In CI: use a container or pin
`ubuntu-22.04` runners. Never `ubuntu-latest` for shipping Linux builds.

System deps for the runner:

```sh
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

### AppImage

```sh
tauri build --bundles appimage
```

Configure under `bundle.linux.appimage`:

- `bundleMediaFramework: true` — pulls GStreamer for `<audio>`/`<video>` (large size hit).
- `files` — extra files, paths must start with `/usr/`.

**ARM AppImages cannot cross-compile.** Build on ARM hardware or ARM GitHub runner
(`ubuntu-22.04-arm`).

**GPG signing:**

```sh
gpg2 --full-gen-key                     # one-time
export SIGN=1
export SIGN_KEY=<KEY_ID>                # optional, else default key
export APPIMAGETOOL_SIGN_PASSPHRASE=<…>
export APPIMAGETOOL_FORCE_SIGN=1        # fail the build if signing fails
tauri build --bundles appimage
```

> AppImage itself does not validate signatures at launch. Users must run the `validate` tool from
> AppImageUpdate releases, and you must publish the key fingerprint somewhere over TLS. Treat
> AppImage signing as integrity attestation, not active enforcement.

### Debian (`.deb`)

```sh
tauri build --bundles deb
```

Auto-generated control fields list dependencies `libwebkit2gtk-4.1-0`, `libgtk-3-0`, and (when tray
enabled) `libappindicator3-1`. Add extra `Depends:` via `bundle.linux.deb.depends`. Map extra files
via `bundle.linux.deb.files`. Same glibc warning applies — build on the oldest target.

ARM cross-compile is supported (the docs detail ARMv7 and ARM64 targets, linker overrides, sysroot
setup).

### RPM (`.rpm`)

```sh
tauri build --bundles rpm
```

Configure under `bundle.linux.rpm`:

- `depends`, `conflicts`, `provides`, `obsoletes` — standard RPM relations.
- `preInstallScript`, `postInstallScript`, `preRemoveScript`, `postRemoveScript` — shell scripts
  placed in `src-tauri/scripts/`.
- `epoch`, `release` — version metadata.

**RPM signing** uses GPG. Export your public key, import into the RPM DB, configure `~/.rpmmacros`:

```text
%_signature gpg
%_gpg_name  YOUR_KEY_ID
```

Then build — rpmbuild signs automatically. Verify with `rpm -K MyApp.rpm`.

Inspect a built RPM: `rpm -qip` (header), `rpm -qp --scripts` (lifecycle scripts), `rpm -ivh -vv`
(verbose install).

### Flatpak

Build a `.deb` first, then wrap it with `flatpak-builder` using a manifest that:

- Targets GNOME runtime/SDK **46** (covers Tauri's deps).
- Declares permissions (`--socket=wayland`, `--socket=x11`, `--device=dri`).
- Extracts the `.deb`, copies binary + resources to `/app`, registers desktop file + icons +
  AppStream MetaInfo.

Submitting to Flathub: fork `flathub/flathub`, branch off, add your manifest, PR against the
`new-pr` branch. After acceptance you get a per-app repo for ongoing updates.

### Snapcraft

Author a `snapcraft.yaml` with:

- `base: core22`, `confinement: strict`, `grade: stable`
- `extensions: [gnome]` — pulls desktop/wayland/x11 plugs in one line
- `build-packages` for Rust + webkit2gtk-dev
- `stage-packages` for runtime libs
- `apps.<name>.command` pointing at the installed binary

Publish:

```sh
snapcraft login
snapcraft pack
snapcraft upload --release=stable myapp_1.0.0_amd64.snap
```

Register the snap name at snapcraft.io first.

### AUR

For Arch, write a `PKGBUILD`. Two flavors:

- **`-bin`** — repackages your `.deb` release artifact. Faster for users, less maintenance.
- **From source** — pulls a git tag and runs `cargo tauri build`. Standard for community AUR.

Required fields: `pkgname`, `pkgver`, `pkgrel`, `pkgdesc`, `arch`, `url`, `license`, `depends`,
`source`, `sha256sums`. Generate `.SRCINFO` with `makepkg --printsrcinfo > .SRCINFO`, test with
`makepkg`, push to `ssh://aur@aur.archlinux.org/<pkgname>.git`.

---

## 5. Mobile — high level only

### iOS / App Store

```sh
bun run tauri ios build --export-method app-store-connect
```

Required:

- Apple Developer enrollment + Mac for signing.
- Bundle ID registered in App Store Connect, matching `identifier`.
- **Automatic signing** (recommended) — set `APPLE_API_ISSUER`, `APPLE_API_KEY`,
  `APPLE_API_KEY_PATH`. Xcode handles certs + provisioning.
- **Manual signing** — base64 your `.p12` and `.mobileprovision`, set `IOS_CERTIFICATE`,
  `IOS_CERTIFICATE_PASSWORD`, `IOS_MOBILE_PROVISION`.

The generated `.ipa` uploads via `xcrun altool` to App Store Connect. TestFlight pickup is automatic
after processing.

### Android / Google Play

```sh
bun run tauri android build -- --aab
```

Pre-step: create an upload keystore.

```sh
keytool -genkey -v -keystore ~/upload-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Then `src-tauri/gen/android/keystore.properties` (do **not** check in):

```text
password=…
keyAlias=upload
storeFile=/abs/path/to/upload-keystore.jks
```

Wire it into `src-tauri/gen/android/app/build.gradle.kts` with the `signingConfigs { release { … }
}` block reading the properties file, then `signingConfig = signingConfigs.getByName("release")` on
the release build type.

Output: `gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`. Version
code is auto-computed as `major*1_000_000 + minor*1_000 + patch`.

First Play Console upload must be manual — Google verifies your signing cert + bundle ID. Subsequent
uploads can be automated via the Play Developer API (no built-in Tauri integration yet).

---

## 6. GitHub Actions release pipeline

See `templates/github-actions-release.yml` for a complete file. The shape:

- Triggers on push to `release` (or a tag).
- Matrix over `macos-latest` (aarch64 + x86_64), `ubuntu-22.04` (x64), `ubuntu-22.04-arm`,
  `windows-latest`.
- Per-OS steps: install system deps (Linux), set up Node + Rust + Rust cache, install frontend deps.
- One `tauri-apps/tauri-action@v0` step does build + bundle + GitHub Release upload.
- Secrets passed via `env:` — signing certs, notarization creds, Tauri updater signing key.

Minimum required secrets:

- macOS: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, plus either
  (`APPLE_API_ISSUER` + `APPLE_API_KEY_ID` + `APPLE_API_KEY`) or (`APPLE_ID` + `APPLE_PASSWORD` +
  `APPLE_TEAM_ID`) for notarization.
- Windows: depends on signing backend — `WINDOWS_CERTIFICATE` + `WINDOWS_CERTIFICATE_PASSWORD`
  (PFX), or Azure creds for Trusted Signing.
- Tauri updater (if used): `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

The `GITHUB_TOKEN` is auto-issued, but the workflow needs `permissions: contents: write` to publish
a Release. If you previously locked workflow permissions to read-only repo-wide, override per-job.

> ARM Linux on GitHub: `ubuntu-22.04-arm` runners are now GA for public repos. Private repos may still need self-hosted ARM runners — emulated builds take ~1h and routinely flake.

---

## 7. Common gotchas

- **Universal vs single-arch macOS.** A non-universal `.app` runs on either Intel or Apple Silicon,
  not both. App Store rejects single-arch unless your `LSMinimumSystemVersion` predates Apple
  Silicon (it doesn't).
- **`codesign --deep` is deprecated.** Tauri signs nested binaries top-down in the right order. If
  you patch-sign manually post-bundle, use `--options runtime` and sign innermost-first.
- **Notarization staple step is separate.** Submission succeeds but the ticket isn't embedded until
  you `stapler staple`. Without it, offline users see "Apple could not verify…" until they connect.
- **MSI vs NSIS — when in doubt, ship NSIS.** Smaller, scriptable, cross-compilable, no VBSCRIPT
  requirement. Only ship MSI when an actual customer has asked for it.
- **AppImage glibc baseline.** Build on the oldest WebKitGTK-4.1-capable distro you support. There
  is no way to "lower" glibc after the fact short of rebuilding.
- **`tauri build` ≠ `cargo build --release`.** Bundle steps run *after* compile. A green `cargo
  build` does not mean your installer will build — bundler errors surface late.
- **Identifier collisions.** Changing `identifier` between releases breaks auto-update and macOS
  keychain access. Pick once, keep forever.
- **Publisher name = product name.** Microsoft Store rejects this. Always set `bundle.publisher`
  explicitly.
- **DMG icon positions on CI.** No WindowServer means `osascript` window tweaks silently fail. Build
  the prettified DMG locally if visual layout matters; ship a plain one from CI otherwise.
- **`tauri ios build` on Linux/Windows.** Not supported. macOS host only. Run mobile builds on a
  separate matrix job pinned to `macos-latest`.

---

## Templates

- **`templates/github-actions-release.yml`** — drop into `.github/workflows/release.yml`. Fill in
  secrets, swap `bun` for your package manager if needed.
- **`templates/tauri.conf.bundle.json`** — merge under your `tauri.conf.json > bundle` key. Has
  placeholder identifier, publisher, per-OS signing toggles, and WebView2 + DMG defaults that match
  what this skill recommends.

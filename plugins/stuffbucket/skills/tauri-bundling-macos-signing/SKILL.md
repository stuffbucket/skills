---
name: tauri-bundling-macos-signing
description: Use when signing and notarizing a Tauri v2 macOS build for distribution outside the Mac App Store — provisioning a Developer ID Application cert, wiring `APPLE_SIGNING_IDENTITY` (or base64 `APPLE_CERTIFICATE` for CI), authoring hardened-runtime entitlements, choosing notarytool API-key vs Apple-ID auth, stapling the ticket, producing a universal-binary `.app`, and the parallel App Store Connect path (Apple Distribution cert + `.pkg` via `productbuild`).
---

# Tauri v2 — macOS signing & notarization

Pairs with [[tauri-bundling]] (host skill) and [[tauri-updater-signing-keys]] (updater key is a
*separate* signature from this OS signature).

The end-state you're driving toward: on a fresh Mac, double-clicking your `.dmg`, dragging the
`.app` to `/Applications`, and launching it produces **zero** Gatekeeper dialogs. That requires
three things in series — codesign with a Developer ID Application cert, notarize with Apple, staple
the ticket onto the bundle. Tauri does the codesign automatically when `APPLE_SIGNING_IDENTITY` is
set; the notarize step needs the right env-var combo; stapling is automatic unless you pass
`--skip-stapling`.

---

## 1. One-time setup: Developer ID Application cert

You need an Apple Developer account ($99/yr). In *Certificates, Identifiers & Profiles*, create a
**Developer ID Application** certificate (for distribution outside the Store) — *not* "Mac
Development". Download the `.cer`, double-click to import into Login keychain, then export the
private key + cert as a `.p12`.

Verify locally:

```sh
security find-identity -v -p codesigning
# Expect a line like:
#   1) ABCDEF1234... "Developer ID Application: Your Name (TEAMID)"
```

The full string after the hash — `Developer ID Application: Your Name (TEAMID)` — is what goes into
`APPLE_SIGNING_IDENTITY`. Tauri matches loosely (substring is fine), but include the team ID parens
to disambiguate when you have multiple certs.

---

## 2. Local signing

```sh
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
bun run tauri build --bundles app,dmg
```

That's it for the codesign step. Tauri invokes `codesign` with hardened-runtime + timestamp flags on
every Mach-O inside the `.app`, then on the bundle itself. Verify:

```sh
codesign --verify --deep --strict --verbose=2 \
  "src-tauri/target/release/bundle/macos/YourApp.app"
spctl --assess --type execute --verbose \
  "src-tauri/target/release/bundle/macos/YourApp.app"
```

`spctl` will say *"rejected: source=Unnotarized Developer ID"* until you notarize — that's expected
and not a signing failure.

### Ad-hoc signing (dev only, never ship)

```json
{ "bundle": { "macOS": { "signingIdentity": "-" } } }
```

Ad-hoc-signed apps run only on the machine that built them; users will get *"app is damaged"* on
download.

---

## 3. Entitlements (hardened runtime)

Notarization **requires** the hardened runtime, which is on by default. But hardened runtime blocks
several common needs (JIT, dynamic linking from non-system paths, sandbox-incompatible APIs).
Declare them via an entitlements plist.

`src-tauri/Entitlements.plist` (start minimal, add only what you need — see
`templates/entitlements.plist`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key><true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
  <key>com.apple.security.network.client</key><true/>
</dict>
</plist>
```

Wire it:

```json
{ "bundle": { "macOS": { "entitlements": "./Entitlements.plist" } } }
```

Common entitlements:

| Need                                                     | Key                                                      |
| -------------------------------------------------------- | -------------------------------------------------------- |
| Outbound HTTP                                            | `com.apple.security.network.client`                      |
| Local server (sidecar listening)                         | `com.apple.security.network.server`                      |
| WebView JIT (default, usually required)                  | `com.apple.security.cs.allow-jit`                        |
| Disable library validation (for dlopen of unsigned libs) | `com.apple.security.cs.disable-library-validation`       |
| Allow `dyld` from arbitrary paths                        | `com.apple.security.cs.allow-dyld-environment-variables` |

Sandboxing (`com.apple.security.app-sandbox`) is **required for App Store** but **not** for
Developer ID distribution — only enable it on the App Store config.

---

## 4. Notarization — pick one auth method

### A. App Store Connect API key (recommended for CI)

In App Store Connect → Users and Access → Keys, generate an API key. Download the `.p8` file *once*
— it cannot be re-downloaded.

```sh
export APPLE_API_ISSUER="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"  # Issuer ID
export APPLE_API_KEY="ABCDEF1234"                                # Key ID
export APPLE_API_KEY_PATH="$HOME/.appstoreconnect/AuthKey_ABCDEF1234.p8"
```

Tauri detects these and calls `notarytool submit --wait` after bundling. No interactive prompt, no
app-specific password, works headless.

### B. Apple ID + app-specific password (legacy)

```sh
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"   # app-specific password from appleid.apple.com
export APPLE_TEAM_ID="TEAMID12"
```

Slower, prone to 2FA breakage in CI, but no `.p8` to manage.

You can also point at a custom keychain (rare, useful when running multiple signing identities
side-by-side):

```sh
export APPLE_KEYCHAIN=build.keychain
export APPLE_KEYCHAIN_PASSWORD=$KEYCHAIN_PASSWORD
```

### Stapling

Tauri runs `xcrun stapler staple` automatically. To skip (e.g. to upload the bundle then staple
after a manual notarize):

```sh
bun run tauri build --bundles dmg --skip-stapling
```

After upload + notarize, staple manually:

```sh
xcrun stapler staple "path/to/YourApp.dmg"
xcrun stapler validate "path/to/YourApp.dmg"
```

---

## 5. CI: importing a cert into a temporary keychain

GitHub Actions runners come with no keychain unlocked. Standard pattern (also see
[[tauri-bundling-github-actions]]):

```sh
# 1. Decode .p12 from base64 secret
echo "$APPLE_CERTIFICATE" | base64 --decode -o certificate.p12

# 2. Create + unlock an ephemeral keychain
security create-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
security default-keychain -s build.keychain
security unlock-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
security set-keychain-settings -t 3600 -u build.keychain

# 3. Import cert, allow codesign to use it without UI prompt
security import certificate.p12 -k build.keychain \
  -P "$APPLE_CERTIFICATE_PASSWORD" -T /usr/bin/codesign
security set-key-partition-list -S apple-tool:,apple:,codesign: \
  -s -k "$KEYCHAIN_PASSWORD" build.keychain

# 4. Sanity check
security find-identity -v -p codesigning build.keychain
```

Export your `.p12` to base64 for the secret:

```sh
openssl base64 -A -in /path/to/certificate.p12 -out certificate-base64.txt
# Paste contents into APPLE_CERTIFICATE secret
```

Required CI env vars (Developer ID flow):

- `APPLE_CERTIFICATE` (base64 `.p12`)
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `KEYCHAIN_PASSWORD` (any throwaway string)
- One of {`APPLE_API_ISSUER` + `APPLE_API_KEY` + `APPLE_API_KEY_PATH`} **or** {`APPLE_ID` +
  `APPLE_PASSWORD` + `APPLE_TEAM_ID`}

---

## 6. Universal binary (Apple Silicon + Intel)

```sh
rustup target add aarch64-apple-darwin x86_64-apple-darwin
bun run tauri build --target universal-apple-darwin --bundles app,dmg
```

This `lipo`-joins both slices into one `.app`. Output lives at
`target/universal-apple-darwin/release/bundle/...`. Notarization handles universal binaries
transparently — no extra steps.

**On CI**, prefer building separate per-arch artifacts on `macos-latest` (arm64) and `macos-13`
(Intel) rather than universal — the universal binary is ~2x size, and most apps don't need to ship a
single artifact.

---

## 7. App Store path (separate cert, separate output)

For Mac App Store you need a different cert (**Apple Distribution**) and produce a signed `.pkg`
instead of `.dmg`. Sandboxing is mandatory.

```sh
# 1. Build the universal .app, signed with the Apple Distribution identity
export APPLE_SIGNING_IDENTITY="Apple Distribution: Your Name (TEAMID)"
bun run tauri build --bundles app --target universal-apple-darwin

# 2. Wrap in a .pkg signed with Mac Installer Distribution cert
xcrun productbuild --sign "3rd Party Mac Developer Installer: Your Name (TEAMID)" \
  --component "target/universal-apple-darwin/release/bundle/macos/YourApp.app" \
  /Applications \
  "YourApp.pkg"

# 3. Upload to App Store Connect (uses APPLE_API_KEY env)
xcrun altool --upload-app --type macos --file "YourApp.pkg" \
  --apiKey "$APPLE_API_KEY" --apiIssuer "$APPLE_API_ISSUER"
```

Embed the provisioning profile (download from Apple Developer → Profiles → Mac App Store profile for
your bundle id):

```json
{
  "bundle": {
    "macOS": {
      "files": {
        "embedded.provisionprofile": "./MacAppStore.provisionprofile"
      }
    }
  }
}
```

App Store also requires the sandbox entitlement and any matching capability entitlements your
profile grants (network.client, files.user-selected.read-write, etc).

---

## 8. Common errors

| Symptom                                                                      | Cause                                                                                                                            | Fix                                                                                                                 |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `errSecInternalComponent` during codesign                                    | Keychain locked or partition list not set                                                                                        | Re-run `security unlock-keychain` + `set-key-partition-list`                                                        |
| `The executable does not have the hardened runtime enabled` (notarytool log) | Custom signCommand bypassed hardened flag                                                                                        | Let Tauri sign; don't override `signCommand`                                                                        |
| `The signature of the binary is invalid`                                     | Modified bundle after signing (e.g. CI adding files post-`tauri build`)                                                          | Do all file additions via `bundle.macOS.files`, not post-hoc                                                        |
| `Could not find appropriate signing identity`                                | `APPLE_SIGNING_IDENTITY` doesn't match anything in the active keychain                                                           | `security find-identity -v -p codesigning` and copy the exact string                                                |
| Notarization status `Invalid` with no obvious reason                         | A missing entitlement on a nested helper binary (most common cause)                                                              | `xcrun notarytool log <submission-id> --key ...` and read the JSON                                                  |
| App launches on dev machine, "damaged" on others                             | Bundle was signed but not notarized, or notarized but not stapled                                                                | Notarize **and** staple; or remove quarantine: `xattr -dr com.apple.quarantine YourApp.app` (workaround, not a fix) |
| `The binary uses an SDK older than the 10.9 SDK`                             | Old Rust target or dependency built against pre-10.9 SDK                                                                         | Bump `MACOSX_DEPLOYMENT_TARGET=11.0` (or higher)                                                                    |

`xcrun notarytool log <id>` is your single best diagnostic — it returns line-by-line which Mach-O
failed which check.

---

## See also

- [[tauri-bundling]] — host skill, build matrix
- [[tauri-bundling-github-actions]] — full CI workflow with the keychain dance
- [[tauri-updater-signing-keys]] — updater's Ed25519 sig (totally separate from the OS sig here)
- `templates/entitlements.plist` — drop-in hardened-runtime entitlements file
- `templates/notarize.sh` — standalone notarize+staple script for when you sign outside `tauri
  build`

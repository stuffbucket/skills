---
name: tauri-bundling-mobile-stores
description: Use when submitting a Tauri v2 mobile build to the iOS App Store or Google Play — `tauri ios build --export-method app-store-connect` with Apple Distribution cert + provisioning profile, uploading via `xcrun altool` (or Transporter / TestFlight); `tauri android build -- --aab` with a `keystore.properties`-driven Gradle signingConfig, AAB vs APK choice, the first-upload-must-be-manual Play Console gotcha, and Play Integrity setup.
---

# Tauri v2 — Mobile store submission (iOS App Store + Google Play)

Pairs with [[tauri-bundling]] (host skill) and [[tauri-bundling-github-actions]] (CI wiring).

Both stores require a signed build, a developer account, and a store listing reserved with a unique
bundle/package id. This skill covers the *build → sign → upload* mechanics; the
listing/screenshots/review side is platform-specific UI work in App Store Connect or Google Play
Console.

Both Tauri Mobile is current as of Tauri 2.0; iOS dev still requires a macOS host with Xcode
installed. Android can build anywhere.

---

## 1. iOS — App Store submission

### Prerequisites

- Apple Developer Program membership ($99/yr).
- macOS host with Xcode + command-line tools (`xcode-select --install`).
- Bundle identifier registered in App Store Connect (Identifiers section).
- An **Apple Distribution** certificate (not "iOS Distribution", which is the legacy name) —
  generated in *Certificates, Identifiers & Profiles*.
- A matching **App Store** provisioning profile for that bundle id.

### Local build

The simplest path lets Xcode manage signing — it picks the right cert + profile by matching the
bundle id and team:

```sh
# One-time: initialize the iOS project
bun run tauri ios init

# Build a release IPA suitable for App Store upload
bun run tauri ios build --export-method app-store-connect

# Output: src-tauri/gen/apple/build/arm64/YourApp.ipa
```

`--export-method` values:

| Value               | What it produces                                                      | When                                |
| ------------------- | --------------------------------------------------------------------- | ----------------------------------- |
| `app-store-connect` | IPA signed with Apple Distribution + App Store profile                | Production submission               |
| `ad-hoc`            | IPA signed with Apple Distribution + Ad-Hoc profile (UDID-restricted) | Internal testing without TestFlight |
| `debugging`         | IPA signed with Apple Development (development cert)                  | Sideload to your own devices        |

### Upload to App Store Connect

```sh
# Using App Store Connect API key (preferred for CI):
xcrun altool --upload-app \
  --type ios \
  --file "src-tauri/gen/apple/build/arm64/YourApp.ipa" \
  --apiKey "$APPLE_API_KEY_ID" \
  --apiIssuer "$APPLE_API_ISSUER"
```

Or upload interactively via *Transporter.app* (Mac App Store). Once uploaded, the build appears in
App Store Connect → TestFlight → Builds within ~5–30 min after Apple's automated checks pass. From
there:

- **TestFlight**: invite testers immediately (groups of up to 10,000 external).
- **App Store**: attach the build to a version, submit for review (typically 24–48 h review SLA).

### CI signing — env vars

For a headless macOS runner you need to import the cert + profile into a temporary keychain (same
dance as desktop macOS — see [[tauri-bundling-macos-signing]]). The env vars Tauri reads for iOS:

| Var                        | Contents                                |
| -------------------------- | --------------------------------------- |
| `IOS_CERTIFICATE`          | Base64 of the Apple Distribution `.p12` |
| `IOS_CERTIFICATE_PASSWORD` | Password used when exporting the `.p12` |
| `IOS_MOBILE_PROVISION`     | Base64 of the `.mobileprovision` file   |
| `APPLE_API_KEY_ID`         | App Store Connect API key id            |
| `APPLE_API_ISSUER`         | App Store Connect issuer id             |
| `APPLE_API_KEY_PATH`       | Path to the `.p8` key file              |

Encode the cert / profile once on your dev box:

```sh
base64 -i path/to/cert.p12          | pbcopy   # paste into IOS_CERTIFICATE
base64 -i path/to/profile.mobileprovision | pbcopy   # paste into IOS_MOBILE_PROVISION
```

### `ExportOptions.plist`

`tauri ios build` writes one automatically based on `--export-method`. Override only when you need
fine control (signing identity, provisioning style, upload destination). See
`templates/ExportOptions.plist`.

---

## 2. Android — Google Play submission

### Prerequisites

- Google Play Console account ($25 one-time).
- JDK 17 installed (`brew install openjdk@17` / `apt install openjdk-17-jdk`).
- Android SDK + NDK installed via Android Studio.
- Application id (e.g. `com.example.myapp`) — set in `tauri.conf.json` `identifier`, propagated to
  `applicationId` in `build.gradle.kts`.

### One-time: generate a keystore

```sh
# macOS / Linux
keytool -genkey -v \
  -keystore ~/upload-keystore.jks \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias upload

# Windows (PowerShell)
keytool -genkey -v `
  -keystore $env:USERPROFILE\upload-keystore.jks `
  -storetype JKS `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000 `
  -alias upload
```

**Back up the keystore in two places.** If you lose it, you cannot publish updates to the same Play
listing — you'd have to start a new app entry. Print the public-key fingerprint for Play App Signing
onboarding:

```sh
keytool -list -v -keystore ~/upload-keystore.jks -alias upload
```

### `keystore.properties`

Create `src-tauri/gen/android/keystore.properties`:

```properties
password=<keystore-password>
keyAlias=upload
storeFile=/absolute/path/to/upload-keystore.jks
```

**Do not commit this file.** Add to `.gitignore`. See `templates/keystore.properties` for the
canonical shape.

### Gradle wiring

Edit `src-tauri/gen/android/app/build.gradle.kts`. Add the import and `signingConfigs` block above
`buildTypes`:

```kotlin
import java.io.FileInputStream
import java.util.Properties

android {
    // ...

    signingConfigs {
        create("release") {
            val keystorePropertiesFile = rootProject.file("keystore.properties")
            val keystoreProperties = Properties()
            if (keystorePropertiesFile.exists()) {
                keystoreProperties.load(FileInputStream(keystorePropertiesFile))
            }
            keyAlias      = keystoreProperties["keyAlias"]   as String
            keyPassword   = keystoreProperties["password"]   as String
            storeFile     = file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["password"]   as String
        }
    }

    buildTypes {
        getByName("release") {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
}
```

### Build

```sh
# App Bundle (recommended for Play Store)
bun run tauri android build -- --aab
# Output: src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab

# APK for testing / sideload / outside-store distribution
bun run tauri android build -- --apk

# Per-arch builds (smaller per-user download via Play split delivery)
bun run tauri android build -- --aab --target aarch64 --target armv7
bun run tauri android build -- --apk --split-per-abi
```

### AAB vs APK

|                                  | AAB (App Bundle)        | APK                                 |
| -------------------------------- | ----------------------- | ----------------------------------- |
| Play Store                       | Required for new apps   | Not accepted for new apps           |
| Direct download / sideload       | Cannot install directly | Yes                                 |
| Split delivery (per-ABI/density) | Yes                     | No (or manually with split-per-abi) |
| Play App Signing                 | Required                | Manual key                          |

**Default to AAB.** Build APKs only for internal-test rails outside the Store.

### Upload — first time

> "The first upload must be made manually in the website so it can verify your app signature and bundle identifier."

Open Google Play Console → your app → *Internal testing* (or *Production*) → *Create new release* →
upload the `.aab`. Subsequent releases can be uploaded via the Play Developer API (e.g. with
[`fastlane supply`](https://docs.fastlane.tools/actions/supply/) or the official `googleplay` action
in GitHub Actions).

### Play Integrity

Play Integrity (replacement for SafetyNet) is configured in Google Play Console → *App integrity*.
You don't need any Tauri-side code unless your app calls `IntegrityManager` from Kotlin/Java to
verify the device — most Tauri apps rely only on Play's automatic protections (license check,
malware scan) and don't need to integrate the SDK directly.

If you do need device-attestation in-app, write a small Kotlin function under
`src-tauri/gen/android/app/src/main/java/.../IntegrityCheck.kt`, expose it through a custom Tauri
plugin (see [[tauri-plugin-dev-mobile-bridges]]), and call it from your Rust setup hook.

---

## 3. Common errors

| Symptom                                                          | Cause                                                                                               | Fix                                                                     |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| iOS upload: `No suitable application records were found`         | Bundle id not registered in App Store Connect, or you reserved it but haven't created the app entry | Create the app in App Store Connect → My Apps → + before uploading      |
| iOS: `No profiles for 'com.example.app' were found`              | Provisioning profile bundle id mismatch                                                             | Regenerate profile after fixing bundle id in tauri.conf.json identifier |
| Android: `keystore was tampered with, or password was incorrect` | Wrong `password` in keystore.properties                                                             | Re-run keytool to confirm; passwords for store and key may differ       |
| Android: `Invalid signature` from Play Console                   | First upload made via API instead of web                                                            | First upload is always manual; switch to API for subsequent uploads     |
| Android: `INSTALL_FAILED_NO_MATCHING_ABIS` on emulator           | Built only `aarch64` but emulator is `x86_64`                                                       | Add `--target x86_64` for emulator testing                              |
| `xcrun altool` returns auth error                                | `.p8` path wrong, or key not in `~/.appstoreconnect/private_keys/`                                  | Either move the key there or pass `--apiKeyPath` explicitly             |

---

## See also

- [[tauri-bundling]] — host skill
- [[tauri-bundling-macos-signing]] — Apple cert / keychain dance reused on iOS
- [[tauri-bundling-github-actions]] — mobile CI matrix
- [[tauri-plugin-dev-mobile-bridges]] — when you need native Kotlin/Swift for Play Integrity or App
  Store-specific APIs
- `templates/keystore.properties` — canonical shape with comments
- `templates/build-android.sh` — one-shot AAB build with keystore.properties pre-wired
- `templates/ExportOptions.plist` — iOS export options for App Store / Ad Hoc / Development

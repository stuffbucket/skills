---
name: tauri-setup-prerequisites
description: Use when installing Tauri v2 system prerequisites on a specific OS (Linux distro, macOS, Windows, Windows Server), debugging "webkit2gtk not found" / "WebView2 missing" / "link.exe not found" / broken Xcode CLT, or preparing Android/iOS targets. Pairs with the broader `tauri-setup` skill for end-to-end scaffolding.
---

# Tauri v2 Prerequisites — OS-by-OS

Tauri needs three layers of dependencies: **system libs** (webview + linker), **Rust toolchain**
(stable, MSVC on Windows), and optional **mobile SDKs** (Android Studio + NDK, Xcode + Cocoapods).
Get all three before `cargo tauri dev`.

Run `templates/check-prereqs.sh` first — it probes for everything below and prints a single
PASS/FAIL summary.

## Linux

### Debian / Ubuntu (incl. 22.04, 24.04)

```sh
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential curl wget file \
  libxdo-dev libssl-dev \
  libayatana-appindicator3-dev librsvg2-dev
```

**24.04 gotcha:** `libwebkit2gtk-4.0-dev` no longer exists. Tauri v2 already targets 4.1, so the
line above is correct. If you see `E: Unable to locate package libwebkit2gtk-4.0-dev` you
copy-pasted a v1 guide.

### Arch / Manjaro

```sh
sudo pacman -Syu
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl \
  appmenu-gtk-module libappindicator-gtk3 librsvg xdotool
```

### Fedora / RHEL / Rocky

```sh
sudo dnf check-update
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel libxdo-devel
sudo dnf group install "c-development"
```

### openSUSE

```sh
sudo zypper up
sudo zypper in webkit2gtk3-devel libopenssl-devel curl wget file \
  libappindicator3-1 librsvg-devel
sudo zypper in -t pattern devel_basis
```

### Alpine

```sh
sudo apk add build-base webkit2gtk-4.1-dev curl wget file openssl \
  libayatana-appindicator-dev librsvg font-dejavu
```

Alpine containers ship with **no fonts** — `font-dejavu` (or any font package) is required or text
renders as boxes.

### NixOS

Use the flake from <https://wiki.nixos.org/wiki/Tauri>. Do not `apt`/`dnf` equivalents — Nix manages
the linker rpath separately and a raw `cargo build` will fail to find `libwebkit2gtk`.

## macOS (Catalina 10.15+)

**Desktop only:**

```sh
xcode-select --install
xcode-select -p   # should print /Library/Developer/CommandLineTools or /Applications/Xcode.app/...
```

**iOS or universal builds:** install full Xcode from the App Store, then:

```sh
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
xcodebuild -runFirstLaunch
```

**Broken CLT recovery** (symptom: `xcrun: error: invalid active developer path`):

```sh
sudo rm -rf /Library/Developer/CommandLineTools
xcode-select --install
```

## Windows 10 / 11

1. **MSVC Build Tools** — install [Build Tools for Visual
   Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/), check **"Desktop development
   with C++"**. The MSVC linker (`link.exe`) and Windows SDK are required; MinGW will not work.
2. **WebView2** — preinstalled on Windows 10 1803+ and Windows 11. Verify:

   ```powershell
   Get-AppxPackage -Name "Microsoft.WebView2Runtime" -ErrorAction SilentlyContinue
   # or check registry: HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}
   reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" /v pv
   ```

   If missing (Windows Server, stripped LTSC, Windows Sandbox), download the **Evergreen
   Bootstrapper** from <https://developer.microsoft.com/microsoft-edge/webview2/>.
3. **Rust MSVC toolchain:**

   ```powershell
   winget install --id Rustlang.Rustup
   rustup default stable-msvc
   ```

   If `cargo build` errors with `error: linker`link.exe`not found`, you installed the GNU toolchain
   — switch with `rustup default stable-msvc`.
4. **VBSCRIPT** (only for MSI bundles): Settings → Apps → Optional features → More Windows features
   → enable **VBSCRIPT**. Symptom of missing it: `failed to run light.exe` during `tauri build`.

### Windows Server / Sandbox

Both ship without WebView2 and frequently without the Visual C++ runtime. Install the Evergreen
Bootstrapper, then `vc_redist.x64.exe` from Microsoft.

## Rust (all OSes)

```sh
# Linux/macOS
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
rustc --version   # 1.77+ recommended for Tauri 2.0

# Windows (PowerShell)
winget install --id Rustlang.Rustup
rustup default stable-msvc
```

Restart your terminal after install. On Windows, sometimes a full logout is needed for `PATH` to
pick up `~/.cargo/bin`.

## Node.js (optional, for JS frontends)

LTS only. Tauri itself does not need Node, but every JS framework does. Use `corepack enable` to get
`pnpm`/`yarn` without separate installs.

```sh
node -v   # v20.10.0 or newer
npm -v
```

## Mobile targets

### Android

```sh
# Linux
export JAVA_HOME=/opt/android-studio/jbr
# macOS
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
# Windows (PowerShell, User scope)
[System.Environment]::SetEnvironmentVariable("JAVA_HOME","C:\Program Files\Android\Android Studio\jbr","User")
```

Then in Android Studio's SDK Manager install: **Android SDK Platform, Platform-Tools, NDK (Side by
side), Build-Tools, Command-line Tools**.

```sh
# Linux
export ANDROID_HOME="$HOME/Android/Sdk"
# macOS
export ANDROID_HOME="$HOME/Library/Android/sdk"
export NDK_HOME="$ANDROID_HOME/ndk/$(ls -1 $ANDROID_HOME/ndk | tail -1)"

rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

### iOS (macOS only)

```sh
rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim
brew install cocoapods
```

If `pod install` (run by `tauri ios init`) hangs: `pod repo update` once, then retry. Cocoapods on
M-series Macs sometimes needs `arch -arm64 pod install`.

## Common Failures Cheat Sheet

| Symptom                                          | Cause                                                        | Fix                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `libwebkit2gtk-4.0-dev not found` (Ubuntu 24.04) | following v1 guide                                           | install `libwebkit2gtk-4.1-dev`                                             |
| `linker`link.exe`not found` (Windows)            | GNU toolchain installed                                      | `rustup default stable-msvc`                                                |
| `xcrun: error: invalid active developer path`    | CLT removed/broken                                           | `sudo rm -rf /Library/Developer/CommandLineTools && xcode-select --install` |
| `failed to run light.exe` (MSI build)            | VBSCRIPT disabled                                            | enable in Optional Features                                                 |
| Blank window on Linux, no errors                 | missing `librsvg`/icons                                      | reinstall system deps line above                                            |
| Text shows as squares (Alpine container)         | no fonts                                                     | `apk add font-dejavu`                                                       |
| Android `NDK_HOME` not picked up                 | env var set in current shell only                            | export from `~/.zshrc`/`~/.bashrc` and restart                              |
| Tauri build complains about missing `pkg-config` | not in `build-essential`/`base-devel` on some minimal images | install `pkg-config` explicitly                                             |

## Verifying everything

Run `templates/check-prereqs.sh` (Linux/macOS) — it prints `PASS`/`MISSING` per dependency and exits
non-zero on the first missing required item. Re-run after each install step.

On Windows, the equivalent one-liner:

```powershell
rustc --version; cargo --version; node -v; reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" /v pv 2>$null
```

Any line that errors → install that piece.

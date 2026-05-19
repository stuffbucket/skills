---
name: tauri-bundling-linux-packaging
description: Use when packaging a Tauri v2 app for Linux distribution — choosing between AppImage (portable, GPG-signed), deb (Debian/Ubuntu apt repos with postinst hooks), rpm (Fedora/RHEL with GPG signing via `TAURI_SIGNING_RPM_KEY`), Flatpak (Flathub submission), Snap (Snap Store), and an AUR PKGBUILD; picking the glibc baseline (build on Ubuntu 22.04 / Debian 12 for max compatibility); and deciding which format to ship for which audience.
---

# Tauri v2 — Linux packaging

Pairs with [[tauri-bundling]] (host skill) and [[tauri-bundling-github-actions]] (CI wiring).

Linux distribution is plural by nature — no single artifact reaches every user. The decision matrix
below tells you which format to ship for which audience; the sections after walk through each
format's config, signing, and submission specifics.

---

## 1. Decision matrix

| Audience                                  | Ship                                                     | Why                                                                             |
| ----------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| "Just give me a download" (mixed distros) | **AppImage**                                             | Portable single file, runs anywhere with matching glibc + FUSE. No root needed. |
| Ubuntu / Debian / Mint power users        | **deb** + hosted apt repo                                | Native package manager, dependency resolution, auto-updates via `apt upgrade`   |
| Fedora / RHEL / openSUSE                  | **rpm** + dnf/yum repo                                   | Native package manager                                                          |
| Cross-distro "store" users                | **Flatpak** (Flathub)                                    | Sandboxed, dep-isolated, auto-updates via GNOME Software / Discover             |
| Ubuntu-store-first users                  | **Snap**                                                 | Default on Ubuntu, sandboxed, auto-updates                                      |
| Arch users                                | **AUR PKGBUILD** (re-packing your .deb is the easy path) | Community expects AUR availability                                              |

For a broad public release: AppImage + deb + rpm covers ~90% of desktop Linux. Flatpak + Snap add
another ~5% each via their respective stores. AUR is essentially free if you've already built a
.deb.

---

## 2. The glibc baseline rule (read first)

> "Build your Tauri application using the oldest base system you intend to support that also provides Tauri v2's required WebKitGTK 4.1 packages."

Practical translation: **build inside Ubuntu 22.04 or Debian 12**. Both ship `libwebkit2gtk-4.1-dev`
from standard repos, and their glibc (2.35 / 2.36) is old enough that the resulting binaries run on
every reasonably current desktop distro. Building on Ubuntu 24.04 produces binaries that won't run
on 22.04 ("GLIBC_2.38 not found").

GitHub Actions: pin `ubuntu-22.04` (or `ubuntu-22.04-arm` for aarch64).

System deps you need on the build host:

```sh
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf
```

---

## 3. AppImage

Portable single executable, ~70 MB (Tauri runtime + WebKitGTK + GTK + the app). Users `chmod +x` and
double-click. No install, no root.

```sh
bun run tauri build --bundles appimage
# Output: src-tauri/target/release/bundle/appimage/<name>_<ver>_amd64.AppImage
```

### Signing

AppImage's signature is **informational** — AppImageLauncher does not validate it on launch. You
must publish your key ID through an authenticated channel (signed GitHub release, dev website over
HTTPS) and ask users to validate manually with the standalone validator. Still, sign every build:

```sh
gpg2 --full-gen-key                              # one-time keygen, backup both keys

# Env vars:
export SIGN=1
export SIGN_KEY="<long-form key ID>"             # optional; default key if omitted
export APPIMAGETOOL_SIGN_PASSPHRASE="<passphrase>"  # required for CI (else gpg prompts)
export APPIMAGETOOL_FORCE_SIGN=1                 # fail the build if signing fails

bun run tauri build --bundles appimage
```

Verify embedded signature:

```sh
./target/release/bundle/appimage/MyApp_1.0.0_amd64.AppImage --appimage-signature
```

Users validate with the standalone tool from <https://github.com/AppImageCommunity/AppImageUpdate>
releases:

```sh
chmod +x validate-x86_64.AppImage
./validate-x86_64.AppImage MyApp_1.0.0_amd64.AppImage
```

---

## 4. deb (Debian/Ubuntu)

```sh
bun run tauri build --bundles deb
# Output: src-tauri/target/release/bundle/deb/<name>_<ver>_amd64.deb
```

The stock package depends on `libwebkit2gtk-4.1-0`, `libgtk-3-0`, and `libappindicator3-1` (when
system tray is used).

### Config

```json
{
  "bundle": {
    "linux": {
      "deb": {
        "depends": ["libfoo1 (>= 1.2)"],
        "files": {
          "/usr/share/README.md": "../README.md",
          "/usr/share/assets":    "../assets/"
        },
        "section": "utils",
        "priority": "optional",
        "desktopTemplate": "./resources/myapp.desktop",
        "postInstallScript":  "./resources/postinst.sh",
        "preInstallScript":   "./resources/preinst.sh",
        "postRemoveScript":   "./resources/postrm.sh"
      }
    }
  }
}
```

### Hosting an apt repo

Simplest path: use `reprepro` to build a flat repo and serve it over HTTPS or via GitHub Pages.
Users add:

```sh
echo "deb [signed-by=/usr/share/keyrings/myapp.gpg] https://myapp.example.com/apt stable main" \
  | sudo tee /etc/apt/sources.list.d/myapp.list
```

---

## 5. rpm (Fedora/RHEL/openSUSE)

```sh
bun run tauri build --bundles rpm
# Output: src-tauri/target/release/bundle/rpm/<name>-<ver>-1.x86_64.rpm
```

### Config

```json
{
  "bundle": {
    "linux": {
      "rpm": {
        "epoch": 0,
        "release": "1",
        "files": {},
        "preInstallScript":  "/path/src-tauri/scripts/prescript.sh",
        "postInstallScript": "/path/src-tauri/scripts/postscript.sh",
        "preRemoveScript":   "/path/src-tauri/scripts/prescript.sh",
        "postRemoveScript":  "/path/src-tauri/scripts/postscript.sh",
        "conflicts":   ["oldLib.rpm"],
        "depends":     ["newLib.rpm"],
        "obsoletes":   ["veryoldLib.rpm"],
        "provides":    ["coolLib.rpm"],
        "desktopTemplate": "/path/src-tauri/desktop-template.desktop"
      }
    }
  }
}
```

### Signing

Tauri signs at build time when these env vars are set — no post-hoc `rpm --addsign` needed:

```sh
export TAURI_SIGNING_RPM_KEY=$(cat /home/user/my_signing_key.asc)
export TAURI_SIGNING_RPM_KEY_PASSPHRASE="<passphrase>"
bun run tauri build --bundles rpm
```

`TAURI_SIGNING_RPM_KEY` is the **contents** of the ASCII-armored private key, not a path. For CI:
store the armored key as a multi-line secret.

Verify on a user machine:

```sh
sudo rpm --import https://myapp.example.com/RPM-GPG-KEY-myapp
rpm --checksig myapp-1.0.0-1.x86_64.rpm
```

---

## 6. Flatpak (Flathub)

Flatpak isn't a `tauri build` target — you build a deb/AppImage first, then package it via
`flatpak-builder` against a manifest.

```yaml
# org.example.MyApp.yml
id: org.example.MyApp
runtime: org.gnome.Platform
runtime-version: '46'
sdk: org.gnome.Sdk
command: myapp
finish-args:
  - --socket=wayland
  - --socket=fallback-x11
  - --device=dri
  - --share=ipc
  - --share=network              # if you make HTTP calls
modules:
  - name: binary
    buildsystem: simple
    sources:
      - type: archive
        url: https://github.com/example/myapp/releases/download/v1.0.0/myapp_1.0.0_amd64.deb
        sha256: <sha>
    build-commands:
      - ar -x *.deb
      - tar -xf data.tar.gz
      - cp -r usr /app/
```

GNOME 46 runtime includes all Tauri/WebKitGTK 4.1 deps with the right versions. Build + install
locally:

```sh
flatpak install flathub org.gnome.Platform//46 org.gnome.Sdk//46
flatpak-builder --force-clean --user --disable-cache --repo flatpak-repo flatpak org.example.MyApp.yml
flatpak --user remote-add --no-gpg-verify local flatpak-repo
flatpak --user install local org.example.MyApp
flatpak run org.example.MyApp
```

### Flathub submission

```sh
git clone --branch=new-pr git@github.com:<your_username>/flathub.git
cd flathub
git checkout -b org.example.MyApp
# Add your manifest + screenshots + appdata.xml
git add . && git commit -m "Add MyApp" && git push -u origin org.example.MyApp
# Open PR against flathub/flathub:new-pr
```

After review you get push access to a dedicated repo (`flathub/org.example.MyApp`) and update via
PR-to-master on that repo for every release.

---

## 7. Snap (Snap Store)

```yaml
# snap/snapcraft.yaml
name: myapp
base: core22
version: '1.0.0'
summary: One-line summary under 79 chars
description: |
  Multi-line description.

grade: stable
confinement: strict

apps:
  myapp:
    command: usr/bin/myapp
    desktop: usr/share/applications/myapp.desktop
    extensions: [gnome]

parts:
  build-app:
    plugin: dump
    source: ./myapp_1.0.0_amd64.deb
```

Build + publish:

```sh
sudo snapcraft                                             # build .snap locally
snapcraft login
snapcraft upload --release=stable myapp_1.0.0_amd64.snap
```

You can also wire automated builds: Snapcraft → your app → Builds tab → "login with GitHub".

---

## 8. AUR (Arch)

Easiest pattern: repack your prebuilt `.deb` rather than building from source.

```ini
# PKGBUILD — see templates/PKGBUILD for the full file
pkgname=myapp-bin
pkgver=1.0.0
pkgrel=1
pkgdesc="Description of your app"
arch=('x86_64' 'aarch64')
url="https://github.com/example/myapp"
license=('MIT')
depends=('cairo' 'desktop-file-utils' 'gdk-pixbuf2' 'glib2' 'gtk3'
         'hicolor-icon-theme' 'libsoup' 'pango' 'webkit2gtk-4.1')
options=('!strip' '!emptydirs')
install=${pkgname}.install
source_x86_64=("${url}/releases/download/v${pkgver}/myapp_${pkgver}_amd64.deb")
source_aarch64=("${url}/releases/download/v${pkgver}/myapp_${pkgver}_arm64.deb")
```

Submission:

```sh
# 1. Register at https://aur.archlinux.org, add SSH key
# 2. Clone empty repo
git clone ssh://aur@aur.archlinux.org/myapp-bin.git
cd myapp-bin
# 3. Add PKGBUILD and generate .SRCINFO
makepkg --printsrcinfo > .SRCINFO
# 4. Test
makepkg
# 5. Publish
git add PKGBUILD .SRCINFO
git commit -m "Initial commit"
git push origin master
```

Update flow: bump `pkgver`, regenerate `.SRCINFO`, commit, push.

---

## 9. Cheat sheet — which env vars / flags per format

| Format           | Env vars / flags                                                                   |
| ---------------- | ---------------------------------------------------------------------------------- |
| AppImage signing | `SIGN=1`, `SIGN_KEY`, `APPIMAGETOOL_SIGN_PASSPHRASE`, `APPIMAGETOOL_FORCE_SIGN=1`  |
| rpm signing      | `TAURI_SIGNING_RPM_KEY` (armored key contents), `TAURI_SIGNING_RPM_KEY_PASSPHRASE` |
| deb signing      | None at build time — sign the apt repo metadata, not the .deb                      |
| Flatpak          | No env vars; sign happens via Flathub infrastructure                               |
| Snap             | `snapcraft login` token; Snap Store signs                                          |
| AUR              | No signing required                                                                |

---

## See also

- [[tauri-bundling]] — host skill
- [[tauri-bundling-github-actions]] — CI matrix wiring
- `templates/AppRun.sh` — custom AppImage entrypoint (rarely needed; Tauri's default works)
- `templates/PKGBUILD` — drop-in AUR PKGBUILD template
- `templates/flatpak-manifest.yml` — drop-in Flathub manifest template

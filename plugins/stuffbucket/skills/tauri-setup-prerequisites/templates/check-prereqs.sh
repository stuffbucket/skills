#!/usr/bin/env bash
# check-prereqs.sh — probe Tauri v2 system dependencies on Linux/macOS.
# Usage:  bash check-prereqs.sh [--mobile]
# Exit 0 if all required pieces present, 1 otherwise.

set -u

MOBILE=0
[[ "${1:-}" == "--mobile" ]] && MOBILE=1

FAIL=0
pass() { printf "  PASS  %s\n" "$1"; }
miss() { printf "  MISSING  %s  --  %s\n" "$1" "$2"; FAIL=1; }
warn() { printf "  WARN  %s  --  %s\n" "$1" "$2"; }

have() { command -v "$1" >/dev/null 2>&1; }

echo "== Toolchain =="
have rustc && pass "rustc $(rustc --version | awk '{print $2}')" || miss "rustc" "install via rustup: curl https://sh.rustup.rs -sSf | sh"
have cargo && pass "cargo" || miss "cargo" "ships with rustup"
have node  && pass "node $(node -v)" || warn "node" "only needed for JS frontends"
have pkg-config && pass "pkg-config" || miss "pkg-config" "apt: pkg-config / brew: pkg-config"

OS="$(uname -s)"
echo "== System libs ($OS) =="

case "$OS" in
  Linux)
    if have pkg-config; then
      if pkg-config --exists webkit2gtk-4.1; then pass "webkit2gtk-4.1"
      else miss "webkit2gtk-4.1" "apt: libwebkit2gtk-4.1-dev / dnf: webkit2gtk4.1-devel / pacman: webkit2gtk-4.1"; fi
      pkg-config --exists librsvg-2.0 && pass "librsvg" || miss "librsvg" "install librsvg2-dev / librsvg2-devel / librsvg"
      pkg-config --exists openssl && pass "openssl" || miss "openssl" "install libssl-dev / openssl-devel / openssl"
      pkg-config --exists ayatana-appindicator3-0.1 && pass "appindicator (ayatana)" \
        || warn "appindicator" "needed for tray icons"
    fi
    have cc && pass "C compiler ($(cc --version | head -1))" || miss "cc" "install build-essential / base-devel / c-development"
    ;;
  Darwin)
    if xcode-select -p >/dev/null 2>&1; then
      pass "xcode-select path: $(xcode-select -p)"
    else
      miss "xcode-select" "run: xcode-select --install"
    fi
    have clang && pass "clang $(clang --version | head -1 | awk '{print $4}')" || miss "clang" "comes with Xcode CLT"
    ;;
  *)
    warn "$OS" "this script only covers Linux/macOS — see SKILL.md for Windows checks"
    ;;
esac

if [[ "$MOBILE" == "1" ]]; then
  echo "== Mobile =="
  [[ -n "${JAVA_HOME:-}" && -d "$JAVA_HOME" ]] && pass "JAVA_HOME=$JAVA_HOME" || miss "JAVA_HOME" "export to Android Studio's jbr"
  [[ -n "${ANDROID_HOME:-}" && -d "$ANDROID_HOME" ]] && pass "ANDROID_HOME=$ANDROID_HOME" || miss "ANDROID_HOME" "export to Android SDK root"
  [[ -n "${NDK_HOME:-}" && -d "$NDK_HOME" ]] && pass "NDK_HOME=$NDK_HOME" || miss "NDK_HOME" "export to $ANDROID_HOME/ndk/<version>"
  if [[ "$OS" == "Darwin" ]]; then
    have pod && pass "cocoapods $(pod --version)" || miss "cocoapods" "brew install cocoapods"
  fi
  if have rustup; then
    rustup target list --installed | grep -q aarch64-linux-android && pass "aarch64-linux-android target" \
      || warn "android rustup targets" "rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android"
    if [[ "$OS" == "Darwin" ]]; then
      rustup target list --installed | grep -q aarch64-apple-ios && pass "aarch64-apple-ios target" \
        || warn "iOS rustup targets" "rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim"
    fi
  fi
fi

echo
[[ "$FAIL" == "0" ]] && echo "All required prerequisites present." || echo "Some prerequisites are missing — see lines above."
exit "$FAIL"

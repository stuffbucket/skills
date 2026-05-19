#!/usr/bin/env bash
# Build a signed Android App Bundle for Google Play.
#
# Expects env vars (typically populated from CI secrets):
#   ANDROID_KEYSTORE_BASE64   - base64-encoded upload-keystore.jks
#   ANDROID_KEYSTORE_PASSWORD - matches both the store and key password
#
# Or, locally, a pre-existing src-tauri/gen/android/keystore.properties
# and ~/upload-keystore.jks.

set -euo pipefail

ANDROID_DIR="src-tauri/gen/android"

# 1. Initialize the Android project if needed.
if [[ ! -d "$ANDROID_DIR" ]]; then
  bun run tauri android init
fi

# 2. Materialize the keystore + properties from secrets (CI path).
if [[ -n "${ANDROID_KEYSTORE_BASE64:-}" ]]; then
  KEYSTORE_FILE="${RUNNER_TEMP:-/tmp}/upload-keystore.jks"
  echo "$ANDROID_KEYSTORE_BASE64" | base64 --decode > "$KEYSTORE_FILE"
  cat > "$ANDROID_DIR/keystore.properties" <<EOF
password=$ANDROID_KEYSTORE_PASSWORD
keyAlias=upload
storeFile=$KEYSTORE_FILE
EOF
fi

if [[ ! -f "$ANDROID_DIR/keystore.properties" ]]; then
  echo "ERROR: $ANDROID_DIR/keystore.properties missing and no ANDROID_KEYSTORE_BASE64 env var set" >&2
  exit 1
fi

# 3. Build the AAB. Multi-arch for Play split delivery.
bun run tauri android build -- \
  --aab \
  --target aarch64 \
  --target armv7 \
  --target x86_64

OUT="$ANDROID_DIR/app/build/outputs/bundle/universalRelease/app-universal-release.aab"
if [[ ! -f "$OUT" ]]; then
  # Some Tauri/Gradle layouts emit at a slightly different path; find it.
  OUT=$(find "$ANDROID_DIR/app/build/outputs/bundle" -name '*.aab' -print -quit)
fi

echo "AAB built: $OUT"
echo "Upload at: https://play.google.com/console"

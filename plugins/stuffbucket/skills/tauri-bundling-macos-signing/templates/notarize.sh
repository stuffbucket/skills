#!/usr/bin/env bash
# Standalone notarize + staple for a pre-signed .app or .dmg.
# Use this when you sign outside `tauri build` (custom signCommand,
# post-processing, etc) and need to run notarization manually.
#
# Requires: APPLE_API_KEY, APPLE_API_KEY_ID, APPLE_API_ISSUER env vars
# pointing at an App Store Connect API key (.p8 file path).
#
# Usage: ./notarize.sh path/to/YourApp.dmg

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <path-to-.app-or-.dmg-or-.pkg>" >&2
  exit 2
fi

TARGET="$1"

: "${APPLE_API_KEY:?missing APPLE_API_KEY (path to .p8 file)}"
: "${APPLE_API_KEY_ID:?missing APPLE_API_KEY_ID}"
: "${APPLE_API_ISSUER:?missing APPLE_API_ISSUER}"

# notarytool wants .zip for raw .app bundles, .dmg/.pkg can be uploaded directly.
case "$TARGET" in
  *.app)
    ZIP="${TARGET%.app}.zip"
    /usr/bin/ditto -c -k --keepParent "$TARGET" "$ZIP"
    UPLOAD="$ZIP"
    ;;
  *.dmg|*.pkg)
    UPLOAD="$TARGET"
    ;;
  *)
    echo "unsupported target type: $TARGET" >&2
    exit 2
    ;;
esac

echo "==> submitting $UPLOAD to notarytool"
xcrun notarytool submit "$UPLOAD" \
  --key "$APPLE_API_KEY" \
  --key-id "$APPLE_API_KEY_ID" \
  --issuer "$APPLE_API_ISSUER" \
  --wait \
  --output-format json | tee /tmp/notarize-result.json

STATUS=$(jq -r '.status' </tmp/notarize-result.json)
if [[ "$STATUS" != "Accepted" ]]; then
  SUB_ID=$(jq -r '.id' </tmp/notarize-result.json)
  echo "notarization failed (status=$STATUS); fetching log:" >&2
  xcrun notarytool log "$SUB_ID" \
    --key "$APPLE_API_KEY" \
    --key-id "$APPLE_API_KEY_ID" \
    --issuer "$APPLE_API_ISSUER"
  exit 1
fi

echo "==> stapling ticket onto $TARGET"
xcrun stapler staple "$TARGET"
xcrun stapler validate "$TARGET"

echo "OK"

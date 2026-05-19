#!/usr/bin/env bash
# sign-locally.sh — dry-run a signed Tauri release on your dev machine
# before trusting CI with the private key. Confirms the env wiring and
# prints every .sig file produced.
#
# Usage:
#   ./sign-locally.sh                 # uses ~/.tauri/myapp.key
#   KEY=/path/to/key ./sign-locally.sh
#
# Set TAURI_SIGNING_PRIVATE_KEY_PASSWORD in your env if the key has one.

set -euo pipefail

KEY="${KEY:-$HOME/.tauri/myapp.key}"

if [[ ! -f "$KEY" ]]; then
  echo "private key not found: $KEY" >&2
  echo "generate with: bunx tauri signer generate -w $KEY" >&2
  exit 1
fi

if [[ -z "${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}" ]]; then
  echo "warning: TAURI_SIGNING_PRIVATE_KEY_PASSWORD is empty" >&2
  echo "if you set a password when generating, signing will fail" >&2
fi

# Export the raw key contents — `tauri build` reads it inline.
export TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY")"

# Sanity check: make sure the conf actually requests updater artifacts.
if ! grep -q '"createUpdaterArtifacts"' src-tauri/tauri.conf.json 2>/dev/null; then
  echo "tauri.conf.json missing bundle.createUpdaterArtifacts — signed artifacts won't be produced" >&2
  exit 1
fi

echo ">> building signed release (this will take a minute)"
bunx tauri build

echo ""
echo ">> .sig files produced:"
find src-tauri/target/release/bundle -name '*.sig' -print

echo ""
echo ">> verify a signature manually:"
echo "   bunx tauri signer verify <artifact> --signature <artifact>.sig --pubkey ~/.tauri/myapp.key.pub"

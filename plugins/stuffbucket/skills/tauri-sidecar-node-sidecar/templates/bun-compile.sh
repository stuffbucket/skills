#!/usr/bin/env bash
# Compile a Bun script to a per-target sidecar binary.
#
# Usage:  ./bun-compile.sh <entry.ts> <basename> [triple]
#         (triple defaults to host via `rustc --print host-tuple`)
#
# Output: src-tauri/binaries/<basename>-<triple>[.exe]
set -euo pipefail

ENTRY="${1:?usage: $0 <entry.ts> <basename> [triple]}"
BASENAME="${2:?usage: $0 <entry.ts> <basename> [triple]}"
TRIPLE="${3:-$(rustc --print host-tuple)}"

case "$TRIPLE" in
  aarch64-apple-darwin)        BUN_TARGET=bun-darwin-arm64 ; EXT="" ;;
  x86_64-apple-darwin)         BUN_TARGET=bun-darwin-x64   ; EXT="" ;;
  aarch64-unknown-linux-gnu)   BUN_TARGET=bun-linux-arm64  ; EXT="" ;;
  x86_64-unknown-linux-gnu)    BUN_TARGET=bun-linux-x64    ; EXT="" ;;
  x86_64-pc-windows-msvc)      BUN_TARGET=bun-windows-x64  ; EXT=".exe" ;;
  *) echo "Unsupported triple: $TRIPLE" >&2 ; exit 2 ;;
esac

OUT_DIR="src-tauri/binaries"
OUT="$OUT_DIR/${BASENAME}-${TRIPLE}${EXT}"
TMP="${OUT}.tmp"

mkdir -p "$OUT_DIR"

# Sweep any stray temp files from previous interrupted compiles.
find . -maxdepth 1 -type f -name '.[0-9a-f]*-*.bun-build' -delete 2>/dev/null || true
rm -f "$TMP"

echo "[bun-compile] target=$BUN_TARGET out=$OUT"
bun build --compile --target="$BUN_TARGET" "$ENTRY" --outfile="$TMP"

# Sanity check — refuse stubs.
SIZE=$(wc -c < "$TMP" | tr -d ' ')
if [ "$SIZE" -lt 1024 ]; then
  rm -f "$TMP"
  echo "[bun-compile] output suspiciously small ($SIZE B); aborting" >&2
  exit 1
fi

[ -z "$EXT" ] && chmod +x "$TMP"
mv "$TMP" "$OUT"
echo "[bun-compile] wrote $OUT (${SIZE} bytes)"

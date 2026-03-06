#!/usr/bin/env bash
# build_pages.sh — Build the Vite project locally and verify dist/ output
#
# Usage:
#   bash skills/pages-build-vite/scripts/build_pages.sh
#
# This is the local verification step before committing.
# The same build runs in CI via .github/workflows/deploy.yml.
# dist/ is gitignored — it does not need to be committed.

set -euo pipefail

echo "=== pages-build-vite ==="
echo ""

# ── Detect package manager ──────────────────────────────────────────────────
if [ -f "pnpm-lock.yaml" ]; then
  PM="pnpm"
elif [ -f "yarn.lock" ]; then
  PM="yarn"
else
  PM="npm"
fi
echo "  Package manager: $PM"
echo ""

# ── Guard: node_modules must be installed ───────────────────────────────────
if [ ! -d "node_modules" ]; then
  echo "  ✗ node_modules/ not found — run '$PM install' first"
  exit 1
fi

# ── Verify vite.config has a base set ───────────────────────────────────────
if [ -f "vite.config.ts" ] || [ -f "vite.config.js" ]; then
  CONFIG=""
  [ -f "vite.config.ts" ] && CONFIG="vite.config.ts" || CONFIG="vite.config.js"
  if ! grep -qE "^[[:space:]]*base[[:space:]]*:" "$CONFIG"; then
    echo "  ⚠  No 'base' property found in $CONFIG"
    echo "     Run pages-prepare-vite first, or set base manually."
    echo ""
  else
    BASE_VAL=$(grep -E "^[[:space:]]*base[[:space:]]*:" "$CONFIG" | head -1 | sed "s/.*:[[:space:]]*['\"]//;s/['\"].*//")
    echo "  base: '$BASE_VAL'"
    if [ "$BASE_VAL" = "/REPO/" ]; then
      echo "  ⚠  base is '/REPO/' placeholder — re-run pages-prepare-vite with --repo owner/reponame"
      echo "     Assets will load from the wrong path on the deployed site."
      echo ""
    fi
    echo ""
  fi
fi

# ── Run build ────────────────────────────────────────────────────────────────
echo "── Running build"
build_failed() {
  echo ""
  echo "  ✗ Build failed — common causes:"
  echo "     • Type errors: run 'npx tsc --noEmit' to see them"
  echo "     • Missing packages: run '$PM install'"
  echo "     • Import errors: check that all imports exist in src/"
  exit 1
}
case "$PM" in
  pnpm) pnpm run build || build_failed ;;
  yarn) yarn build || build_failed ;;
  *)    npm run build || build_failed ;;
esac
echo ""

# ── Verify output ────────────────────────────────────────────────────────────
echo "── Verifying dist/"
if [ ! -d "dist" ]; then
  echo "  ✗ dist/ not found — check your vite config and build output"
  exit 1
fi

FILE_COUNT=$(find dist -type f | wc -l | tr -d ' ')
INDEX_OK="no"
[ -f "dist/index.html" ] && INDEX_OK="yes"

echo "  ✓ dist/ exists"
echo "  ✓ $FILE_COUNT files"
echo "  ✓ dist/index.html present: $INDEX_OK"

if [ "$INDEX_OK" = "no" ]; then
  echo "  ⚠  dist/index.html not found — Pages deployment may fail"
fi

echo ""
echo "=== Build verified — ready for pages-commit-vite ==="
echo ""
echo "Next step:"
echo "  bash skills/pages-commit-vite/scripts/commit_pages.sh"

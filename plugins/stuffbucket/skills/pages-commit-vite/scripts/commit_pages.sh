#!/usr/bin/env bash
# commit_pages.sh — Commit GitHub Pages configuration changes to the local repo
#
# Stages and commits:
#   .github/workflows/deploy.yml  — the Actions deploy workflow
#   vite.config.ts / vite.config.js — patched with base path
#
# Usage:
#   bash skills/pages-commit-vite/scripts/commit_pages.sh
#   bash skills/pages-commit-vite/scripts/commit_pages.sh "custom commit message"
#
# Note: dist/ is gitignored and is NOT committed. CI builds it in Actions.

set -euo pipefail

MESSAGE="${1:-ci: configure GitHub Pages with Vite build}"

echo "=== pages-commit-vite ==="
echo ""

# ── Guard: workflow file must exist ─────────────────────────────────────────
if [ ! -f ".github/workflows/deploy.yml" ]; then
  echo "  ✗ .github/workflows/deploy.yml not found"
  echo "    Run pages-prepare-vite first."
  exit 1
fi

# ── Guard: warn if base is still a placeholder ───────────────────────────────
for cfg in vite.config.ts vite.config.js; do
  if [ -f "$cfg" ] && grep -qE "base[[:space:]]*:[[:space:]]*['\"/]REPO/" "$cfg"; then
    echo "  ✗ $cfg still contains placeholder base: '/REPO/'"
    echo "    Re-run prepare first:  python3 skills/pages-prepare-vite/scripts/prepare_pages.py --repo owner/reponame"
    exit 1
  fi
done

# ── Stage Pages-related files ────────────────────────────────────────────────
echo "── Staging"
git add .github/workflows/deploy.yml

for cfg in vite.config.ts vite.config.js; do
  [ -f "$cfg" ] && git add "$cfg"
done

# ── Check if anything is actually staged ─────────────────────────────────────
STAGED=$(git diff --cached --name-only)
if [ -z "$STAGED" ]; then
  echo "  Nothing new to commit — all changes already committed"
  echo ""
  echo "=== Done ==="
  echo ""
  echo "Next step:"
  echo "  bash skills/pages-push-vite/scripts/push_pages.sh"
  exit 0
fi

echo "  Files staged:"
echo "$STAGED" | sed 's/^/    /'
echo ""

# ── Commit ───────────────────────────────────────────────────────────────────
echo "── Committing"
git commit -m "$MESSAGE"
echo ""

HASH=$(git rev-parse --short HEAD)
echo "=== Committed ($HASH) — ready for pages-push-vite ==="
echo ""
echo "Next step:"
echo "  bash skills/pages-push-vite/scripts/push_pages.sh"

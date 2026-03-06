#!/usr/bin/env bash
# push_pages.sh — Push the current branch to the remote to trigger CI deployment
#
# Usage:
#   bash skills/pages-push-vite/scripts/push_pages.sh
#   bash skills/pages-push-vite/scripts/push_pages.sh upstream feature/my-branch
#
# Positional args (both optional):
#   $1  remote name  (default: origin)
#   $2  branch name  (default: current branch)

set -euo pipefail

REMOTE="${1:-origin}"
BRANCH="${2:-$(git rev-parse --abbrev-ref HEAD)}"

echo "=== pages-push-vite ==="
echo ""
echo "  Remote: $REMOTE"
echo "  Branch: $BRANCH"
echo ""

# ── Guard: remote must exist ─────────────────────────────────────────────────
if ! git remote get-url "$REMOTE" &>/dev/null; then
  echo "  ✗ Remote '$REMOTE' not configured."
  echo "    Add it first:  git remote add $REMOTE https://github.com/<owner>/<repo>.git"
  exit 1
fi

# ── Guard: workflow must be committed ────────────────────────────────────────
if ! git ls-files --error-unmatch .github/workflows/deploy.yml &>/dev/null 2>&1; then
  echo "  ✗ .github/workflows/deploy.yml is not committed."
  echo "    Run pages-commit-vite first."
  exit 1
fi

# ── Guard: warn if committed vite.config still has placeholder base ──────────
for cfg in vite.config.ts vite.config.js; do
  if git ls-files --error-unmatch "$cfg" &>/dev/null 2>&1; then
    if git show "HEAD:$cfg" 2>/dev/null | grep -qE "base[[:space:]]*:[[:space:]]*['\"/]REPO/"; then
      echo "  ✗ $cfg in HEAD commit still contains placeholder base: '/REPO/'"
      echo "    Re-run prepare + commit before pushing:"
      echo "      python3 skills/pages-prepare-vite/scripts/prepare_pages.py --repo owner/reponame"
      echo "      bash skills/pages-commit-vite/scripts/commit_pages.sh"
      exit 1
    fi
  fi
done

# ── Preview commits that will be pushed ──────────────────────────────────────
TRACKING=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || true)
if [ -n "$TRACKING" ]; then
  AHEAD=$(git rev-list --count "$TRACKING"..HEAD 2>/dev/null || echo "?")
  echo "  Commits to push: $AHEAD  (vs $TRACKING)"
  if [ "$AHEAD" = "0" ]; then
    echo "  Nothing to push — branch is already up to date with $TRACKING"
    echo ""
    echo "=== Done (nothing to push) ==="
    exit 0
  fi
  git --no-pager log --oneline "$TRACKING"..HEAD | sed 's/^/    /'
else
  echo "  No upstream tracking branch set — will push and set upstream"
fi
echo ""

# ── Push ─────────────────────────────────────────────────────────────────────
echo "── Pushing"
TRACKING=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || true)
if [ -z "$TRACKING" ]; then
  git push --set-upstream "$REMOTE" "$BRANCH"
else
  git push "$REMOTE" "$BRANCH"
fi
echo ""

REMOTE_URL=$(git remote get-url "$REMOTE")
echo "=== Pushed to $REMOTE_URL ($BRANCH)"
echo ""
echo "CI workflow started — monitor with pages-publish-vite."
echo ""
echo "Next step:"
echo "  python3 skills/pages-publish-vite/scripts/publish_pages.py"

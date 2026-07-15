#!/usr/bin/env bash
# gh-identity-guard.sh — confirm the active `gh` account matches an expected
# org login before any outward GitHub action, switching if possible.
#
# Many machines have several accounts logged into `gh`; the active one is often
# wrong. Acting under the wrong account leaks an unrelated identity onto public
# artifacts (issues, PRs, comments). Run this as a guard at the top of any ops
# script that performs outward `gh` actions.
#
# Usage:
#   bash gh-identity-guard.sh <expected-login>
#
# Exit codes:
#   0  active account matches (or was switched to) <expected-login>
#   1  usage error, gh missing/unauthenticated, or unable to reach expected
set -euo pipefail

expected="${1:-}"

if [[ -z "$expected" ]]; then
  echo "ERROR: expected login required." >&2
  echo "Usage: bash gh-identity-guard.sh <expected-login>" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI not found on PATH. Install from https://cli.github.com" >&2
  exit 1
fi

# Query the currently active account. Fails if no account is authenticated.
if ! current="$(gh api user -q '.login' 2>/dev/null)"; then
  echo "ERROR: no authenticated gh account. Run: gh auth login" >&2
  exit 1
fi

if [[ "$current" == "$expected" ]]; then
  echo "OK: active gh account is '$expected'."
  exit 0
fi

echo "WARN: active gh account is '$current', expected '$expected'. Switching..." >&2

if ! gh auth switch --user "$expected" >/dev/null 2>&1; then
  echo "ERROR: could not switch to '$expected'. It is not logged in to gh." >&2
  echo "       Run: gh auth login --user $expected   (then re-run this guard)" >&2
  echo "ABORT: refusing to act as '$current' in place of '$expected'." >&2
  exit 1
fi

# Re-confirm after switching — never trust the switch blindly.
if ! confirmed="$(gh api user -q '.login' 2>/dev/null)" || [[ "$confirmed" != "$expected" ]]; then
  echo "ERROR: switch did not land on '$expected' (now '${confirmed:-unknown}')." >&2
  exit 1
fi

echo "OK: switched active gh account to '$expected'."
exit 0

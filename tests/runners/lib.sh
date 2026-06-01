#!/usr/bin/env bash
# Shared helpers for the in-container CLI runners. Sourced, not executed.
#
# These run *inside* a ghcr.io/stuffbucket/ai-cli-<cli> image (launched by
# run.sh with `--entrypoint bash`), with the host's tests/runners/ bind-mounted
# read-only at /opt/runner — so pkg.tgz (the local build under test) and
# mcp-smoke.mjs are available. No model API key is ever set and no LLM is ever
# contacted; npm is used only to fetch the CLI + the package's deps.
set -uo pipefail

RUNNER_DIR="${RUNNER_DIR:-/opt/runner}"
PKG="${RUNNER_DIR}/pkg.tgz"
SERVER_NAME="stuffbucket"             # registration key — matches canonical .mcp.json
LAUNCH=(npx -y @stuffbucket/skills)   # the documented launch command

fail=0
say() { printf '\n=== %s ===\n' "$1"; }
ok()  { printf '  [ok] %s\n' "$1"; }
bad() { printf '  [FAIL] %s\n' "$1"; fail=1; }

# Install the deferred CLI (claude/copilot) exactly as the image's bootstrap
# entrypoint would — we bypass that entrypoint to run this script, so we mirror
# its one job here. codex is baked in (no CLI_BIN env), so this is a no-op there.
ensure_cli() {
  [ -n "${CLI_BIN:-}" ] || return 0
  command -v "$CLI_BIN" >/dev/null 2>&1 && return 0
  echo "installing deferred CLI ${CLI_PACKAGE}@${CLI_VERSION} into ${NPM_CONFIG_PREFIX:-?}…" >&2
  npm install -g "${CLI_PACKAGE}@${CLI_VERSION}" >/tmp/cli-install.log 2>&1 \
    || { echo "CLI install failed:"; tail -20 /tmp/cli-install.log; exit 2; }
}

# Install the *local* build under test into a fresh workdir, so that the
# documented `npx -y @stuffbucket/skills` resolves to it (the local build, never
# the published npm version) without a network round-trip. Leaves us cd'd into
# that dir, so any MCP server a CLI spawns inherits it as cwd and resolves the
# same local install.
setup_local_build() {
  [ -f "$PKG" ] || { echo "missing $PKG — run.sh should have packed it"; exit 2; }
  WORK="$(mktemp -d)"
  cd "$WORK"
  npm init -y >/dev/null 2>&1
  npm install --no-audit --no-fund "$PKG" >/tmp/pkg-install.log 2>&1 \
    || { echo "package install failed:"; tail -20 /tmp/pkg-install.log; exit 2; }
  [ -x node_modules/.bin/skills ] \
    || { echo "the 'skills' bin is missing after install — npx launch would fail"; exit 2; }
}

# Drive the CLI-agnostic MCP protocol smoke against the exact documented launch
# command. This is the real proof that the MCP *serves skills* — and it needs no
# key, because the server is a local stdio process (the key only gates the model).
smoke() {
  node "${RUNNER_DIR}/mcp-smoke.mjs" -- "${LAUNCH[@]}" || fail=1
}

result() {
  say "RESULT"
  if [ "$fail" -eq 0 ]; then echo "$1 RUNNER: PASS"; else echo "$1 RUNNER: FAIL"; fi
  exit "$fail"
}

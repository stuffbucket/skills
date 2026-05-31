#!/usr/bin/env bash
# Static, subscription-free smoke test driven by the GitHub Copilot CLI.
#
# Runs inside the copilot runner container, intended to be launched with
# `docker run --network none` so there is provably no model API or npm registry
# access — only the locally-installed @stuffbucket/skills build.
#
# Copilot's `mcp list/get` are config-level (it health-checks servers only at
# agent runtime, which needs auth). So here we assert that copilot accepts and
# persists the server registered with the documented launch command, and the
# shared mcp-smoke.mjs proves the exact command copilot would launch actually
# serves skills — all offline.
#
# Alpine/musl note: copilot's native agent binary currently segfaults on startup
# under musl (upstream bug). It is never needed for the config commands below
# (they fall back to JS) or for mcp-smoke.mjs (plain node). The `cop` wrapper
# drops only that one known-benign "SIGSEGV" line so a real failure still shows.
#
# Asserts:
#   1. copilot CLI runs offline (no login)
#   2. copilot registers the MCP server via `npx -y @stuffbucket/skills`
#   3. copilot persists/lists that server with the right command
#   4. the server actually serves skills (shared mcp-smoke.mjs)
set -uo pipefail

cd /work   # has node_modules/@stuffbucket/skills, so npx resolves offline
fail=0
say() { printf '\n=== %s ===\n' "$1"; }

# Run copilot, preserving its exit code but filtering out only the known-benign
# musl native-binary SIGSEGV notice (keeps any other stderr visible).
cop() {
  local out rc
  out="$(command copilot "$@" 2>&1)"; rc=$?
  printf '%s\n' "$out" | grep -v 'native binary .* terminated by signal SIGSEGV'
  return "$rc"
}

say "1. copilot CLI runs offline"
cop --version || { echo "copilot --version failed"; fail=1; }

say "2. register MCP server with the documented command"
cop mcp remove skill-router >/dev/null 2>&1 || true
cop mcp add skill-router -- npx -y @stuffbucket/skills \
  || { echo "copilot mcp add failed"; fail=1; }

say "3. copilot persists and lists the server with the right command"
listing="$(cop mcp list)"
echo "$listing"
echo "$listing" | grep -q "skill-router" || { echo "server not listed"; fail=1; }
details="$(cop mcp get skill-router --json)"
echo "$details"
# the stored command must be the documented npx launch
echo "$details" | grep -q "@stuffbucket/skills" \
  || { echo "[FAIL] stored command is not 'npx -y @stuffbucket/skills'"; fail=1; }
echo "$details" | grep -q '"npx"' \
  || { echo "[FAIL] stored command is not npx"; fail=1; }

say "4. the server serves skills (CLI-agnostic protocol smoke)"
node /opt/runner/mcp-smoke.mjs -- npx -y @stuffbucket/skills || fail=1

say "RESULT"
if [ "$fail" -eq 0 ]; then
  echo "COPILOT RUNNER: PASS"
else
  echo "COPILOT RUNNER: FAIL"
fi
exit "$fail"

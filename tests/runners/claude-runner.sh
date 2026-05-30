#!/usr/bin/env bash
# Static, subscription-free smoke test driven by the Claude Code CLI.
#
# Runs inside the claude runner container, intended to be launched with
# `docker run --network none` so there is provably no model API or npm registry
# access — only the locally-installed @stuffbucket/skills build.
#
# Asserts:
#   1. claude CLI runs offline (no login)
#   2. claude can register the MCP server via the documented launch command
#      `npx -y @stuffbucket/skills`
#   3. claude's own health check connects to that server (✓ Connected)
#   4. the server actually serves skills (shared mcp-smoke.mjs)
set -uo pipefail

cd /work   # has node_modules/@stuffbucket/skills, so npx resolves offline
fail=0
say() { printf '\n=== %s ===\n' "$1"; }

say "1. claude CLI runs offline"
claude --version || { echo "claude --version failed"; fail=1; }

say "2. register MCP server with the documented command"
# default (local) scope is auto-approved and health-checked by `mcp list`
claude mcp remove skill-router >/dev/null 2>&1 || true
claude mcp add skill-router -- npx -y @stuffbucket/skills \
  || { echo "claude mcp add failed"; fail=1; }

say "3. claude health-checks and connects to the server"
listing="$(claude mcp list 2>&1)"
echo "$listing"
echo "$listing" | grep -q "skill-router" || { echo "server not listed"; fail=1; }
if echo "$listing" | grep -E "skill-router" | grep -qi "Connected"; then
  echo "[ok] claude reports the skill-router server as Connected"
else
  echo "[FAIL] claude did not report skill-router as Connected"
  fail=1
fi

say "4. the server serves skills (CLI-agnostic protocol smoke)"
node /opt/runner/mcp-smoke.mjs -- npx -y @stuffbucket/skills || fail=1

say "RESULT"
if [ "$fail" -eq 0 ]; then
  echo "CLAUDE RUNNER: PASS"
else
  echo "CLAUDE RUNNER: FAIL"
fi
exit "$fail"

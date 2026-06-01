#!/usr/bin/env bash
# Claude Code CLI — keyless install + MCP-registration proof (runs in-container).
#
# Launched by run.sh inside ghcr.io/stuffbucket/ai-cli-claude with no auth env
# var set, so there is provably no model access — only the locally-installed
# @stuffbucket/skills build and the local MCP server.
#
# Asserts:
#   1. the (deferred) claude CLI installs and runs, keyless
#   2. claude registers the MCP via the documented `npx -y @stuffbucket/skills`
#   3. claude's own health check connects to it  (✓ Connected) — keyless
#   4. the server actually serves skills (shared mcp-smoke.mjs)
source "$(dirname "$0")/lib.sh"

say "1. claude CLI present and runs (keyless)"
ensure_cli
claude --version || bad "claude --version failed"

setup_local_build

say "2. register the MCP with the documented launch command"
claude mcp remove "$SERVER_NAME" >/dev/null 2>&1 || true
claude mcp add "$SERVER_NAME" -- "${LAUNCH[@]}" || bad "claude mcp add failed"

say "3. claude health-checks and connects (✓ Connected) — keyless"
listing="$(claude mcp list 2>&1)"
echo "$listing"
echo "$listing" | grep -q "$SERVER_NAME" || bad "server '$SERVER_NAME' not listed"
if echo "$listing" | grep -E "$SERVER_NAME" | grep -qi "Connected"; then
  ok "claude reports '$SERVER_NAME' as Connected"
else
  bad "claude did not report '$SERVER_NAME' as Connected"
fi

say "4. the server serves skills (CLI-agnostic protocol smoke)"
smoke

result CLAUDE

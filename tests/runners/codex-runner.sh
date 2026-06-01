#!/usr/bin/env bash
# OpenAI Codex CLI — keyless install + MCP-registration proof (runs in-container).
#
# Launched by run.sh inside ghcr.io/stuffbucket/ai-cli-codex with no auth env var
# set. Codex is baked into the image (Apache-2.0), so there is no deferred
# install. Like copilot, codex only contacts a model at agent runtime, so we
# assert it registers and *persists* the server (config.toml + `codex mcp list`
# showing it enabled), and the shared mcp-smoke.mjs proves the launched command
# actually serves skills — all keyless.
#
# Asserts:
#   1. the (baked) codex CLI runs, keyless
#   2. codex registers the MCP via `npx -y @stuffbucket/skills`
#   3. codex persists it: `codex mcp list` shows it enabled + config.toml entry
#   4. the server actually serves skills (shared mcp-smoke.mjs)
source "$(dirname "$0")/lib.sh"

say "1. codex CLI present and runs (keyless, baked-in)"
codex --version || bad "codex --version failed"

setup_local_build

say "2. register the MCP with the documented launch command"
codex mcp remove "$SERVER_NAME" >/dev/null 2>&1 || true
codex mcp add "$SERVER_NAME" -- "${LAUNCH[@]}" || bad "codex mcp add failed"

say "3. codex persists the server (mcp list enabled + config.toml entry)"
listing="$(codex mcp list 2>&1)"
echo "$listing"
echo "$listing" | grep -q "$SERVER_NAME" || bad "server '$SERVER_NAME' not listed"
if echo "$listing" | grep -E "$SERVER_NAME" | grep -qi "enabled"; then
  ok "codex reports '$SERVER_NAME' as enabled"
else
  bad "codex did not report '$SERVER_NAME' as enabled"
fi
config="${CODEX_HOME:-$HOME/.codex}/config.toml"
if grep -q "mcp_servers.$SERVER_NAME" "$config" 2>/dev/null; then
  ok "config.toml has [mcp_servers.$SERVER_NAME]"
else
  bad "config.toml missing [mcp_servers.$SERVER_NAME] ($config)"
fi

say "4. the server serves skills (CLI-agnostic protocol smoke)"
smoke

result CODEX

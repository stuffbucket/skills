#!/usr/bin/env bash
# GitHub Copilot CLI — keyless install + MCP-registration proof (runs in-container).
#
# Launched by run.sh inside ghcr.io/stuffbucket/ai-cli-copilot with no auth env
# var set. Copilot only health-checks servers at agent runtime (which needs
# auth), so here we assert it accepts and *persists* the server registered with
# the documented launch command, and the shared mcp-smoke.mjs proves the exact
# command copilot would launch actually serves skills — all keyless.
#
# (The ai-cli-copilot image is Debian-slim/glibc precisely because Copilot's
# native binary segfaults under Alpine/musl, so no SIGSEGV workaround is needed.)
#
# Asserts:
#   1. the (deferred) copilot CLI installs and runs, keyless
#   2. copilot registers the MCP via `npx -y @stuffbucket/skills`
#   3. copilot persists/lists that server with the right command
#   4. the server actually serves skills (shared mcp-smoke.mjs)
source "$(dirname "$0")/lib.sh"

say "1. copilot CLI present and runs (keyless)"
ensure_cli
copilot --version || bad "copilot --version failed"

setup_local_build

say "2. register the MCP with the documented launch command"
copilot mcp remove "$SERVER_NAME" >/dev/null 2>&1 || true
copilot mcp add "$SERVER_NAME" -- "${LAUNCH[@]}" || bad "copilot mcp add failed"

say "3. copilot persists and lists the server with the right command"
listing="$(copilot mcp list 2>&1)"
echo "$listing"
echo "$listing" | grep -q "$SERVER_NAME" || bad "server '$SERVER_NAME' not listed"
details="$(copilot mcp get "$SERVER_NAME" --json 2>&1)"
echo "$details"
echo "$details" | grep -q "@stuffbucket/skills" || bad "stored command is not @stuffbucket/skills"
echo "$details" | grep -q '"npx"'               || bad "stored command is not npx"

say "4. the server serves skills (CLI-agnostic protocol smoke)"
smoke

result COPILOT

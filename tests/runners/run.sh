#!/usr/bin/env bash
# Run the CLI install/MCP-registration runners for @stuffbucket/skills against
# the shared ghcr.io/stuffbucket/ai-cli-* images.
#
# Proves, for the Claude Code, GitHub Copilot, and OpenAI Codex CLIs, that the
# package installs and registers its MCP server from a clean container — with NO
# model API key and NO connection to an LLM. npm is used only to fetch the CLI
# (for the deferred images) and the package's deps; no auth env var is ever set,
# so no model call is possible.
#
# Usage:
#   tests/runners/run.sh                 # all three runners
#   tests/runners/run.sh claude          # one (claude | copilot | codex)
#   tests/runners/run.sh claude codex    # a subset
#   tests/runners/run.sh --self-test [cli]   # negative control: prove the runner
#                                            # PASSES a good build and FAILS a
#                                            # broken one (default cli: claude)
#
# Env:
#   AI_CLI_REGISTRY  image registry/namespace      (default ghcr.io/stuffbucket)
#   AI_CLI_TAG       image tag                      (default latest)
#   AI_CLI_PULL=1    always `docker pull` (CI);     default: reuse a local image
#                    of the same name if present, else pull.
#
# Exit code: 0 if all selected runners pass (or, in --self-test, if the runner
# discriminates good from broken), 1 otherwise.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
REGISTRY="${AI_CLI_REGISTRY:-ghcr.io/stuffbucket}"
TAG="${AI_CLI_TAG:-latest}"

SELFTEST=0
if [ "${1:-}" = "--self-test" ]; then SELFTEST=1; shift; fi

command -v docker >/dev/null 2>&1 || { echo "docker is required"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker daemon is not running"; exit 2; }

# claude|copilot|codex -> image-name and runner-script (no associative arrays,
# so this stays portable to the bash 3.2 that ships on macOS).
image_of()  { case "$1" in claude) echo ai-cli-claude;; copilot) echo ai-cli-copilot;; codex) echo ai-cli-codex;; *) return 1;; esac; }
script_of() { case "$1" in claude) echo claude-runner.sh;; copilot) echo copilot-runner.sh;; codex) echo codex-runner.sh;; *) return 1;; esac; }

sel=("$@"); [ "$#" -eq 0 ] && sel=(claude copilot codex)
for c in "${sel[@]}"; do
  image_of "$c" >/dev/null || { echo "unknown runner: $c (want claude|copilot|codex)"; exit 2; }
done

echo "==> Packing the build under test"
( cd "$ROOT" && npm run build:index >/dev/null )
tarball="$(cd "$ROOT" && npm pack --silent | tail -1)"
mv "$ROOT/$tarball" "$HERE/pkg.tgz"
trap 'rm -f "$HERE/pkg.tgz" "$HERE/pkg-broken.tgz"' EXIT
echo "    packed $tarball -> tests/runners/pkg.tgz"

# Negative control: a copy of the packed build whose MCP server is replaced with
# a stub that exits immediately. The `skills` bin still resolves (so install +
# launch succeed), but the server never speaks the protocol — so health checks
# and the smoke MUST fail. This is what proves the runner can actually go red.
make_broken_tarball() {
  echo "==> Building a deliberately broken build (negative control)"
  local tmp; tmp="$(mktemp -d)"
  tar xzf "$HERE/pkg.tgz" -C "$tmp"
  local srv="$tmp/package/plugins/stuffbucket/skills/skill-router/scripts/mcp-server.js"
  [ -f "$srv" ] || { echo "cannot find mcp-server.js in the packed build"; exit 2; }
  printf '%s\n' \
    '#!/usr/bin/env node' \
    '// NEGATIVE CONTROL: a broken MCP server that exits immediately, so the CLI' \
    '// health check and the protocol smoke must fail.' \
    'process.exit(0)' > "$srv"
  chmod +x "$srv"
  ( cd "$tmp" && tar czf "$HERE/pkg-broken.tgz" package )
  rm -rf "$tmp"
  echo "    wrote tests/runners/pkg-broken.tgz (mcp-server.js stubbed out)"
}

# Reuse a local image of the same name when present (so locally-built images work
# before the GHCR packages are public); otherwise pull. AI_CLI_PULL=1 forces a
# pull for freshness in CI.
acquire() {
  local image="$1"
  if [ "${AI_CLI_PULL:-0}" != "1" ] && docker image inspect "$image" >/dev/null 2>&1; then
    echo "    using local image $image"
    return 0
  fi
  echo "    pulling $image …"
  if docker pull -q "$image" >/dev/null 2>&1; then return 0; fi
  if docker image inspect "$image" >/dev/null 2>&1; then
    echo "    (pull failed; falling back to local $image)"; return 0
  fi
  echo "ERROR: cannot obtain $image."
  echo "  Make the GHCR package public, or build it from stuffbucket/ai-cli-images:"
  echo "    docker build -t $image <ai-cli-images>/images/<cli>"
  return 1
}

run_one() {
  local name="$1" image="$REGISTRY/$(image_of "$1"):$TAG"
  echo
  echo "################################################################"
  echo "# $name runner  ($image)"
  echo "################################################################"
  acquire "$image" || return 1
  # Pin the exact image identity as evidence (digest survives even if :latest moves).
  local ref; ref="$(docker inspect --format '{{.Id}}' "$image" 2>/dev/null)"
  local digest; digest="$(docker inspect --format '{{if .RepoDigests}}{{index .RepoDigests 0}}{{end}}' "$image" 2>/dev/null)"
  echo "    image id:     ${ref:-?}"
  [ -n "$digest" ] && echo "    repo digest:  $digest"
  # Override the image entrypoint (the CLI) to run our script; mount the runner
  # dir (pkg.tgz + scripts) read-only. No auth env var is passed -> keyless.
  docker run --rm \
    --entrypoint bash \
    -e NO_COLOR=1 \
    -e "RUNNER_IMAGE=${digest:-$image} (${ref:-?})" \
    ${PKG_IN_CONTAINER:+-e "PKG=$PKG_IN_CONTAINER"} \
    -v "$HERE:/opt/runner:ro" \
    "$image" "/opt/runner/$(script_of "$1")"
}

if [ "$SELFTEST" = "1" ]; then
  cli="${sel[0]}"
  make_broken_tarball

  echo
  echo "================================================================"
  echo "# NEGATIVE CONTROL — does the '$cli' runner actually discriminate?"
  echo "================================================================"

  echo
  echo ">>> (A) GOOD build — expect the runner to PASS (exit 0)"
  unset PKG_IN_CONTAINER || true
  if run_one "$cli"; then rc_pos=0; else rc_pos=$?; fi

  echo
  echo ">>> (B) BROKEN build — expect the runner to FAIL (exit != 0)"
  export PKG_IN_CONTAINER=/opt/runner/pkg-broken.tgz
  if run_one "$cli"; then rc_neg=0; else rc_neg=$?; fi
  unset PKG_IN_CONTAINER

  echo
  echo "================================================================"
  echo "NEGATIVE-CONTROL SUMMARY ($cli, in docker)"
  printf '  good build   -> exit %s   (want 0)     %s\n'  "$rc_pos" "$([ "$rc_pos" -eq 0 ] && echo MATCH || echo MISMATCH)"
  printf '  broken build -> exit %s   (want != 0)  %s\n' "$rc_neg" "$([ "$rc_neg" -ne 0 ] && echo MATCH || echo MISMATCH)"
  if [ "$rc_pos" -eq 0 ] && [ "$rc_neg" -ne 0 ]; then
    echo "RESULT: PASS — the runner passes a good build and fails a broken one,"
    echo "        so a green result is meaningful (the test can go red)."
    echo "================================================================"
    exit 0
  fi
  echo "RESULT: FAIL — the runner did not discriminate (a test that cannot fail)."
  echo "================================================================"
  exit 1
fi

rc=0
for c in "${sel[@]}"; do run_one "$c" || rc=1; done

echo
echo "================================================================"
[ "$rc" -eq 0 ] && echo "ALL SELECTED RUNNERS PASSED" || echo "ONE OR MORE RUNNERS FAILED"
echo "================================================================"
exit "$rc"

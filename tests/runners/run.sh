#!/usr/bin/env bash
# Build and run the Docker-isolated CLI runners for @stuffbucket/skills.
#
# Proves, for both the Claude Code CLI and the GitHub Copilot CLI, that the
# skills load and serve correctly from a clean container — with NO model
# subscription and NO network: images are built with network, then each runner
# is executed with `docker run --network none`.
#
# Usage:
#   tests/runners/run.sh            # build tarball + both images, run both
#   tests/runners/run.sh claude     # only the claude runner
#   tests/runners/run.sh copilot    # only the copilot runner
#
# Exit code: 0 if all selected runners pass, 1 otherwise.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
which="${1:-all}"

command -v docker >/dev/null 2>&1 || { echo "docker is required"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker daemon is not running"; exit 2; }

echo "==> Packing the build under test"
( cd "$ROOT" && npm run build:index >/dev/null )
tarball="$(cd "$ROOT" && npm pack --silent | tail -1)"
mv "$ROOT/$tarball" "$HERE/pkg.tgz"
trap 'rm -f "$HERE/pkg.tgz"' EXIT
echo "    packed $tarball -> tests/runners/pkg.tgz"

run_one() {
  local name="$1" dockerfile="$2" image="skills-runner-$1"
  echo
  echo "################################################################"
  echo "# Building $name runner image"
  echo "################################################################"
  docker build -f "$HERE/$dockerfile" -t "$image" "$HERE"
  echo
  echo "################################################################"
  echo "# Running $name runner  (docker run --network none)"
  echo "################################################################"
  docker run --rm --network none "$image"
}

rc=0
if [ "$which" = "all" ] || [ "$which" = "claude" ]; then
  run_one claude Dockerfile.claude || rc=1
fi
if [ "$which" = "all" ] || [ "$which" = "copilot" ]; then
  run_one copilot Dockerfile.copilot || rc=1
fi

echo
echo "================================================================"
if [ "$rc" -eq 0 ]; then
  echo "ALL SELECTED RUNNERS PASSED"
else
  echo "ONE OR MORE RUNNERS FAILED"
fi
echo "================================================================"
exit "$rc"

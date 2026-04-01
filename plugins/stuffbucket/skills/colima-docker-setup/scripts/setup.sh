#!/usr/bin/env bash
# Colima Docker Development Environment Setup
# Installs and configures Colima + Docker CLI + compose + buildx on macOS.
# Idempotent — safe to re-run on an already-configured system.
set -euo pipefail

# Defaults (override via env vars)
COLIMA_CPUS="${COLIMA_CPUS:-4}"
COLIMA_MEMORY="${COLIMA_MEMORY:-8}"
COLIMA_DISK="${COLIMA_DISK:-100}"
COLIMA_PROFILE="${COLIMA_PROFILE:-default}"
COLIMA_VM_TYPE="${COLIMA_VM_TYPE:-vz}"

ARCH=$(uname -m)

# --- Helpers ---
info()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m  ✓\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m  !\033[0m %s\n' "$*"; }
fail()  { printf '\033[1;31m  ✗\033[0m %s\n' "$*" >&2; exit 1; }

check_macos() {
  [[ "$(uname -s)" == "Darwin" ]] || fail "This script only supports macOS."
}

check_jq() {
  command -v jq &>/dev/null || fail "jq is required. Install with: brew install jq"
}

# Resolve the Docker socket path for the given Colima profile.
# Uses --json for reliable parsing across Colima versions.
resolve_socket() {
  local profile="$1"
  local sock
  sock=$(colima status --json -p "$profile" 2>/dev/null | jq -r '.docker_socket // empty')
  # Strip unix:// prefix if present
  sock="${sock#unix://}"
  if [[ -n "$sock" && -S "$sock" ]]; then
    echo "$sock"
  else
    # Fallback: probe known paths (Colima >=0.10 then older)
    for candidate in \
      "$HOME/.config/colima/${profile}/docker.sock" \
      "$HOME/.colima/${profile}/docker.sock"; do
      if [[ -S "$candidate" ]]; then
        echo "$candidate"
        return
      fi
    done
  fi
}

check_brew() {
  command -v brew &>/dev/null || fail "Homebrew is required. Install from https://brew.sh"
}

install_if_missing() {
  local formula="$1"
  if brew list --formula 2>/dev/null | grep -qx "$formula"; then
    ok "$formula already installed"
  else
    info "Installing $formula..."
    brew install "$formula"
    ok "$formula installed"
  fi
}

# --- Step 1: Prerequisites ---
step_install() {
  info "Checking prerequisites..."
  check_macos
  check_brew

  install_if_missing jq
  install_if_missing colima
  install_if_missing docker
  install_if_missing docker-compose
  install_if_missing docker-buildx
}

# --- Step 2: Docker CLI plugins ---
step_plugins() {
  info "Configuring Docker CLI plugins..."
  mkdir -p ~/.docker/cli-plugins

  # docker-compose plugin
  local compose_bin
  compose_bin="$(brew --prefix docker-compose)/bin/docker-compose"
  if [[ ! -f "$compose_bin" ]]; then
    compose_bin="$(which docker-compose 2>/dev/null || true)"
  fi
  if [[ -n "$compose_bin" && -f "$compose_bin" ]]; then
    ln -sf "$compose_bin" ~/.docker/cli-plugins/docker-compose
    ok "docker-compose linked as CLI plugin"
  else
    warn "docker-compose binary not found — 'docker compose' may not work"
  fi

  # docker-buildx plugin
  local buildx_bin
  buildx_bin="$(brew --prefix docker-buildx)/bin/docker-buildx"
  if [[ ! -f "$buildx_bin" ]]; then
    buildx_bin="$(which docker-buildx 2>/dev/null || true)"
  fi
  if [[ -n "$buildx_bin" && -f "$buildx_bin" ]]; then
    ln -sf "$buildx_bin" ~/.docker/cli-plugins/docker-buildx
    ok "docker-buildx linked as CLI plugin"
  else
    warn "docker-buildx binary not found — 'docker buildx' may not work"
  fi
}

# --- Step 3: Colima profile ---
step_colima() {
  info "Configuring Colima profile '$COLIMA_PROFILE'..."

  # Check if profile is already running
  if colima status --json -p "$COLIMA_PROFILE" 2>/dev/null | jq -e . >/dev/null 2>&1; then
    ok "Colima profile '$COLIMA_PROFILE' is already running"
    return
  fi

  # Build start args
  local -a args=(
    --cpu "$COLIMA_CPUS"
    --memory "$COLIMA_MEMORY"
    --disk "$COLIMA_DISK"
    --vm-type "$COLIMA_VM_TYPE"
    --runtime docker
    --mount-type virtiofs
    --activate
  )

  # Enable Rosetta on ARM64 with vz
  if [[ "$ARCH" == "arm64" && "$COLIMA_VM_TYPE" == "vz" ]]; then
    args+=(--vz-rosetta)
    info "ARM64 detected — enabling Rosetta for x86_64 emulation"
  fi

  info "Starting Colima: cpus=$COLIMA_CPUS mem=${COLIMA_MEMORY}G disk=${COLIMA_DISK}G vm=$COLIMA_VM_TYPE"
  colima start -p "$COLIMA_PROFILE" "${args[@]}"
  ok "Colima profile '$COLIMA_PROFILE' started"

  # Fix DOCKER_HOST if it points to a stale socket path (Colima >=0.10 moved to ~/.config/colima/)
  local sock
  sock=$(resolve_socket "$COLIMA_PROFILE")
  if [[ -n "$sock" ]]; then
    export DOCKER_HOST="unix://$sock"
    ok "DOCKER_HOST set to $DOCKER_HOST"
  fi
}

# --- Step 4: Verify ---
step_verify() {
  info "Verifying Docker environment..."
  local errors=0

  # Auto-fix DOCKER_HOST if it points to a missing socket
  if [[ -n "${DOCKER_HOST:-}" ]] && ! docker info &>/dev/null; then
    local sock
    sock=$(resolve_socket "$COLIMA_PROFILE")
    if [[ -n "$sock" && "unix://$sock" != "$DOCKER_HOST" ]]; then
      warn "DOCKER_HOST ($DOCKER_HOST) is stale — socket moved to $sock"
      export DOCKER_HOST="unix://$sock"
      info "Fixed DOCKER_HOST to unix://$sock"
      info "To persist: export DOCKER_HOST=unix://$sock"
    fi
  fi

  if docker info &>/dev/null; then
    ok "docker daemon reachable"
  else
    warn "docker daemon not reachable"
    errors=$((errors + 1))
  fi

  if docker compose version &>/dev/null; then
    ok "docker compose $(docker compose version --short 2>/dev/null)"
  else
    warn "'docker compose' not available"
    errors=$((errors + 1))
  fi

  if docker buildx version &>/dev/null; then
    ok "docker buildx $(docker buildx version 2>/dev/null | awk '{print $2}')"
  else
    warn "'docker buildx' not available"
    errors=$((errors + 1))
  fi

  if colima status --json -p "$COLIMA_PROFILE" 2>/dev/null | jq -e . >/dev/null 2>&1; then
    ok "colima profile '$COLIMA_PROFILE' running"
    colima list 2>/dev/null | grep -E "PROFILE|$COLIMA_PROFILE"
  else
    warn "colima profile '$COLIMA_PROFILE' not running"
    errors=$((errors + 1))
  fi

  echo ""
  if [[ $errors -eq 0 ]]; then
    info "Docker development environment is ready."
  else
    warn "$errors issue(s) detected — review warnings above."
    return 1
  fi
}

# --- Main ---
main() {
  check_macos
  # jq is required for all steps except install (which will install it)
  local action="${1:-all}"
  if [[ "$action" != "install" && "$action" != "all" ]]; then
    check_jq
  fi
  case "$action" in
    install)  step_install ;;
    plugins)  step_plugins ;;
    colima)   step_colima ;;
    verify)   step_verify ;;
    all)
      step_install
      step_plugins
      step_colima
      step_verify
      ;;
    status)
      step_verify
      ;;
    stop)
      info "Stopping Colima profile '$COLIMA_PROFILE'..."
      colima stop -p "$COLIMA_PROFILE"
      ok "Stopped"
      ;;
    *)
      echo "Usage: $0 {all|install|plugins|colima|verify|status|stop}"
      echo ""
      echo "Environment variables:"
      echo "  COLIMA_CPUS      CPU count      (default: 4)"
      echo "  COLIMA_MEMORY    Memory in GiB  (default: 8)"
      echo "  COLIMA_DISK      Disk in GiB    (default: 100)"
      echo "  COLIMA_PROFILE   Profile name   (default: default)"
      echo "  COLIMA_VM_TYPE   VM type        (default: vz)"
      exit 1
      ;;
  esac
}

main "$@"

#!/usr/bin/env bash
# Azure CLI Development Environment Setup
# Installs and configures Azure CLI on macOS for local development.
# Idempotent — safe to re-run on an already-configured system.
set -euo pipefail

# --- Helpers ---
info()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m  ✓\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m  !\033[0m %s\n' "$*"; }
fail()  { printf '\033[1;31m  ✗\033[0m %s\n' "$*" >&2; exit 1; }

check_macos() {
  [[ "$(uname -s)" == "Darwin" ]] || fail "This script only supports macOS."
}

check_brew() {
  command -v brew &>/dev/null || fail "Homebrew is required. Install from https://brew.sh"
}

# --- Step 1: Install ---
step_install() {
  info "Checking prerequisites..."
  check_macos
  check_brew

  if brew list --formula 2>/dev/null | grep -qx "azure-cli"; then
    ok "azure-cli already installed ($(az version --query '\"azure-cli\"' -o tsv 2>/dev/null))"
  else
    info "Installing azure-cli..."
    brew install azure-cli
    ok "azure-cli installed"
  fi
}

# --- Step 2: Configure ---
step_configure() {
  info "Configuring Azure CLI..."

  # Disable telemetry collection
  az config set core.collect_telemetry=false 2>/dev/null || true
  ok "Telemetry disabled"

  # Ensure token cache is plaintext JSON (not DPAPI-encrypted)
  # Required for Docker containers to read cached credentials
  az config set core.encrypt_token_cache=false 2>/dev/null || true
  ok "Token cache set to plaintext (Docker-compatible)"

  # Set default output format
  az config set core.output=json 2>/dev/null || true
  ok "Default output: json"
}

# --- Step 3: Login ---
step_login() {
  info "Checking Azure login status..."

  if az account show &>/dev/null; then
    local acct
    acct=$(az account show --query '{name:name, user:user.name}' -o json 2>/dev/null)
    local name user
    name=$(echo "$acct" | jq -r '.name // "unknown"')
    user=$(echo "$acct" | jq -r '.user // "unknown"')
    ok "Logged in as $user (subscription: $name)"
  else
    warn "Not logged in to Azure"
    info "Run: az login"
    info "Then: az account set --subscription '<subscription-name>'"
    return 1
  fi
}

# --- Step 4: Verify ---
step_verify() {
  info "Verifying Azure CLI environment..."
  local errors=0

  # Check az command exists
  if command -v az &>/dev/null; then
    ok "az CLI $(az version --query '"azure-cli"' -o tsv 2>/dev/null)"
  else
    warn "az CLI not found"
    errors=$((errors + 1))
  fi

  # Check login
  if az account show &>/dev/null; then
    local sub
    sub=$(az account show --query 'name' -o tsv 2>/dev/null)
    ok "Active subscription: $sub"
  else
    warn "Not logged in"
    errors=$((errors + 1))
  fi

  # Check token cache is readable (not DPAPI-encrypted)
  local cache_json="$HOME/.azure/msal_token_cache.json"
  local cache_bin="$HOME/.azure/msal_token_cache.bin"
  if [[ -f "$cache_json" ]]; then
    if head -c1 "$cache_json" 2>/dev/null | grep -q "^{"; then
      ok "Token cache is plaintext JSON (Docker-compatible)"
    else
      warn "Token cache may be encrypted — run: az config set core.encrypt_token_cache=false && az login"
      errors=$((errors + 1))
    fi
  elif [[ -f "$cache_bin" ]]; then
    if head -c1 "$cache_bin" 2>/dev/null | grep -q "^{"; then
      ok "Token cache is plaintext (in .bin file)"
    else
      warn "Token cache is DPAPI-encrypted — Docker won't be able to read it"
      warn "Fix: az config set core.encrypt_token_cache=false && az login"
      errors=$((errors + 1))
    fi
  else
    warn "No token cache found — login first: az login"
    errors=$((errors + 1))
  fi

  echo ""
  if [[ $errors -eq 0 ]]; then
    info "Azure CLI environment is ready."
  else
    warn "$errors issue(s) detected — review warnings above."
    return 1
  fi
}

# --- Step 5: Pre-acquire tokens ---
step_tokens() {
  info "Pre-acquiring access tokens..."
  local scope="${1:-}"

  if ! az account show &>/dev/null; then
    fail "Not logged in. Run: az login"
  fi

  if [[ -n "$scope" ]]; then
    az account get-access-token --scope "$scope" -o none 2>/dev/null \
      && ok "Token acquired for $scope" \
      || warn "Failed to acquire token for $scope"
  else
    info "No scope specified. Usage: $0 tokens <scope-uri>"
    info "Example: $0 tokens 'https://storage.azure.com/.default'"
  fi
}

# --- Main ---
main() {
  check_macos
  local action="${1:-all}"
  case "$action" in
    install)    step_install ;;
    configure)  step_configure ;;
    login)      step_login ;;
    verify)     step_verify ;;
    tokens)     shift; step_tokens "$@" ;;
    all)
      step_install
      step_configure
      step_login
      step_verify
      ;;
    status)
      step_verify
      ;;
    *)
      echo "Usage: $0 {all|install|configure|login|verify|status|tokens <scope>}"
      echo ""
      echo "Steps:"
      echo "  install     Install azure-cli via Homebrew"
      echo "  configure   Set plaintext token cache, disable telemetry"
      echo "  login       Check login status (interactive login requires user)"
      echo "  verify      Verify full setup (install + login + token cache)"
      echo "  status      Alias for verify"
      echo "  tokens      Pre-acquire an access token for a given scope"
      exit 1
      ;;
  esac
}

main "$@"

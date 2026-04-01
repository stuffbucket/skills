---
name: azure-cli-setup
description: Install and configure Azure CLI on macOS for local development. Use when the user needs az CLI installed, needs to log in to Azure, needs to check Azure auth status, or needs to manage subscriptions and access tokens.
---

# Azure CLI Setup

Install and configure Azure CLI on macOS via Homebrew.

## Quick Setup

```bash
bash <skill_dir>/scripts/setup.sh
```

Performs: install, configure (telemetry off, plaintext token cache), login check, verify.

### Individual Steps

```bash
bash <skill_dir>/scripts/setup.sh install     # brew install azure-cli
bash <skill_dir>/scripts/setup.sh configure   # telemetry off, plaintext tokens, json output
bash <skill_dir>/scripts/setup.sh login       # check login status
bash <skill_dir>/scripts/setup.sh verify      # full environment check
bash <skill_dir>/scripts/setup.sh status      # alias for verify
bash <skill_dir>/scripts/setup.sh tokens <scope>  # pre-acquire access token for a scope
```

## After Install

Login is interactive (opens browser). The agent cannot do this — instruct the user:

```text
az login
az account set --subscription "<subscription-name>"
```

## Troubleshooting

Read `<skill_dir>/references/troubleshooting.md` for login failures, subscription management, token cache issues, and reset steps.

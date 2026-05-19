#!/bin/bash
# Detect which linter is configured in the current project.
# Outputs: linter name and auto-fix command template.
# Exit 0 = linter found, exit 1 = no linter.

set -euo pipefail

# JS/TS linters
for f in eslint.config.* .eslintrc .eslintrc.* .eslintrc.json .eslintrc.yml .eslintrc.yaml; do
  if [ -f "$f" ]; then
    echo "eslint"
    echo "npx eslint --fix"
    exit 0
  fi
done

if [ -f "biome.json" ] || [ -f "biome.jsonc" ]; then
  echo "biome"
  echo "npx biome check --write"
  exit 0
fi

if [ -f ".oxlintrc.json" ]; then
  echo "oxlint"
  echo "npx oxlint --fix"
  exit 0
fi

# Python linters
if [ -f "ruff.toml" ] || [ -f ".ruff.toml" ] || grep -q '\[tool\.ruff\]' pyproject.toml 2>/dev/null; then
  echo "ruff"
  echo "ruff check --fix"
  exit 0
fi

if [ -f ".flake8" ] || [ -f "setup.cfg" ]; then
  echo "flake8"
  echo "flake8"
  exit 0
fi

# Go linters
if [ -f ".golangci.yml" ] || [ -f ".golangci.yaml" ] || [ -f ".golangci.toml" ]; then
  echo "golangci-lint"
  echo "golangci-lint run --fix"
  exit 0
fi

# Rust
if [ -f "clippy.toml" ] || [ -f ".clippy.toml" ]; then
  echo "clippy"
  echo "cargo clippy --fix --allow-dirty"
  exit 0
fi

# No linter found
exit 1

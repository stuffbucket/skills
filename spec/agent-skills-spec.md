# Agent Skills Specification

This directory contains the specification for Agent Skills.

The full specification is maintained at: https://agentskills.io/specification

## Quick Reference

### Required Frontmatter Fields

- `name` — Unique skill identifier (max 64 chars, kebab-case, must match directory name)
- `description` — What the skill does and when to trigger it (max 1024 chars)

### Optional Frontmatter Fields

- `license` — License name or reference
- `metadata` — Flat key-value map of strings (e.g., `author: "Name"`)
- `compatibility` — Environment requirements (string, max 500 chars)
- `allowed-tools` — Space-delimited list of pre-approved tools

### Size Guidelines

- SKILL.md body: under 500 lines, under 5000 tokens recommended
- Use separate `references/`, `scripts/`, or `assets/` directories for supplementary content

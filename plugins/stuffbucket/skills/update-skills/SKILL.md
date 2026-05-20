---
name: update-skills
description: Check for stuffbucket MCP server updates and apply them. Use when the user asks to update skills, check for new versions, or upgrade the stuffbucket MCP server.
allowed-tools: Bash
---

# Update Skills

Check for and apply updates to the Stuffbucket Skills installation.

## Check for updates

```bash
node {{SKILL_DIR}}/scripts/version-check.js
```

Compares the installed version against the latest git tag. No download needed — runs locally.

## Apply an update

```bash
npx -y github:stuffbucket/skills --update
```

Downloads the latest version and replaces the local installation. MCP client configs do not change — they point to the local path which stays the same. The update takes effect on the next agent session.

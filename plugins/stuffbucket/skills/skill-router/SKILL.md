---
name: skill-router
description: Find and load skills on demand. Use when you need a specialized skill for a task but don't know which one, or to load a skill by name.
license: MIT
allowed-tools: list_skills get_skill
---

# Skill Router

A local MCP tool that lets you discover and load skills on demand instead of keeping all skill descriptions in context permanently.

## Why This Exists

Every MCP tool description occupies context window tokens on every turn.
With N skills registered as separate tools, the cost is N × description_size tokens — permanently.
This router reduces that to one small description (~50 tokens)
plus on-demand loading of only the skills actually needed.

## How Agents Reach This Repo

There are two interaction patterns. They are independent — an agent may use either or both.

### Pattern 1: Static discovery via marketplace.json

An agent is pointed at this GitHub repo (by URL or by a mechanism that loads marketplace.json locally).
The agent reads the marketplace manifest, discovers available skills and MCP servers, and installs what it needs.
This may be the end of the interaction — the agent now has skills loaded and can use them directly.

The marketplace.json lists all skills and MCP configurations. No MCP server needs to be running for this pattern.

### Pattern 2: Dynamic routing via MCP

The agent uses the skill-router MCP for on-demand skill discovery and loading.
Skills are not installed or configured permanently —
they are capabilities of the MCP that return knowledge to the agent on demand.
At the end of the agent session, that knowledge is gone.
Only the skill-router MCP configuration persists between sessions.

This requires installing the MCP onto the host and into the agent's configuration.
The MCP runs locally as a stdio tool — it does not call any remote service.
All skill content is bundled in the npm package so everything stays on the host.

Installation can happen via:

- The marketplace.json (if the agent's platform supports MCP installation from manifests)
- Direct npx invocation (see Setup below)

Other MCPs listed in the marketplace (e.g., workiq-proxy) follow the same pattern: the agent reads the manifest from the repo and installs them onto the host separately.

## MCP Tools

The MCP server exposes two tools:

- `list_skills` — returns the compact index (name + description + tags), with fuzzy keyword filtering
- `get_skill(name)` — returns full SKILL.md content, with fuzzy name matching and suggestions

### Setup

Add to the agent's MCP configuration:

```json
{
  "mcpServers": {
    "skill-router": {
      "command": "npx",
      "args": ["-y", "@stuffbucket/skills"]
    }
  }
}
```

The npm package bundles all skill content, the pre-built index, and the MCP server. After first install, it runs fully offline.

For local development, the server can also be run directly:

```bash
node plugins/stuffbucket/skills/skill-router/scripts/mcp-server.js
```

In a terminal, the server starts an interactive REPL. When piped from an MCP client, it uses the standard JSON-RPC stdio transport.

## Using Skills

### 1. Discover

Call `list_skills` with no arguments to see everything, or pass a keyword to filter.

### 2. Match

Each entry has:

- `name` — skill identifier
- `description` — when to use it
- `tags` — keyword hints for matching

Pick the entry whose description best matches the current task.

### 3. Load

Call `get_skill(name)` to load the full instructions. Only load what you need — one or two skills per task at most.

### 4. Follow the skill

If the loaded skill references scripts, references, or assets, load those only when the skill instructions say to.

## Guidelines

- Always check the index before loading a full skill
- Load at most one or two skills per task — if you need more, reassess the task decomposition
- Prefer skills with matching `tags` over fuzzy description matching
- If no skill matches, say so — don't force a poor match

---
name: skill-router
description: Find and load skills on demand. Use when you need a specialized skill for a task but don't know which one, or to load a skill by name.
license: MIT
allowed-tools: list_skills get_skill
---

# Skill Router

A single-tool entry point that replaces loading all skill descriptions into context. Query the index to discover skills, then load only the ones you need.

## Why This Exists

Every MCP tool description occupies context window tokens on every turn. With N skills registered as separate tools, the cost is N × description_size tokens — permanently. This router reduces that to one small description (~50 tokens) plus on-demand loading of only the skills actually needed.

## How to Use

### 1. Generate or read the index

Run the index generator to build a compact catalog:

```bash
node plugins/stuffbucket/skills/skill-router/scripts/build-index.js
```

This produces `plugins/stuffbucket/skills/skill-router/index.json` — a compact manifest of all available skills with just name, description, path, and tags.

Or read the pre-built index directly:

```
read_file plugins/stuffbucket/skills/skill-router/index.json
```

### 2. Match task to skill

Scan the index entries. Each entry has:
- `name` — skill identifier
- `description` — when to use it
- `path` — location of the full SKILL.md
- `tags` — keyword hints for matching
- `allowed-tools` — what tools the skill expects

Pick the entry whose description best matches the current task.

### 3. Load the full skill on demand

Once you identify the right skill, load its full SKILL.md:

```
read_file <path>/SKILL.md
```

Only load what you need. If multiple skills seem relevant, load them one at a time and assess before loading more.

### 4. Load bundled resources as needed

If the loaded skill references scripts, references, or assets, load those only when the skill instructions say to.

## Integration with MCP

The MCP server exposes two operations as a single process:

- `list_skills` — returns the compact index (name + description + tags), with fuzzy keyword filtering
- `get_skill(name)` — returns full SKILL.md content, with fuzzy name matching and suggestions

### Running the server

Via published npm package (runs offline after first install):

```bash
npx @stuffbucket/skills
```

Or directly from the repo:

```bash
node plugins/stuffbucket/skills/skill-router/scripts/mcp-server.js
```

In a terminal, the server starts an interactive REPL. When piped from an MCP client, it uses the standard JSON-RPC stdio transport.

### .mcp.json configuration

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

## Guidelines

- Always check the index before loading a full skill
- Load at most one or two skills per task — if you need more, reassess the task decomposition
- Prefer skills with matching `tags` over fuzzy description matching
- If no skill matches, say so — don't force a poor match
- The index is generated from live frontmatter, so it's always in sync after `build-index.js` runs

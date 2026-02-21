# Stuffbucket Skills

Agent skills for Claude, Copilot, and other AI assistants, with a bundled MCP skill-router server.

## Setup

```sh
npm run setup    # install deps, create MCP symlinks, build skill index
```

## Available Skills

| Skill | Description |
|---|---|
| `skill-router` | MCP server — find and load skills on demand (context window optimization) |
| `skill-creator` | Guide for creating, validating, and packaging new skills |
| `example-skill` | Demonstrates proper structure and format |
| `file-management-skill` | File and directory operations |
| `code-analysis-skill` | Code quality and pattern analysis |

## MCP Server

The skill-router exposes two tools (`list_skills`, `get_skill`) instead of registering every skill separately — constant context window cost regardless of how many skills exist.

```sh
npm run test:repl    # interactive REPL
```

Or configure in any MCP client:

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

## Structure

```
plugins/stuffbucket/
├── .mcp.json                          # MCP server config (canonical)
└── skills/
    └── <skill-name>/
        ├── SKILL.md                   # Skill definition (required)
        ├── scripts/                   # Executable scripts (optional)
        ├── references/                # Reference documents (optional)
        └── assets/                    # Static resources (optional)
.mcp.json                              # Symlink → plugins/stuffbucket/.mcp.json
.vscode/mcp.json                       # Symlink → same (VS Code discovery)
.claude-plugin/marketplace.json        # Claude Code plugin manifest
.github/plugin/marketplace.json        # Copilot plugin manifest (aspirational)
```

## Scripts

| Command | What it does |
|---|---|
| `npm run setup` | Install deps + create MCP symlinks + build index |
| `npm run build:index` | Rebuild the skill-router index |
| `npm test` | Build index + run MCP server smoke tests |
| `npm run test:repl` | Build index + launch interactive REPL |
| `npm run lint` | Lint markdown + JS + JSON schemas |
| `npm run validate` | Validate example skill frontmatter |
| `npm run build:llms` | Regenerate llms.txt from template |

## Creating a New Skill

```bash
python3 plugins/stuffbucket/skills/skill-creator/scripts/init_skill.py my-new-skill \
  --path plugins/stuffbucket/skills
```

Then update SKILL.md and add the skill path to both marketplace.json manifests. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Docs

- [Integration Status](docs/integration-status.md) — what's functional vs. aspirational
- [Best Practices](docs/best-practices.md) — skill authoring guidelines
- [Agent Skills Spec](spec/agent-skills-spec.md) — specification reference

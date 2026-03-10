# Stuffbucket Skills

Agent skills for Claude, Copilot, and other AI assistants, with a bundled MCP skill-router server.

## Install as Plugin Marketplace

### Claude Code

```sh
/plugin marketplace add stuffbucket/skills
```

### Copilot CLI

```sh
/plugin marketplace add stuffbucket/skills
```

## Setup

```sh
npm run setup    # install deps, create MCP symlinks, build skill index
```

## Available Skills

| Skill | Description |
| --- | --- |
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

```text
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
.github/plugin/marketplace.json        # Copilot plugin manifest
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run setup` | Install deps + create MCP symlinks + build index |
| `npm run build:index` | Rebuild the skill-router index |
| `npm test` | Build index + run MCP server smoke tests |
| `npm run test:repl` | Build index + launch interactive REPL |
| `npm run lint` | Lint markdown + JS + JSON schemas |
| `npm run validate` | Validate all skills (frontmatter + content completeness) |
| `npm run validate:one -- <path>` | Validate a single skill |
| `npm run new -- <name>` | Scaffold a new skill |
| `npm run build:llms` | Regenerate llms.txt from template |

## Creating a New Skill

```bash
npm run new -- my-new-skill
# edit SKILL.md and resource files
npm run validate
npm run package -- plugins/stuffbucket/skills/my-new-skill
# open a New skill issue and attach the .skill file
```

Skills are auto-discovered. A workflow validates the package and opens a PR automatically. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Docs

- [Integration Status](docs/integration-status.md) — what's functional vs. aspirational
- [Best Practices](docs/best-practices.md) — skill authoring guidelines
- [Agent Skills Spec](spec/agent-skills-spec.md) — specification reference

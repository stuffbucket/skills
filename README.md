# Stuffbucket Skills

[![GitHub stars](https://img.shields.io/github/stars/stuffbucket/skills?style=flat-square)](https://github.com/stuffbucket/skills/stargazers)
[![npm version](https://img.shields.io/npm/v/@stuffbucket/skills?style=flat-square)](https://www.npmjs.com/package/@stuffbucket/skills)
[![License: MIT](https://img.shields.io/github/license/stuffbucket/skills?style=flat-square)](LICENSE)

**On-demand skills for AI agents.** Instead of stuffing every capability into the context window, agents discover and load only what they need — via a 2-tool MCP server that scales to any number of
skills at constant cost.

Works with Claude, Copilot, and any MCP-compatible client.

## Quick Start

Add the MCP server to any client:

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

Or install as a plugin marketplace:

```sh
# Claude Code
/plugin marketplace add stuffbucket/skills

# Copilot CLI
/plugin marketplace add stuffbucket/skills
```

That's it. Your agent can now discover and load skills on demand.

## How It Works

The skill-router exposes two tools — `list_skills` and `get_skill` — instead of registering every skill separately. Agents search by intent, load what they need, and the context window cost stays
constant.

Each skill is a self-contained package: a `SKILL.md` with instructions plus optional `scripts/`, `references/`, and `assets/`. Skills are authored once by an expert and delivered automatically to
anyone whose agent needs them.

## Create a Skill in 5 Minutes

Anyone can contribute a skill. The entire workflow is scaffold → edit → validate → submit:

```bash
# 1. Scaffold
npm run new -- my-new-skill

# 2. Edit the generated SKILL.md
#    - Set `name` and `description` in the frontmatter (this is what triggers the skill)
#    - Write instructions in the body (what the agent needs to know)
#    - Add scripts/, references/, or assets/ if needed

# 3. Validate
npm run validate:one -- plugins/stuffbucket/skills/my-new-skill

# 4. Package and submit
npm run package -- plugins/stuffbucket/skills/my-new-skill
# Open a "New skill" issue and attach the .skill file — CI validates and opens a PR
```

**Key principles** (from the [skill-creator guide](plugins/stuffbucket/skills/skill-creator/SKILL.md)):

- **The agent is already smart.** Only include knowledge it doesn't have — specific workflows, schemas, tool integrations, domain expertise.
- **Context window is a public good.** Keep SKILL.md under 500 lines. Split large content into `references/` files.
- **Match freedom to fragility.** Text instructions for flexible tasks, executable scripts for brittle ones.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide, or read the [Best Practices](docs/best-practices.md).

## Available Skills

| Skill | Description |
| --- | --- |
| `skill-router` | MCP server — find and load skills on demand (context window optimization) |
| `skill-creator` | Guide for creating, validating, and packaging new skills |
| `figma-make-to-vite` | Integrate Figma Make exports into Vite + React + TypeScript projects |
| `file-management-skill` | File and directory operations |
| `code-analysis-skill` | Code quality and pattern analysis |
| `git-workflow-skill` | Git operations (commit, branch, merge, rebase) |
| `testing-skill` | Unit and integration test writing and execution |
| `pages-prepare-vite` | Prepare a Vite project for GitHub Pages deployment |
| `pages-build-vite` | Build and verify a Vite project for Pages |
| `pages-commit-vite` | Stage and commit Pages configuration files |
| `pages-push-vite` | Push branch to trigger GitHub Actions deployment |
| `pages-publish-vite` | Monitor Actions deployment and report the live URL |
| `example-skill` | Demonstrates proper structure and format |

## Development Setup

```sh
npm run setup    # install deps, create MCP symlinks, build skill index
```

### Scripts

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

## Docs

- [Integration Status](docs/integration-status.md) — what's functional vs. aspirational
- [Best Practices](docs/best-practices.md) — skill authoring guidelines
- [Agent Skills Spec](spec/agent-skills-spec.md) — specification reference

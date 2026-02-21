# Contributing

Thank you for your interest in contributing to this project.

## Adding a New Skill

The fastest way to create a new skill is with the init script:

```bash
python3 plugins/stuffbucket/skills/skill-creator/scripts/init_skill.py my-new-skill \
  --path plugins/stuffbucket/skills
```

This scaffolds a directory with a SKILL.md template and example resource directories.

Then:

1. Edit the generated SKILL.md — update the frontmatter `name` and `description`, and replace the TODO sections
2. Customize or remove the example files in `scripts/`, `references/`, and `assets/`
3. Add the skill path to both marketplace.json files (`.github/plugin/` and `.claude-plugin/`)
4. Validate with `python3 plugins/stuffbucket/skills/skill-creator/scripts/quick_validate.py plugins/stuffbucket/skills/my-new-skill`

## Skill Guidelines

- Keep SKILL.md under 500 lines and 5000 tokens
- Use separate `references/`, `scripts/`, or `assets/` directories for supplementary content
- Follow the [Agent Skills Specification](https://agentskills.io/specification)

## Adding a New Plugin

1. Create a new directory under `plugins/`
2. Add an `.mcp.json` file if the plugin provides MCP server tools
3. Create a `skills/` subdirectory and add skills
4. Register the plugin in both marketplace.json manifests

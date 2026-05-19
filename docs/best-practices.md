# Skill Creation Best Practices

## Naming Conventions

- Use lowercase letters only
- Separate words with hyphens (no spaces or underscores)
- Be descriptive but concise
- Follow the pattern: `[action]-[object]-skill` when applicable

## YAML Frontmatter Requirements

### Required Fields

- `name`: The skill identifier (must match directory name)
- `description`: Clear, concise description of the skill's purpose

### Recommended Optional Fields

- `license`: SPDX license identifier (e.g., MIT, Apache-2.0)
- `metadata`: Additional categorization and tagging
- `compatibility`: List of supported AI assistants
- `allowed-tools`: List of tools the skill expects to use

## Writing trigger-friendly descriptions

The router ranks skills by matching the user's intent against each `description`. A vague description never gets loaded. Make yours rank-friendly:

- **Lead with "Use when..."** — state the triggering situation in the first clause so the matcher sees it (e.g. "Use when scaffolding a Tauri v2 app").
- **Use concrete nouns the user will type** — library names, file extensions, error strings, CLI flags. "Vite", "tauri.conf.json", "webkit2gtk not found" beat "the build tool".
- **List the specific sub-topics covered** — comma-separated keywords act as a search surface. Mention every API/command/flag the skill addresses.
- **Skip marketing language** — "powerful", "comprehensive", "best-in-class" add tokens without ranking signal. Cut them.
- **State both *what* and *when*** — the spec requires it, and the router uses both halves. "Configures X" is half a description; "Use when configuring X to do Y" is whole.

## Content Structure

Follow the progressive disclosure principle:

1. High-level overview and when to use the skill
2. Prerequisites and setup instructions
3. Step-by-step usage guide
4. Examples and use cases
5. Guidelines and limitations
6. Troubleshooting tips

## Length Optimization

Keep the main content under 500 lines for optimal context management:

- Focus on essential information
- Link to external documentation when possible
- Use concise language
- Break complex topics into sub-skills

## Cross-Platform Compatibility

Ensure skills work with multiple AI assistants by:

- Using standard tool names
- Avoiding platform-specific terminology
- Testing with different models
- Providing clear fallback options

## Version Control

- Use semantic versioning for skills
- Document breaking changes
- Maintain backward compatibility when possible
- Tag releases appropriately

# Copilot Plugins Repository

This repository contains plugins for GitHub Copilot following the official copilot-plugins structure.

## Structure

- `.github/plugin/`: Configuration for Copilot plugin integration
- `plugins/`: Individual plugin directories
- `plugins/*/skills/`: Skills for each plugin
- `template/`: Template for creating new skills
- `spec/`: Specification documents
- `copilot-cli/`: CLI tool for managing skills

## Plugin Structure

Each plugin follows this structure:

```
plugins/
└── plugin-name/
    ├── .mcp.json
    └── skills/
        └── skill-name/
            └── SKILL.md
```

## Creating a New Plugin

1. Create a new directory under `plugins/`
2. Add an `.mcp.json` file with server configuration
3. Create a `skills/` directory
4. Add skills using the template

## Creating a New Skill

1. Copy the template directory
2. Rename it to your skill name
3. Update the SKILL.md file with your skill's instructions
4. Add any additional resources needed

## CLI Tool

The repository includes a CLI tool in the `copilot-cli/` directory for managing skills:

```
cd copilot-cli
npm start
```

# Skills Repository

This repository contains skills for Claude and other AI assistants, along with a CLI tool for managing them.

## Structure

- `skills/`: Individual skill directories
- `template/`: Template for creating new skills
- `spec/`: Specification documents
- `.claude-plugin/`: Configuration for Claude plugin integration
- `copilot-cli/`: CLI tool for managing skills

## Creating a New Skill

1. Copy the template directory
2. Rename it to your skill name
3. Update the SKILL.md file with your skill's instructions
4. Add any additional resources needed

## Using Skills

Skills can be used with Claude Code, Claude.ai, or the Claude API.

## CLI Tool

The repository includes a CLI tool in the `copilot-cli/` directory for managing skills:

```
cd copilot-cli
npm start
```

## Example Skill

We've included an example skill in `skills/example-skill/` to demonstrate the proper structure.

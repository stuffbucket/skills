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

# Contribution Guidelines

## Getting Started

1. Create a skill with `npm run new -- my-new-skill`
2. Edit the generated SKILL.md and resource files
3. Run `npm run validate` to check your work
4. Package with `npm run package -- plugins/stuffbucket/skills/my-new-skill`
5. Open a **New skill** issue and attach the `.skill` file
6. A workflow will validate the package and open a PR automatically

Skills are auto-discovered — no fork, branch, or manual registration needed.

## Skill Submission Requirements

### Code Quality

- Follow the Agent Skills specification
- Include proper YAML frontmatter
- Maintain content under 500 lines when possible
- Use clear, concise language

### Documentation

- Provide comprehensive usage instructions
- Include relevant examples
- Document prerequisites and limitations
- Add troubleshooting guidance

### Testing

- Test with multiple AI assistants
- Validate with the provided validation script
- Ensure all required fields are present
- Verify cross-platform compatibility

## Review Process

All submissions will be reviewed for:

1. Compliance with the Agent Skills specification
2. Clarity and completeness of documentation
3. Quality and accuracy of content
4. Adherence to naming conventions
5. Proper use of optional fields

## Community Guidelines

- Be respectful and constructive in all interactions
- Provide helpful feedback to other contributors
- Acknowledge and credit the work of others
- Focus on improving the skills ecosystem for everyone

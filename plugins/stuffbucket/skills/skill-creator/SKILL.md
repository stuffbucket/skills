---
name: skill-creator
description: Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends the agent's capabilities with specialized knowledge, workflows, or tool integrations.
license: Complete terms in LICENSE.txt
---

# Skill Creator

This skill provides guidance for creating effective skills for AI agents.

## About Skills

Skills are modular, self-contained packages that extend the agent's capabilities by providing
specialized knowledge, workflows, and tools. Think of them as "onboarding guides" for specific
domains or tasks—they transform the agent from a general-purpose agent into a specialized agent
equipped with procedural knowledge that no model can fully possess.

### What Skills Provide

1. Specialized workflows - Multi-step procedures for specific domains
2. Tool integrations - Instructions for working with specific file formats or APIs
3. Domain expertise - Company-specific knowledge, schemas, business logic
4. Bundled resources - Scripts, references, and assets for complex and repetitive tasks

## Core Principles

### Concise is Key

The context window is a public good. Skills share the context window with everything else the agent needs: system prompt, conversation history, other Skills' metadata, and the actual user request.

**Default assumption: The agent is already very smart.** Only add context the agent doesn't already have.
Challenge each piece of information: "Does the agent really need this explanation?"
and "Does this paragraph justify its token cost?"

Prefer concise examples over verbose explanations.

### Set Appropriate Degrees of Freedom

Match the level of specificity to the task's fragility and variability:

**High freedom (text-based instructions)**: Use when multiple approaches are valid, decisions depend on context, or heuristics guide the approach.

**Medium freedom (pseudocode or scripts with parameters)**: Use when a preferred pattern exists, some variation is acceptable, or configuration affects behavior.

**Low freedom (specific scripts, few parameters)**: Use when operations are fragile and error-prone, consistency is critical, or a specific sequence must be followed.

Think of the agent as exploring a path: a narrow bridge with cliffs needs specific guardrails (low freedom), while an open field allows many routes (high freedom).

### Anatomy of a Skill

Every skill consists of a required SKILL.md file and optional bundled resources:

```text
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter metadata (required)
│   │   ├── name: (required)
│   │   ├── description: (required)
│   │   └── compatibility: (optional, rarely needed)
│   └── Markdown instructions (required)
└── Bundled Resources (optional)
    ├── scripts/          - Executable code (Python/Bash/etc.)
    ├── references/       - Documentation intended to be loaded into context as needed
    └── assets/           - Files used in output (templates, icons, fonts, etc.)
```

#### SKILL.md (required)

Every SKILL.md consists of:

- **Frontmatter** (YAML): Contains `name` and `description` fields (required), plus optional fields like `license`, `metadata`, and `compatibility`.
  Only `name` and `description` are read by the agent to determine when the skill triggers,
  so be clear and comprehensive about what the skill is and when it should be used.
  The `compatibility` field is for noting environment requirements
  (target product, system packages, etc.) but most skills don't need it.
- **Body** (Markdown): Instructions and guidance for using the skill. Only loaded AFTER the skill triggers (if at all).

#### Bundled Resources (optional)

##### Scripts (`scripts/`)

Executable code (Python/Bash/etc.) for tasks that require deterministic reliability or are repeatedly rewritten.

- **When to include**: When the same code is being rewritten repeatedly or deterministic reliability is needed
- **Example**: `scripts/rotate_pdf.py` for PDF rotation tasks
- **Benefits**: Token efficient, deterministic, may be executed without loading into context
- **Note**: Scripts may still need to be read by the agent for patching or environment-specific adjustments

##### References (`references/`)

Documentation and reference material intended to be loaded as needed into context to inform the agent's process and thinking.

- **When to include**: For documentation that the agent should reference while working
- **Examples**: `references/finance.md` for financial schemas, `references/mnda.md` for company NDA template
- **Use cases**: Database schemas, API documentation, domain knowledge, company policies, detailed workflow guides
- **Benefits**: Keeps SKILL.md lean, loaded only when the agent determines it's needed
- **Best practice**: If files are large (>10k words), include grep search patterns in SKILL.md
- **Avoid duplication**: Information should live in either SKILL.md or references files, not both

##### Assets (`assets/`)

Files not intended to be loaded into context, but rather used within the output the agent produces.

- **When to include**: When the skill needs files that will be used in the final output
- **Examples**: `assets/logo.png` for brand assets, `assets/slides.pptx` for PowerPoint templates
- **Use cases**: Templates, images, icons, boilerplate code, fonts, sample documents

#### What to Not Include in a Skill

A skill should only contain essential files that directly support its functionality. Do NOT create extraneous documentation or auxiliary files, including:

- README.md
- INSTALLATION_GUIDE.md
- QUICK_REFERENCE.md
- CHANGELOG.md

### Progressive Disclosure Design Principle

Skills use a three-level loading system to manage context efficiently:

1. **Metadata (name + description)** - Always in context (~100 words)
2. **SKILL.md body** - When skill triggers (<5k words)
3. **Bundled resources** - As needed by the agent
   (Unlimited because scripts can be executed without reading into context window)

Keep SKILL.md body to the essentials and under 500 lines to minimize context bloat.
Split content into separate files when approaching this limit.
When splitting out content, reference them from SKILL.md and describe clearly when to read them.

## Skill Creation Process

Skill creation involves these steps:

1. Understand the skill with concrete examples
2. Plan reusable skill contents (scripts, references, assets)
3. Initialize the skill (`npm run new -- <name>`)
4. Edit the skill (implement resources and write SKILL.md)
5. Validate (`npm run validate`)
6. Iterate based on real usage

Follow these steps in order, skipping only if there is a clear reason why they are not applicable.

### Step 1: Understanding the Skill with Concrete Examples

Skip this step only when the skill's usage patterns are already clearly understood.

To create an effective skill, clearly understand concrete examples of how the skill will be used.
This understanding can come from either direct user examples
or generated examples that are validated with user feedback.

Conclude this step when there is a clear sense of the functionality the skill should support.

### Step 2: Planning the Reusable Skill Contents

Analyze each example by:

1. Considering how to execute on the example from scratch
2. Identifying what scripts, references, and assets would be helpful when executing these workflows repeatedly

### Step 3: Initializing the Skill

When creating a new skill from scratch:

```bash
npm run new -- <skill-name>
```

The script creates the skill directory under `plugins/stuffbucket/skills/` with a SKILL.md template and example resource directories.

After initialization, customize or remove the generated SKILL.md and example files as needed.

### Step 4: Edit the Skill

When editing the skill, remember it is being created for another instance of the agent to use. Include information that would be beneficial and non-obvious to the agent.

#### Learn Proven Design Patterns

Consult these helpful guides based on your skill's needs:

- **Multi-step processes**: See references/workflows.md for sequential workflows and conditional logic
- **Specific output formats or quality standards**: See references/output-patterns.md for template and example patterns

#### Start with Reusable Skill Contents

Begin with the reusable resources identified in Step 2: `scripts/`, `references/`, and `assets/` files.

Added scripts must be tested by actually running them to ensure there are no bugs.

#### Update SKILL.md

**Writing Guidelines:** Always use imperative/infinitive form.

##### Frontmatter

Write the YAML frontmatter with `name` and `description`:

- `name`: The skill name
- `description`: This is the primary triggering mechanism.
  Include both what the Skill does and specific triggers/contexts for when to use it.
  Include all "when to use" information here - Not in the body.

Do not include any other fields in YAML frontmatter.

### Step 5: Validate and Package

#### Quick Validation

Validate all skills:

```bash
npm run validate
```

Or validate a single skill:

```bash
npm run validate:one -- <path/to/skill-folder>
```

#### Schema Validation

Validate marketplace.json and .mcp.json files against their JSON schemas:

```bash
scripts/validate_schemas.py
```

This auto-discovers both marketplace.json locations (`.github/plugin/` and `.claude-plugin/`) and all `.mcp.json` files under `plugins/`.

#### Package for Distribution

Package a skill into a distributable .skill file:

```bash
npm run package -- <path/to/skill-folder> [output-directory]
```

The packaging script validates the skill first, then creates a .skill file (zip format).

### Step 6: Submit

After packaging, submit the skill by opening a GitHub issue:

1. Run `npm run package -- <path/to/skill-folder>` to create the `.skill` file
2. Open a new issue using the **New skill** template at the repository
3. Fill in the skill name, description, and category
4. Attach the `.skill` file to the issue
5. A workflow will automatically validate the skill and open a PR

This is the recommended path for agents — no Git operations required.

### Step 7: Iterate

1. Use the skill on real tasks
2. Notice struggles or inefficiencies
3. Identify how SKILL.md or bundled resources should be updated
4. Implement changes and test again

## Repository Layout

This repository uses a dual-manifest structure for cross-platform compatibility:

```text
.github/plugin/marketplace.json    # GitHub Copilot plugin manifest
.claude-plugin/marketplace.json    # Claude Code plugin manifest
plugins/
└── stuffbucket/
    ├── .mcp.json                  # MCP server configuration
    └── skills/
        └── <skill-name>/
            └── SKILL.md           # (+ optional scripts/, references/, assets/)
```

Skills are auto-discovered — no manual registration in marketplace.json needed.
See `references/marketplace.schema.json` and `references/mcp.schema.json` for the JSON schemas plugin manifests must conform to.

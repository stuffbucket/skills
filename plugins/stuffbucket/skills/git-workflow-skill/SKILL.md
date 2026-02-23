---
name: git-workflow-skill
description: Git operations and workflows. Use when committing, branching, merging, rebasing, resolving conflicts, writing commit messages, creating PRs, or managing release workflows. Covers conventional commits, branch naming, interactive rebase, conflict resolution, and PR descriptions.
allowed-tools: read_file write_file list_directory
---

# Git Workflow

## Commit Messages

Use Conventional Commits format:

```text
<type>(<scope>): <subject>

[body]

[footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `perf`, `build`

Rules:

- Subject line: imperative mood, lowercase, no period, max 72 chars
- Scope: optional, name the module/area affected
- Body: wrap at 72 chars, explain *what* and *why* (not *how*)
- Footer: `BREAKING CHANGE:` or issue references (`Fixes #123`)

Examples:

```text
feat(skill-router): add fuzzy matching with Fuse.js

Replace hand-rolled token scoring with Fuse.js + Porter stemmer.
Adds ignoreLocation for position-independent matching.

Fixes #42
```

```text
fix(mcp): handle missing index.json gracefully

Return empty skill list instead of crashing when index.json
hasn't been built yet.
```

## Branch Naming

```text
<type>/<ticket-or-short-description>
```

| Type | Use |
| --- | --- |
| `feat/` | New features |
| `fix/` | Bug fixes |
| `chore/` | Maintenance, deps |
| `docs/` | Documentation only |
| `release/` | Release prep |

Examples: `feat/skill-router-fuzzy`, `fix/mcp-ping-handler`, `chore/bump-eslint-10`

## Workflows

### Feature Branch

```text
1. git checkout main && git pull
2. git checkout -b feat/<name>
3. Make changes, commit with conventional format
4. git push -u origin feat/<name>
5. Open PR → review → squash merge → delete branch
```

### Bug Fix (same branch model)

```text
1. git checkout main && git pull
2. git checkout -b fix/<name>
3. Write a failing test that reproduces the bug
4. Fix the bug, verify test passes
5. Commit: fix(<scope>): <description>
6. Push and open PR
```

### Rebase onto main

When a feature branch is behind main:

```text
1. git fetch origin
2. git rebase origin/main
3. Resolve conflicts file-by-file (see Conflict Resolution below)
4. git rebase --continue (after each conflict)
5. git push --force-with-lease
```

Never use `--force` — always `--force-with-lease` to avoid overwriting others' work.

### Interactive Rebase (cleanup before PR)

```text
1. git rebase -i HEAD~<n>    # n = number of commits to squash
2. Mark commits as:
   - pick   — keep as-is
   - squash — combine with previous
   - reword — change commit message
   - drop   — remove entirely
3. Save and edit combined commit message
4. git push --force-with-lease
```

## Conflict Resolution

1. Open the conflicted file
2. Identify the conflict markers: `<<<<<<<`, `=======`, `>>>>>>>`
3. Understand what each side changed and *why*
4. Choose the correct resolution:
   - **Take ours**: keep the current branch's version
   - **Take theirs**: keep the incoming branch's version
   - **Merge both**: combine changes manually (most common)
5. Remove all conflict markers
6. Test that the resolved file works correctly
7. `git add <file>` then continue the rebase/merge

## PR Descriptions

Use this structure:

```markdown
## What

One-sentence summary of the change.

## Why

Context: what problem does this solve? Link to issue if applicable.

## How

Brief description of the approach. Mention any non-obvious decisions.

## Testing

How was this tested? What commands to run?

## Checklist

- [ ] Tests pass
- [ ] Lint clean
- [ ] Docs updated (if applicable)
```

## Common Pitfalls

- **Don't commit to main directly** — always use feature branches
- **Don't `git add .` blindly** — review `git diff --staged` before committing
- **Don't rebase shared branches** — only rebase your own feature branches
- **Don't force-push without `--lease`** — `--force-with-lease` is always safer
- **Don't mix unrelated changes** — one logical change per commit

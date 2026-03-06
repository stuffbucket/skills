---
name: pages-commit-vite
description: Stages and commits the GitHub Pages configuration files to the local git repo. Commits .github/workflows/deploy.yml and vite.config.ts (patched with base path). Does NOT commit dist/ — it is gitignored and built fresh in CI. Guards against committing without the workflow file present. USE FOR: the commit step in the prepare→build→commit→push→publish pipeline.
---

# pages-commit-vite

Stage and commit the GitHub Pages configuration changes (workflow + vite config).

## When to Use

- After `pages-prepare-vite` has written `.github/workflows/deploy.yml` and patched `vite.config.ts`
- After `pages-build-vite` confirms the local build succeeds
- Before pushing to the remote

## Pipeline Position

```text
pages-prepare-vite  →  pages-build-vite  →  [pages-commit-vite]  →  pages-push-vite  →  pages-publish-vite
```

## What This Skill Does

1. Guards: verifies `.github/workflows/deploy.yml` exists (aborts if not)
2. Stages: `git add .github/workflows/deploy.yml vite.config.ts`
3. Checks if anything is actually new (skips if already committed)
4. Commits with message `ci: configure GitHub Pages with Vite build` (or custom message)

> `dist/` is gitignored and is **not** staged or committed. CI builds it.

## How to Use

```bash
# Default commit message
bash skills/pages-commit-vite/scripts/commit_pages.sh

# Custom message
bash skills/pages-commit-vite/scripts/commit_pages.sh "ci: add Pages deploy workflow"
```

## Files Committed

| File | Purpose |
| ------ | --------- |
| `.github/workflows/deploy.yml` | Actions workflow: build Vite + deploy to Pages |
| `vite.config.ts` | Patched with `base: '/<repo>/'` for correct asset paths |

## Guidelines

- Run from the project root
- Requires the prepare step to have run first
- The commit is local only — no push happens here
- If the working tree is clean (already committed), the script exits cleanly
- `dist/` must remain gitignored; never commit build output to the source branch

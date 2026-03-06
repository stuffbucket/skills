---
name: pages-push-vite
description: Pushes the current branch to the git remote, triggering the GitHub Actions workflow that builds and deploys the Vite project to GitHub Pages. Guards that the remote exists and the workflow file is committed before pushing. USE FOR: the push step in the Pages deployment pipeline after prepare → build → commit.
---

# pages-push-vite

Push the committed changes to the remote, triggering the GitHub Actions Pages deployment.

## When to Use

- After `pages-commit-vite` has committed the workflow and vite config
- Ready to trigger the CI deploy for the first time or after reconfiguration

## Pipeline Position

```text
pages-prepare-vite  →  pages-build-vite  →  pages-commit-vite  →  [pages-push-vite]  →  pages-publish-vite
```

## What This Skill Does

1. Resolves the remote name (default: `origin`) and current branch
2. Guards: verifies the remote is configured
3. Guards: verifies `.github/workflows/deploy.yml` is tracked by git (committed)
4. Runs `git push <remote> <branch>`

After push, GitHub Actions picks up the `push` event and starts the `Deploy to GitHub Pages` workflow.

## How to Use

```bash
# Push current branch to origin
bash skills/pages-push-vite/scripts/push_pages.sh

# Push to a different remote or branch
bash skills/pages-push-vite/scripts/push_pages.sh upstream
bash skills/pages-push-vite/scripts/push_pages.sh origin feature/my-branch
```

## Arguments

| Position | Default | Description |
| ---------- | --------- | ------------- |
| `$1` | `origin` | Remote name |
| `$2` | current branch | Branch to push |

## What Happens After Push

1. GitHub Actions triggers the `Deploy to GitHub Pages` workflow
2. The `build` job runs `npm ci` + `npm run build` → uploads `dist/` as a Pages artifact
3. The `deploy` job deploys the artifact to Pages
4. Use `pages-publish-vite` to monitor the run and get the live URL

## Guidelines

- Run from the project root
- Confirm `pages-commit-vite` has run and the commit exists locally before pushing
- For first-time push to a new remote, you may need to set upstream: `git push -u origin main`
  (edit the script or run manually if the guard fails)
- Force-push (`--force`) is intentionally not supported here

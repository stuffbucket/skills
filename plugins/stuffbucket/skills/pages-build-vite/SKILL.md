---
name: pages-build-vite
description: Locally builds the Vite project and verifies the dist/ output before committing. Auto-detects package manager (npm/pnpm/yarn). Checks that vite.config.ts has a base path set and that dist/index.html exists. This is the local verification step in the Pages pipeline — the same build runs automatically in CI via .github/workflows/deploy.yml. USE FOR: confirming the build succeeds before pushing; catching base-path or asset errors locally.
---

# pages-build-vite

Locally build the Vite project and verify the `dist/` output is ready for Pages deployment.

## When to Use

- After `pages-prepare-vite` has patched `vite.config.ts` and written the workflow
- Before committing — to confirm the build succeeds locally
- When troubleshooting Pages deployment failures (reproduce the CI build locally)

## Pipeline Position

```text
pages-prepare-vite  →  [pages-build-vite]  →  pages-commit-vite  →  pages-push-vite  →  pages-publish-vite
```

## What This Skill Does

1. Detects package manager from lockfile (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, else npm)
2. Checks that `vite.config.ts` has a `base` property set
3. Runs `npm run build` / `pnpm run build` / `yarn build`
4. Verifies `dist/` exists and contains `dist/index.html`

> `dist/` is gitignored — the workflow builds it fresh in CI. This step is local verification only.

## How to Use

```bash
bash skills/pages-build-vite/scripts/build_pages.sh
```

## Expected Output

```text
=== pages-build-vite ===
  Package manager: npm
  base: '/my-app/'

── Running build
... vite build output ...

── Verifying dist/
  ✓ dist/ exists
  ✓ 42 files
  ✓ dist/index.html present: yes

=== Build verified — ready for pages-commit-vite ===
```

## Common Issues

| Symptom | Fix |
| --------- | ----- |
| `No 'base' property found` | Run `pages-prepare-vite` first |
| `dist/index.html` missing | Check `build.outDir` in vite.config (should be `dist`) |
| Build crashes on type errors | Run `pages-prepare-vite` to ensure TypeScript is configured |
| Assets 404 on deployed site | Verify `base` matches the repo name exactly |

## Guidelines

- Run from the project root
- Does not commit or push anything
- Safe to run repeatedly — cleans and rebuilds `dist/` each time
- Fix any build errors before proceeding to `pages-commit-vite`

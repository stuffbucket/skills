---
name: pages
description: Root index for the pages-* family — a five-step pipeline that deploys a Vite project to GitHub Pages via GitHub Actions, including GitHub Enterprise (GHE) codespace-style subdomain discovery. Steps run in order — prepare → build → commit → push → publish. Use when the user asks to deploy a Vite app to GitHub Pages, set up the Pages workflow, switch Pages source to Actions, or troubleshoot a Pages deploy.
---

# Pages

Family that automates GitHub Pages deployment for Vite projects. The skills correspond to **sequential pipeline steps** — run them in this order on first deploy:

1. `pages-prepare-vite`
2. `pages-build-vite`
3. `pages-commit-vite`
4. `pages-push-vite`
5. `pages-publish-vite`

After the first run, individual steps can be re-run as needed (e.g. re-build + push without re-preparing).

## Routing table

| Step | Skill | What it does |
| --- | --- | --- |
| 1. Prepare | `pages-prepare-vite` | Patch `vite.config.ts` base path, generate `.github/workflows/deploy.yml`, optionally set Pages source to "GitHub Actions" via API. Handles GHE detection and curl-redirect URL discovery. |
| 2. Build | `pages-build-vite` | Local `vite build`, auto-detects npm/pnpm/yarn, verifies base path and `dist/index.html`. Same build CI will run. |
| 3. Commit | `pages-commit-vite` | Stage and commit `deploy.yml` + patched `vite.config.ts`. Refuses to commit without the workflow file. Never commits `dist/`. |
| 4. Push | `pages-push-vite` | Push current branch; triggers the workflow. Guards remote and committed workflow. |
| 5. Publish | `pages-publish-vite` | Poll the workflow run, fetch Pages info, follow redirects to discover the actual served URL (handles GHE codespace-style randomized subdomains). |

## Cross-family edges

- `figma-make-to-vite` — common predecessor: convert a Figma Make export into a Vite app, then deploy it through this pipeline.
- `design-frontend`, `design-polish`, `design-check` — typical predecessors that produce ship-worthy UI.
- `react-best-practices` — bundle / perf concerns surfaced during `pages-build-vite`.
- `git-workflow-skill` — the commit and push steps; use here when the user prefers a richer git workflow.
- `tauri` — explicitly NOT in this pipeline; Tauri ships installers, not static sites.

## Decision flow

1. First-time deploy (no `deploy.yml`, no base path) → start at `pages-prepare-vite`, run the full chain.
2. Re-deploy after content change → `pages-build-vite` → `pages-commit-vite` → `pages-push-vite` → `pages-publish-vite`.
3. Switching from branch-based Pages to Actions source → `pages-prepare-vite`.
4. Workflow ran but the URL doesn't work (GHE) → `pages-publish-vite` for redirect-following.
5. Local build error before push → `pages-build-vite` in isolation.

## When NOT to use this skill

- Non-Vite frameworks (Next.js export, Astro, SvelteKit static-adapter) — the patcher is Vite-specific.
- Hosting on Cloudflare Pages / Netlify / Vercel — these are GitHub Pages workflows.
- Tauri or other desktop bundles — see the `tauri` family.
- A project that already has a working `deploy.yml` and just needs a one-off deploy — `pages-push-vite` is enough.

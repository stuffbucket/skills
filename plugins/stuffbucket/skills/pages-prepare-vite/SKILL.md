---
name: pages-prepare-vite
description: Prepares a Vite project for GitHub Pages deployment via GitHub Actions. Patches vite.config.ts with the correct base path, generates .github/workflows/deploy.yml (build + deploy jobs), and optionally configures the Pages source to 'GitHub Actions' via the GitHub API. Handles GitHub Enterprise (GHE) detection and discovers actual Pages URLs via curl redirect resolution for codespace-style random subdomains. USE FOR: first-time Pages setup; switching from branch to Actions source; regenerating the deploy workflow.
---

# pages-prepare-vite

Prepare a Vite project for GitHub Pages deployment using GitHub Actions as the source.

## When to Use

- Setting up GitHub Pages for the first time on a Vite project
- Switching Pages source from "Deploy from a branch" to "GitHub Actions"
- `.github/workflows/deploy.yml` is missing or needs to be regenerated
- Starting the full pipeline: `prepare → build → commit → push → publish`

## What This Skill Does

| Step | Action |
| ------ | -------- |
| 1 | Parse git remote → derive `host`, `owner`, `repo` |
| 2 | Detect GitHub.com vs GHE (GitHub Enterprise Server/Cloud) |
| 3 | Patch `vite.config.ts` — insert `base: '/<repo>/'` (or `/` for user/org pages) |
| 4 | Write `.github/workflows/deploy.yml` — two-job workflow: build Vite → deploy Pages |
| 5 | Configure Pages source via GitHub API: `PUT /repos/{owner}/{repo}/pages` with `build_type: workflow` |
| 6 | Discover actual Pages URL via `curl -sIL` redirect following (GHE may serve Pages at a random subdomain) |

## How to Use

```bash
# Minimum — writes workflow + patches config, no API calls
python3 skills/pages-prepare-vite/scripts/prepare_pages.py

# With API token — also configures Pages source and discovers URL
GITHUB_TOKEN=ghp_xxx python3 skills/pages-prepare-vite/scripts/prepare_pages.py

# No remote yet? Provide repo explicitly
python3 skills/pages-prepare-vite/scripts/prepare_pages.py --repo owner/my-app

# Preview changes without writing anything
python3 skills/pages-prepare-vite/scripts/prepare_pages.py --dry-run

# Explicit token flag
python3 skills/pages-prepare-vite/scripts/prepare_pages.py --token ghp_xxx
```

## Script Arguments

| Arg | Default | Description |
| ----- | --------- | ------------- |
| `--token TOKEN` | `$GITHUB_TOKEN` | PAT with `repo` + Pages write scope |
| `--dry-run` | off | Preview changes without writing files |
| `--remote NAME` | `origin` | Git remote to parse |
| `--repo OWNER/REPO` | from remote | Override remote detection |
| `--base PATH` | auto-derived | Override Vite base path |

## Workflow Generated

Path: `.github/workflows/deploy.yml`

Copied from `assets/deploy.<pm>.yml` by `_load_asset_template()` in `prepare_pages.py`.

**Templating convention:** tokens in the form `{{TOKEN}}` are substituted with `str.replace`. This is intentional —
Jinja2/Mustache `{{ }}` and Python `string.Template` `$VAR` both conflict with GitHub Actions expression syntax (`${{ }}`).
No third-party templating engine is needed.

Currently substituted tokens:

| Token | Value |
| ------- | ------- |
| `{{BRANCH}}` | Current git branch (e.g. `main`) |

Templates:

| File | Package manager |
| ------ | ---------------- |
| [assets/deploy.npm.yml](assets/deploy.npm.yml) | npm (default) |
| [assets/deploy.pnpm.yml](assets/deploy.pnpm.yml) | pnpm |
| [assets/deploy.yarn.yml](assets/deploy.yarn.yml) | yarn |

All three templates are standalone valid YAML — inspect or edit them directly to customise the workflow without touching the script. Add new `{{TOKEN}}` substitutions to `_load_asset_template()` in `prepare_pages.py`.

## GitHub API: Setting Pages to Actions Source

```bash
# What the script does (equivalent curl)
curl -X PUT \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/{owner}/{repo}/pages \
  -d '{"build_type":"workflow"}'
```

For GHE, the API endpoint is `https://<ghe-host>/api/v3/repos/{owner}/{repo}/pages`.

## GHE Handling

- Detected when remote host ≠ `github.com`
- API base: `https://<ghe-host>/api/v3/`
- Canonical Pages URL: `https://pages.<ghe-host>/<owner>/<repo>/`
- After enabling, the script runs `curl -sIL --max-redirs 10` on the canonical URL to follow any redirects.
  GHE environments may serve Pages at a randomised subdomain — the script prints both the canonical and resolved URLs.

## Guidelines

- Run from the project root
- Requires Python 3.9+, `curl` in PATH
- `GITHUB_TOKEN` needs `repo` scope and Pages write permission
- The workflow file is safe to commit — it contains no secrets
- If Pages is already using Actions source, the API call is a no-op
- For repos named `<owner>.github.io`, `base` is set to `/` automatically
- `dist/` is gitignored; the workflow builds it in CI — do not commit `dist/`

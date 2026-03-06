---
name: pages-publish-vite
description: Monitors the GitHub Actions deployment workflow and reports the live GitHub Pages URL. Polls the workflow run status via the GitHub API, fetches Pages info, then follows curl redirects from the canonical Pages URL to discover the actual served URL. Handles GHE environments where Pages may redirect to a codespace-style randomised subdomain. USE FOR: the final step of the Pages deployment pipeline; confirming deployment succeeded; discovering the actual live URL on GHE.
---

# pages-publish-vite

Monitor the GitHub Actions deployment and discover the live GitHub Pages URL.

## When to Use

- After `pages-push-vite` has triggered the Actions workflow
- To confirm deployment succeeded and get the final live URL
- Last step of the pipeline

## Pipeline Position

```text
pages-prepare-vite  →  pages-build-vite  →  pages-commit-vite  →  pages-push-vite  →  [pages-publish-vite]
```

## What This Skill Does

1. **Polls** the `deploy.yml` workflow run via the Actions API until `completed` (or timeout)
2. **Fetches** Pages info: `GET /repos/{owner}/{repo}/pages` → `status`, `build_type`, `html_url`
3. **Discovers** the actual live URL:
   - Computes the canonical Pages URL from `host`/`owner`/`repo`
   - Runs `curl -sIL --max-redirs 10` to follow HTTP redirects to the final URL
   - On GHE, Pages may redirect to a codespace-style random subdomain — the script prints both

## How to Use

```bash
# Poll + report URL
GITHUB_TOKEN=ghp_xxx python3 skills/pages-publish-vite/scripts/publish_pages.py

# Longer timeout (default 300s)
python3 skills/pages-publish-vite/scripts/publish_pages.py --token $GITHUB_TOKEN --timeout 600

# Skip polling — just report the URL (useful when workflow already finished)
python3 skills/pages-publish-vite/scripts/publish_pages.py --token $GITHUB_TOKEN --no-poll

# No token — URL discovery only (no API polling)
python3 skills/pages-publish-vite/scripts/publish_pages.py
```

## Arguments

| Arg | Default | Description |
| ----- | --------- | ------------- |
| `--token TOKEN` | `$GITHUB_TOKEN` | GitHub PAT |
| `--remote NAME` | `origin` | Git remote to parse |
| `--repo OWNER/REPO` | from remote | Override remote detection |
| `--timeout N` | `300` | Seconds to wait for workflow |
| `--no-poll` | off | Skip polling; go straight to URL discovery |

## GHE URL Discovery

For GitHub Enterprise, the canonical URL `https://pages.<ghe-host>/<owner>/<repo>/` may redirect to a different host. The script uses:

```bash
curl -sIL --max-redirs 10 \
  -o /dev/null \
  -w '%{url_effective}' \
  https://pages.<ghe-host>/<owner>/<repo>/
```

The `%{url_effective}` format string returns the final URL after all redirects — this is the actual Pages URL to share.

## Example Output

```text
=== pages-publish-vite ===

  Host:  github.com
  Repo:  acme/my-app

── Monitoring workflow
  [10:32:01] in_progress  https://github.com/acme/my-app/actions/runs/12345678
  ✓ Workflow succeeded

── Pages API info
  Status:     built
  Build type: workflow
  API URL:    https://acme.github.io/my-app/

── Discovering live URL
  Pages URL: https://acme.github.io/my-app/

=== Deployment complete ===

  https://acme.github.io/my-app/
```

## Guidelines

- Run from the project root
- Requires Python 3.9+ and `curl` in PATH
- `GITHUB_TOKEN` needs `repo` scope (to read Actions runs and Pages info)
- Workflow polling interval is 10 seconds — adjust `--timeout` for slow CI runners
- If `--no-poll` and the workflow hasn't finished yet, the URL may not be live yet

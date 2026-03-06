#!/usr/bin/env python3
"""
prepare_pages.py — Prepare a Vite project for GitHub Pages (Actions-based deployment)

Steps:
  1. Parse git remote → derive host, owner, repo
  2. Detect GitHub.com vs GitHub Enterprise (GHE)
  3. Patch vite.config.ts to set base: '/<repo>/'
  4. Generate .github/workflows/deploy.yml (build + deploy via Actions)
  5. Configure Pages source via GitHub API (requires GITHUB_TOKEN)
  6. Discover the actual Pages URL (GHE may redirect to a codespace-style random URL)

Usage:
  python3 skills/pages-prepare-vite/scripts/prepare_pages.py
  python3 skills/pages-prepare-vite/scripts/prepare_pages.py --token $GITHUB_TOKEN
  python3 skills/pages-prepare-vite/scripts/prepare_pages.py --dry-run
  python3 skills/pages-prepare-vite/scripts/prepare_pages.py --repo owner/reponame
"""

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request


# ──────────────────────────────────────────────
# Git remote parsing
# ──────────────────────────────────────────────

def get_remote_url(remote="origin"):
    result = subprocess.run(
        ["git", "remote", "get-url", remote],
        capture_output=True, text=True,
    )
    return result.stdout.strip() if result.returncode == 0 else None


def parse_remote(url):
    """
    Return (host, owner, repo) from a git remote URL.
    Handles SSH (git@host:owner/repo.git) and HTTPS (https://host/owner/repo.git).
    """
    # SSH: git@host:owner/repo[.git]
    m = re.match(r"git@([^:]+):([^/]+)/(.+?)(?:\.git)?$", url)
    if m:
        return m.group(1), m.group(2), m.group(3)
    # HTTPS: https://host/owner/repo[.git]
    m = re.match(r"https?://(?:[^@]+@)?([^/]+)/([^/]+)/(.+?)(?:\.git)?$", url)
    if m:
        return m.group(1), m.group(2), m.group(3)
    return None, None, None


def get_current_branch():
    result = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        capture_output=True, text=True,
    )
    return result.stdout.strip() if result.returncode == 0 else "main"


# ──────────────────────────────────────────────
# GHE / host helpers
# ──────────────────────────────────────────────

def is_ghe(host):
    """True when host is NOT github.com (i.e., GitHub Enterprise Server or Cloud custom domain)."""
    return host not in ("github.com", "www.github.com")


def api_base_url(host):
    return f"https://{host}/api/v3" if is_ghe(host) else "https://api.github.com"


def canonical_pages_url(host, owner, repo):
    """Compute the expected (canonical) GitHub Pages URL before redirect resolution."""
    if is_ghe(host):
        # GHES: pages served at pages.<host>/<owner>/<repo>/
        return f"https://pages.{host}/{owner}/{repo}/"
    # github.com user/org pages repo
    if repo.lower() == f"{owner.lower()}.github.io":
        return f"https://{owner}.github.io/"
    return f"https://{owner}.github.io/{repo}/"


# ──────────────────────────────────────────────
# Package manager detection
# ──────────────────────────────────────────────

def detect_package_manager(root="."):
    if os.path.exists(os.path.join(root, "pnpm-lock.yaml")):
        return "pnpm"
    if os.path.exists(os.path.join(root, "yarn.lock")):
        return "yarn"
    return "npm"


# ──────────────────────────────────────────────
# vite.config.ts patching
# ──────────────────────────────────────────────

def patch_vite_config(config_path, base_path, dry_run=False):
    """Insert or update the `base` property in vite.config.ts / vite.config.js."""
    with open(config_path) as f:
        content = f.read()

    # Already set to the right value?
    already = re.search(r"^\s*base\s*:\s*['\"]" + re.escape(base_path) + r"['\"]", content, re.MULTILINE)
    if already:
        print(f"  vite.config: base already '{base_path}' — no change")
        return False

    # Update existing base property
    if re.search(r"^\s*base\s*:", content, re.MULTILINE):
        new_content = re.sub(
            r"(^\s*base\s*:\s*)['\"][^'\"]*['\"]",
            rf'\g<1>"{base_path}"',
            content,
            flags=re.MULTILINE,
        )
    else:
        # Insert as first property inside defineConfig({
        new_content = re.sub(
            r"(export default defineConfig\(\{)(\r?\n)",
            rf'\1\2  base: "{base_path}",\n',
            content,
        )

    if new_content == content:
        print(f"  vite.config: could not auto-patch — set base: '{base_path}' manually")
        return False

    if dry_run:
        print(f"  [dry-run] Would set base: '{base_path}' in {config_path}")
        return True

    with open(config_path, "w") as f:
        f.write(new_content)
    print(f"  ✓ {config_path}: base set to '{base_path}'")
    return True


# ──────────────────────────────────────────────
# Workflow template loading from assets/
# ──────────────────────────────────────────────

DEPLOY_TEMPLATES = {
    "npm":  "assets/deploy.npm.yml",
    "pnpm": "assets/deploy.pnpm.yml",
    "yarn": "assets/deploy.yarn.yml",
}


def _skill_root():
    """Directory containing this script's parent skill (one level above scripts/)."""
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _load_asset_template(pm, branch):
    """
    Read the deploy YAML template for the given package manager from assets/.
    Substitutes {{BRANCH}} and returns the final content.
    """
    rel = DEPLOY_TEMPLATES.get(pm, DEPLOY_TEMPLATES["npm"])
    template_path = os.path.join(_skill_root(), rel)
    if not os.path.exists(template_path):
        raise FileNotFoundError(
            f"Deploy template not found: {template_path}\n"
            f"Expected asset: skills/pages-prepare-vite/{rel}"
        )
    with open(template_path) as f:
        content = f.read()
    return content.replace("{{BRANCH}}", branch)


def write_workflow(workflow_path, pm, branch, dry_run=False):
    try:
        content = _load_asset_template(pm, branch)
    except FileNotFoundError as e:
        print(f"  ✗ {e}")
        return False
    if dry_run:
        print(f"  [dry-run] Would write {workflow_path}  (template: deploy.{pm}.yml, branch={branch})")
        return True
    os.makedirs(os.path.dirname(workflow_path), exist_ok=True)
    with open(workflow_path, "w") as f:
        f.write(content)
    print(f"  ✓ {workflow_path}  (template: deploy.{pm}.yml, branch={branch})")
    return True


# ──────────────────────────────────────────────
# GitHub API helpers
# ──────────────────────────────────────────────

def _api_request(method, url, token, data=None):
    """Make a GitHub REST API call. Returns (status_code, response_body_dict)."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
    }
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read()
        return e.code, json.loads(raw) if raw else {}


def enable_pages_actions(api_url, owner, repo, token, dry_run=False):
    """
    Set GitHub Pages source to 'GitHub Actions' (build_type: workflow).
    Steps:
      - GET /pages  → check current state
      - If 404      → POST /pages to create with build_type: workflow
      - If exists   → PUT  /pages to update build_type to workflow
    """
    url = f"{api_url}/repos/{owner}/{repo}/pages"
    if dry_run:
        print(f"  [dry-run] Would configure {url} → build_type: workflow")
        return True

    status, body = _api_request("GET", url, token)

    if status == 404:
        # Pages not yet enabled — create it
        status2, body2 = _api_request("POST", url, token, {"build_type": "workflow"})
        if status2 in (200, 201):
            print("  ✓ GitHub Pages created  (source: GitHub Actions)")
            return True
        print(f"  ✗ POST /pages → HTTP {status2}: {body2.get('message', body2)}")
        return False

    if status == 200:
        if body.get("build_type") == "workflow":
            print("  ✓ GitHub Pages already set to Actions source — no change")
            return True
        status2, body2 = _api_request("PUT", url, token, {"build_type": "workflow"})
        if status2 in (200, 204):
            print("  ✓ GitHub Pages source updated → GitHub Actions")
            return True
        print(f"  ✗ PUT /pages → HTTP {status2}: {body2.get('message', body2)}")
        return False

    print(f"  ✗ GET /pages → HTTP {status}: {body.get('message', body)}")
    return False


# ──────────────────────────────────────────────
# URL discovery (GHE redirect resolution)
# ──────────────────────────────────────────────

def discover_pages_url(expected_url):
    """
    Follow HTTP redirects from expected_url to find the real served URL.
    On GHE environments, Pages may redirect to a codespace-style randomised subdomain.
    Uses: curl -sIL --max-redirs 10 -o /dev/null -w '%{url_effective}'
    """
    try:
        result = subprocess.run(
            [
                "curl", "-sIL", "--max-redirs", "10",
                "-o", "/dev/null",
                "-w", "%{url_effective}",
                expected_url,
            ],
            capture_output=True, text=True, timeout=15,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    return expected_url


# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Prepare a Vite project for GitHub Pages deployment (Actions source)"
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("GITHUB_TOKEN"),
        help="GitHub PAT with repo+pages scope (or set GITHUB_TOKEN env var)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing files")
    parser.add_argument("--remote", default="origin", help="Git remote name (default: origin)")
    parser.add_argument(
        "--repo",
        default=None,
        help="Override owner/repo e.g. 'acme/my-app' (skips remote detection)",
    )
    parser.add_argument("--base", default=None, help="Override Vite base path (e.g. /my-app/)")
    args = parser.parse_args()

    print("=== pages-prepare-vite ===\n")

    # ─── Resolve owner / repo / host ───────────────────────────────────────
    if args.repo:
        parts = args.repo.split("/", 1)
        if len(parts) != 2:
            print("\u2717 --repo must be in 'owner/repo' format")
            sys.exit(1)
        owner, repo = parts
        host = "github.com"
        ghe = False
        placeholder = False
        print(f"  Repo:    {owner}/{repo}  (from --repo flag)")
    else:
        placeholder = False
        remote_url = get_remote_url(args.remote)
        if not remote_url:
            print(f"  ⚠  No git remote '{args.remote}' found.")
            print("     Add one first:  git remote add origin https://github.com/<owner>/<repo>.git")
            print("     Or use:         --repo owner/reponame")
            print("     Writing workflow with placeholder base '/REPO/' — re-run after adding remote.")
            print()
            # Still write the workflow with a placeholder base
            host, owner, repo = "github.com", "OWNER", "REPO"
            ghe = False
            placeholder = True
        else:
            host, owner, repo = parse_remote(remote_url)
            if not host:
                print(f"✗ Could not parse remote URL: {remote_url}")
                sys.exit(1)
            ghe = is_ghe(host)
            print(f"  Remote:  {remote_url}")
            print(f"  Host:    {host}  ({'GitHub Enterprise' if ghe else 'github.com'})")
            print(f"  Owner:   {owner}")
            print(f"  Repo:    {repo}")

    # ─── Derive Vite base path ───────────────────────────────────────────────
    if args.base:
        base_path = args.base
    elif repo.lower() in (f"{owner.lower()}.github.io", f"{owner.lower()}.github.com"):
        base_path = "/"   # user/org pages site — no sub-path
    else:
        base_path = f"/{repo}/"

    # ─── Detect package manager + branch ────────────────────────────────────
    pm = detect_package_manager()
    branch = get_current_branch()
    print(f"  Base:    {base_path}")
    print(f"  PM:      {pm}")
    print(f"  Branch:  {branch}")
    print()

    # ─── Step 1: Patch vite.config.ts ───────────────────────────────────────
    print("── Patching vite config")
    config_path = next(
        (p for p in ["vite.config.ts", "vite.config.js"] if os.path.exists(p)), None
    )
    if config_path:
        patch_vite_config(config_path, base_path, dry_run=args.dry_run)
    else:
        print("  ✗ No vite.config.ts/js found — skipping")
    print()

    # ─── Step 2: Write deploy workflow ──────────────────────────────────────
    print("── Writing GitHub Actions workflow")
    write_workflow(".github/workflows/deploy.yml", pm, branch, dry_run=args.dry_run)
    print()

    # ─── Step 3: Configure Pages via API (optional) ─────────────────────────
    api_ok = None
    if args.token and owner != "OWNER":
        api_url = api_base_url(host)
        print(f"── Configuring Pages via API  ({api_url})")
        api_ok = enable_pages_actions(api_url, owner, repo, args.token, dry_run=args.dry_run)
        print()

        # ─── Step 4: Discover actual Pages URL (GHE redirect resolution) ────
        print("── Discovering Pages URL")
        expected = canonical_pages_url(host, owner, repo)
        actual = discover_pages_url(expected)
        if ghe and actual != expected:
            print(f"  GHE canonical URL: {expected}")
            print(f"  Actual URL (via redirect): {actual}")
            print("  ℹ  Update the `environment.url` in deploy.yml if needed.")
        else:
            print(f"  Pages URL: {actual}")
        print()
    else:
        if not args.token:
            print("── Skipping API configuration  (no GITHUB_TOKEN)")
            print("   Set Pages source manually: repo Settings → Pages → Source → GitHub Actions")
            print()

    # ─── Summary ────────────────────────────────────────────────────────────
    warnings = []
    if placeholder:
        warnings.append("base is '/REPO/' placeholder — re-run with --repo owner/reponame after adding remote")
    if not config_path:
        warnings.append("No vite.config.ts/js found — add base path manually before building")
    if api_ok is False:
        warnings.append("Pages API configuration failed — set source manually in repo Settings → Pages")

    print("=== Prepare complete ===")
    print()
    if config_path:
        print(f"  Modified: {config_path}  (base: '{base_path}')")
    print("  Written:  .github/workflows/deploy.yml")
    if warnings:
        print()
        print("  ⚠  Warnings:")
        for w in warnings:
            print(f"     • {w}")
    print()
    build_cmd = {"pnpm": "pnpm run build", "yarn": "yarn build"}.get(pm, "npm run build")
    print("Next steps:")
    print(f"  1. pages-build-vite   →  bash skills/pages-build-vite/scripts/build_pages.sh")
    print(f"  2. pages-commit-vite  →  bash skills/pages-commit-vite/scripts/commit_pages.sh")
    print(f"  3. pages-push-vite    →  bash skills/pages-push-vite/scripts/push_pages.sh")
    print(f"  4. pages-publish-vite →  python3 skills/pages-publish-vite/scripts/publish_pages.py")
    if placeholder:
        print()
        print("  \u26a0  Update base before step 2:")
        print("     python3 skills/pages-prepare-vite/scripts/prepare_pages.py --repo owner/reponame")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
publish_pages.py — Monitor GitHub Pages deployment and report the live URL

After `git push` triggers the Actions workflow, this script:
  1. Polls the GitHub API for the latest deploy.yml workflow run status
  2. Fetches the GitHub Pages info (URL, status) from the API
  3. Follows curl redirects from the canonical Pages URL to discover
     the actual served URL (GHE may redirect to a codespace-style random subdomain)

Usage:
  python3 skills/pages-publish-vite/scripts/publish_pages.py --token $GITHUB_TOKEN
  python3 skills/pages-publish-vite/scripts/publish_pages.py --token $GITHUB_TOKEN --timeout 300
  python3 skills/pages-publish-vite/scripts/publish_pages.py --token $GITHUB_TOKEN --no-poll
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request


# ──────────────────────────────────────────────
# Remote parsing (shared with prepare_pages.py)
# ──────────────────────────────────────────────

def get_remote_url(remote="origin"):
    result = subprocess.run(
        ["git", "remote", "get-url", remote], capture_output=True, text=True
    )
    return result.stdout.strip() if result.returncode == 0 else None


def parse_remote(url):
    m = re.match(r"git@([^:]+):([^/]+)/(.+?)(?:\.git)?$", url)
    if m:
        return m.group(1), m.group(2), m.group(3)
    m = re.match(r"https?://(?:[^@]+@)?([^/]+)/([^/]+)/(.+?)(?:\.git)?$", url)
    if m:
        return m.group(1), m.group(2), m.group(3)
    return None, None, None


def is_ghe(host):
    return host not in ("github.com", "www.github.com")


def api_base_url(host):
    return f"https://{host}/api/v3" if is_ghe(host) else "https://api.github.com"


def canonical_pages_url(host, owner, repo):
    if is_ghe(host):
        return f"https://pages.{host}/{owner}/{repo}/"
    if repo.lower() == f"{owner.lower()}.github.io":
        return f"https://{owner}.github.io/"
    return f"https://{owner}.github.io/{repo}/"


# ──────────────────────────────────────────────
# GitHub API helpers
# ──────────────────────────────────────────────

def _api_get(url, token):
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, {}


def get_latest_workflow_run(api_url, owner, repo, token, workflow="deploy.yml"):
    """Return the most recent run of the deploy workflow, or None."""
    url = f"{api_url}/repos/{owner}/{repo}/actions/workflows/{workflow}/runs?per_page=1"
    status, body = _api_get(url, token)
    if status == 200 and body.get("workflow_runs"):
        return body["workflow_runs"][0]
    return None


def get_pages_info(api_url, owner, repo, token):
    """Return the Pages API response dict, or None if Pages is not enabled."""
    status, body = _api_get(f"{api_url}/repos/{owner}/{repo}/pages", token)
    return body if status == 200 else None


# ──────────────────────────────────────────────
# Deployment polling
# ──────────────────────────────────────────────

def poll_deployment(api_url, owner, repo, token, timeout=300):
    """
    Poll the latest deploy.yml workflow run until it completes.
    Returns True on success, False on failure or timeout.
    """
    print(f"  Polling workflow (timeout: {timeout}s, interval: 10s)")
    deadline = time.time() + timeout
    last_status = None
    start = time.time()

    while time.time() < deadline:
        run = get_latest_workflow_run(api_url, owner, repo, token)
        if run:
            status = run.get("status", "unknown")
            conclusion = run.get("conclusion")
            run_url = run.get("html_url", "")
            elapsed = int(time.time() - start)
            remaining = int(deadline - time.time())
            if status != last_status:
                ts = time.strftime("%H:%M:%S")
                print(f"  [{ts}] {status}  (elapsed {elapsed}s, timeout in {remaining}s)")
                print(f"         {run_url}")
                last_status = status
            if status == "completed":
                if conclusion == "success":
                    print(f"  ✓ Workflow succeeded  ({elapsed}s)")
                    return True
                else:
                    print(f"  ✗ Workflow {conclusion}")
                    print(f"  Check the Actions tab: {run_url}")
                    print()
                    print("  Common causes:")
                    print("    • Pages source not set to 'GitHub Actions' — run prepare with --token")
                    print("    • Repo Actions or Pages is disabled (Settings → Pages)")
                    print("    • vite build failed in CI — check the 'build' job logs")
                    print("    • Missing permissions: workflow needs 'pages: write, id-token: write'")
                    return False
        time.sleep(10)

    print(f"  ✗ Timed out after {timeout}s")
    print("  Check the Actions tab manually or re-run with --timeout 600")
    return False


# ──────────────────────────────────────────────
# URL discovery (GHE redirect resolution)
# ──────────────────────────────────────────────

def discover_actual_url(expected_url):
    """
    Follow HTTP redirects from expected_url to the final served URL.
    GHE environments may redirect Pages to a codespace-style randomised subdomain.

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
    except subprocess.TimeoutExpired:
        print("  ⚠  curl timed out following redirects")
    except FileNotFoundError:
        print("  ⚠  curl not found in PATH — cannot follow redirects")
    return expected_url


def check_url_live(url, retries=3, delay=5):
    """
    Return (http_status, ok) after attempting an HTTP GET on the URL.
    Retries to allow for Pages CDN propagation delay.
    """
    import http.client
    import urllib.parse
    parsed = urllib.parse.urlparse(url)
    host = parsed.netloc
    path = parsed.path or "/"
    for attempt in range(1, retries + 1):
        try:
            conn = http.client.HTTPSConnection(host, timeout=10)
            conn.request("HEAD", path)
            resp = conn.getresponse()
            conn.close()
            if resp.status < 400:
                return resp.status, True
            if attempt < retries:
                time.sleep(delay)
        except Exception:
            if attempt < retries:
                time.sleep(delay)
    return 0, False


# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Monitor GitHub Pages deployment and report the live URL"
    )
    parser.add_argument(
        "--token", default=os.environ.get("GITHUB_TOKEN"),
        help="GitHub PAT (or set GITHUB_TOKEN env var)"
    )
    parser.add_argument("--remote", default="origin")
    parser.add_argument(
        "--repo", default=None,
        help="Override owner/repo e.g. 'acme/my-app'"
    )
    parser.add_argument(
        "--timeout", type=int, default=300,
        help="Seconds to wait for workflow to complete (default: 300)"
    )
    parser.add_argument(
        "--no-poll", action="store_true",
        help="Skip workflow polling; just discover and report the URL"
    )
    args = parser.parse_args()

    print("=== pages-publish-vite ===\n")

    # ─── Resolve repo info ─────────────────────────────────────────────────
    if args.repo:
        owner, repo = args.repo.split("/", 1)
        host = "github.com"
    else:
        remote_url = get_remote_url(args.remote)
        if not remote_url:
            print(f"✗ No git remote '{args.remote}' found.")
            sys.exit(1)
        host, owner, repo = parse_remote(remote_url)
        if not host:
            print(f"✗ Could not parse remote URL: {remote_url}")
            sys.exit(1)

    ghe = is_ghe(host)
    api_url = api_base_url(host)

    print(f"  Host:  {host}  ({'GHE' if ghe else 'github.com'})")
    print(f"  Repo:  {owner}/{repo}")
    print()

    # ─── Without token: URL-only mode ──────────────────────────────────────
    if not args.token:
        print("── No token — URL discovery only  (set GITHUB_TOKEN to enable polling)\n")
        expected = canonical_pages_url(host, owner, repo)
        print(f"  Canonical URL: {expected}")
        if ghe:
            actual = discover_actual_url(expected)
            if actual != expected:
                print(f"  Actual URL:    {actual}")
        sys.exit(0)

    # ─── Poll workflow run ──────────────────────────────────────────────────
    if not args.no_poll:
        print("── Monitoring workflow")
        success = poll_deployment(api_url, owner, repo, args.token, timeout=args.timeout)
        print()
        if not success:
            sys.exit(1)

    # ─── Fetch Pages API info ───────────────────────────────────────────────
    print("── Pages API info")
    pages = get_pages_info(api_url, owner, repo, args.token)
    if pages:
        print(f"  Status:     {pages.get('status', 'unknown')}")
        print(f"  Build type: {pages.get('build_type', 'unknown')}")
        api_url_val = pages.get("html_url", "")
        if api_url_val:
            print(f"  API URL:    {api_url_val}")
    else:
        print("  ⚠  Could not retrieve Pages info (not enabled or insufficient permissions)")
    print()

    # ─── Discover actual URL via redirect ──────────────────────────────────
    print("── Discovering live URL")
    expected = canonical_pages_url(host, owner, repo)
    actual = discover_actual_url(expected)

    if ghe and actual != expected:
        print(f"  GHE canonical:           {expected}")
        print(f"  GHE actual (redirected): {actual}")
    else:
        print(f"  Pages URL: {actual}")
    # ─── Liveness check ─────────────────────────────────────────────────────
    print()
    print("── Checking site is live  (up to 3 attempts, 5s apart)")
    http_status, is_live = check_url_live(actual)
    if is_live:
        print(f"  ✓ Site is live  HTTP {http_status}")
    else:
        if http_status:
            print(f"  ⚠  Site returned HTTP {http_status} — may still be propagating")
        else:
            print("  ⚠  Site did not respond — Pages CDN may still be propagating (wait 30–90s and retry)")
        print("     Re-run with --no-poll to skip workflow check and just probe the URL")
    print()
    print("=== Deployment complete ===")
    print()
    print(f"  {actual}")


if __name__ == "__main__":
    main()

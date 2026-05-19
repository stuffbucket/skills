// Lazy version freshness checker for @stuffbucket/skills.
// Homebrew-style: compares local package.json version against the latest
// git tag on the remote. Checks at most once per hour (non-blocking).
// No dependencies beyond Node built-ins.

const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const REQUEST_TIMEOUT_MS = 5000; // git ls-remote timeout

// State
let lastChecked = 0;
let latestVersion = null;
let localVersion = null;
let checking = false;

function getLocalVersion() {
  if (localVersion) return localVersion;
  try {
    const pkgPath = path.join(__dirname, "..", "..", "..", "..", "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    localVersion = pkg.version;
  } catch {
    localVersion = null;
  }
  return localVersion;
}

// Resolve the git directory for this package installation.
function getRepoDir() {
  try {
    return path.join(__dirname, "..", "..", "..", "..", "..");
  } catch {
    return null;
  }
}

// Fetch latest version tag from the git remote — like `brew update`.
// Runs `git ls-remote --tags origin` and picks the highest vX.Y.Z tag.
function fetchLatestVersion() {
  if (checking) return;
  checking = true;

  const repoDir = getRepoDir();
  if (!repoDir) {
    checking = false;
    return;
  }

  const child = execFile(
    "git",
    ["ls-remote", "--tags", "--refs", "origin"],
    { cwd: repoDir, timeout: REQUEST_TIMEOUT_MS },
    (err, stdout) => {
      checking = false;
      if (err) return;

      // Parse tags like "refs/tags/v0.2.8" → "0.2.8"
      const versions = [];
      for (const line of stdout.split("\n")) {
        const match = line.match(/refs\/tags\/v(\d+\.\d+\.\d+)$/);
        if (match) versions.push(match[1]);
      }

      if (versions.length === 0) return;

      // Sort descending, pick highest
      versions.sort((a, b) => {
        const pa = a.split(".").map(Number);
        const pb = b.split(".").map(Number);
        for (let i = 0; i < 3; i++) {
          if (pa[i] !== pb[i]) return pb[i] - pa[i];
        }
        return 0;
      });

      latestVersion = versions[0];
      lastChecked = Date.now();
    },
  );

  // Safety: ensure checking resets if the process is killed
  child.on("error", () => { checking = false; });
}

// Compare semver strings: returns true if a > b
function isNewer(a, b) {
  if (!a || !b) return false;
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

// Called on each tool invocation. Fires a non-blocking check if needed.
// Returns update info synchronously from cache (may be null on first call).
function checkFreshness() {
  const now = Date.now();
  if (now - lastChecked > CHECK_INTERVAL_MS) {
    fetchLatestVersion();
  }

  const local = getLocalVersion();
  if (latestVersion && local && isNewer(latestVersion, local)) {
    return { localVersion: local, latestVersion };
  }
  return null;
}

// Dynamic update instructions returned by get_skill("update-skills").
function getUpdateInstructions(updateInfo) {
  if (!updateInfo) return null;
  const { localVersion: lv, latestVersion: rv } = updateInfo;
  return [
    `# Update @stuffbucket/skills`,
    ``,
    `Installed: v${lv} — Latest: v${rv}`,
    ``,
    `## How to Update`,
    ``,
    `Pull the latest from the remote and check out the new tag:`,
    ``,
    "```bash",
    `git -C <install-path> fetch --tags origin`,
    `git -C <install-path> checkout v${rv}`,
    "```",
    ``,
    `Or if installed as a Claude Code plugin, the marketplace handles updates automatically.`,
    `To force: remove and re-add the plugin.`,
    ``,
    `## What's New`,
    ``,
    `Check the changelog: https://github.com/stuffbucket/skills/releases`,
  ].join("\n");
}

module.exports = { checkFreshness, getUpdateInstructions, isNewer, getLocalVersion };

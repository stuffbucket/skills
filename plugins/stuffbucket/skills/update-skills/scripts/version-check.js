#!/usr/bin/env node

// Check for newer versions using git ls-remote --tags (no registry needed).
// Returns { current, latest, updateAvailable } or null on failure.

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const PACKAGE_ROOT = path.join(__dirname, "..", "..", "..", "..", "..");
const PKG_PATH = path.join(PACKAGE_ROOT, "package.json");
const PKG = fs.existsSync(PKG_PATH) ? JSON.parse(fs.readFileSync(PKG_PATH, "utf8")) : null;
const REPO_URL = PKG ? PKG.repository.url.replace(/^git\+/, "") : "https://github.com/stuffbucket/skills.git";
const CACHE_FILE = path.join(__dirname, "..", ".version-cache.json");
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function getCurrentVersion() {
  return PKG ? PKG.version : null;
}

function parseVersion(tag) {
  const m = tag.match(/^v?(\d+\.\d+\.\d+)$/);
  return m ? m[1] : null;
}

function compareSemver(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

function readCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    if (Date.now() - data.ts < CACHE_TTL_MS) return data.latest;
    return null;
  } catch {
    return null;
  }
}

function writeCache(latest) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ ts: Date.now(), latest }));
  } catch {
    // non-critical
  }
}

function fetchLatestTag() {
  const cached = readCache();
  if (cached) return cached;

  try {
    const output = execSync(`git ls-remote --tags ${REPO_URL}`, {
      encoding: "utf8",
      timeout: 10000,
      stdio: ["ignore", "pipe", "ignore"],
    });

    let latest = null;
    for (const line of output.split("\n")) {
      const ref = line.split("\t")[1];
      if (!ref) continue;
      const tag = ref.replace("refs/tags/", "").replace("^{}", "");
      const ver = parseVersion(tag);
      if (ver && (!latest || compareSemver(ver, latest) > 0)) {
        latest = ver;
      }
    }

    if (latest) writeCache(latest);
    return latest;
  } catch {
    return null;
  }
}

function checkForUpdate() {
  const current = getCurrentVersion();
  if (!current) return null;

  const latest = fetchLatestTag();
  if (!latest) return null;

  return {
    current,
    latest,
    updateAvailable: compareSemver(latest, current) > 0,
  };
}

module.exports = { checkForUpdate };

// CLI: node scripts/version-check.js
if (require.main === module) {
  const result = checkForUpdate();
  if (!result) {
    console.log("Could not determine version info.");
    process.exit(1);
  }
  if (result.updateAvailable) {
    console.log(`Update available: ${result.current} → ${result.latest}`);
    console.log(`  npx -y github:stuffbucket/skills --update`);
  } else {
    console.log(`Up to date: ${result.current}`);
  }
}

// Lazy, never-throws version freshness checker for @stuffbucket/skills.
//
// Source of truth is the npm registry dist-tags document, fetched over plain
// HTTPS — NOT `git ls-remote` and NOT the GitHub API. The primary distribution
// is the npm package launched via `npx -p @stuffbucket/skills`, which has no
// `.git`/`origin` remote, so a git-based check gave npx users no signal at all.
// The registry's `latest` dist-tag is the true "latest" for that channel and
// works for every install type (npm, npx, git, plugin) with zero extra infra.
//
// Modeled on stuffbucket/maximal's notify-only update detector:
//   - total / never-throws: offline, non-200, timeout, and malformed all resolve
//     to a coherent status object with a diagnostic `last_error`, preserving the
//     last-known `latest`. Offline is a clean idle state, not an error.
//   - in-process TTL cache, fetch timeout, user-agent header, no auth token.
//   - hand-rolled semver-precedence compare, zero dependencies (Node built-ins).
//
// Notify-only by design: this module never installs anything. It surfaces that
// an update exists and routes the user to the `update-skills` skill, which owns
// the apply step.

const https = require("https");
const path = require("path");
const fs = require("fs");

// npm dist-tags endpoint for the scoped package (scope slash is %2F-encoded).
// Returns a tiny document like {"latest":"0.2.18"} — smaller than the packument.
const DIST_TAGS_URL =
  "https://registry.npmjs.org/-/package/@stuffbucket%2Fskills/dist-tags";
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h TTL (matches maximal)
const REQUEST_TIMEOUT_MS = 15 * 1000; // 15s fetch timeout (matches maximal)
const MAX_RESPONSE_BYTES = 1024 * 1024; // hard cap on an unexpected large body
const USER_AGENT = "stuffbucket-skills-update-check";

// --- In-process state (preserves last-known result across calls) ---
let lastChecked = 0; // epoch ms of the last completed check (success or failure)
let latest = null; // last-known latest version string from the registry
let lastError = null; // diagnostic string when the last check failed
let localVersion; // undefined = not yet read; null = unresolved
let inflight = null; // de-dupes concurrent fetches

// Read the real installed version from the package.json, never a git tag.
function getLocalVersion() {
  if (localVersion !== undefined) return localVersion;
  try {
    const pkgPath = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "..",
      "package.json",
    );
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    localVersion = pkg.version || null;
  } catch {
    localVersion = null;
  }
  return localVersion;
}

// Parse "1.2.3" / "v1.2.3" (ignoring any pre-release/build suffix) → [1,2,3].
function parseSemver(v) {
  if (typeof v !== "string") return null;
  const m = v.trim().replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

// true if a is a strictly newer semver than b. Unparseable → false (never throws).
function isNewer(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return false;
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return true;
    if (pa[i] < pb[i]) return false;
  }
  return false;
}

// Fetch the registry `latest` dist-tag. Returns a Promise that always resolves
// (never rejects); it updates module state and records a diagnostic on failure.
function fetchLatest() {
  if (inflight) return inflight;

  inflight = new Promise((resolve) => {
    let settled = false;
    const done = (err, value) => {
      if (settled) return;
      settled = true;
      lastChecked = Date.now();
      if (err) {
        lastError = err; // keep the previous `latest` as last-known
      } else {
        latest = value;
        lastError = null;
      }
      inflight = null;
      resolve();
    };

    let req;
    try {
      req = https.get(
        DIST_TAGS_URL,
        { headers: { "user-agent": USER_AGENT, accept: "application/json" } },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            return done(`registry responded ${res.statusCode}`);
          }
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            body += chunk;
            if (body.length > MAX_RESPONSE_BYTES) {
              req.destroy();
              done("registry response too large");
            }
          });
          res.on("end", () => {
            try {
              const tag = JSON.parse(body).latest;
              if (parseSemver(tag)) done(null, tag);
              else done("registry returned no valid latest dist-tag");
            } catch {
              done("malformed registry response");
            }
          });
        },
      );
    } catch (err) {
      return done((err && err.message) || "request failed");
    }

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy();
      done("registry request timed out");
    });
    req.on("error", (err) => done((err && err.message) || "request failed"));
    // Don't let a background check keep the process (or event loop) alive.
    if (typeof req.unref === "function") req.unref();
  });

  return inflight;
}

// Build the current best-known status from module state. Total shape:
//   { current, latest, update_available, checked_at, last_error, enabled }
function buildStatus() {
  const current = getLocalVersion();
  return {
    current: current || null,
    latest: latest || null,
    update_available: Boolean(current && latest && isNewer(latest, current)),
    checked_at: lastChecked || null,
    last_error: lastError || null,
    enabled: true,
  };
}

// Synchronous, non-blocking. Fires a throttled background refresh (at most once
// per TTL) and returns the current best-known status immediately. Safe to call
// on every tool invocation — the first call returns idle until a fetch lands.
function getUpdateStatus() {
  if (Date.now() - lastChecked > CHECK_INTERVAL_MS) {
    // Fire-and-forget; never throws.
    fetchLatest();
  }
  return buildStatus();
}

// Await a fresh check, then return the status. For one-shot callers (the CLI)
// that need a result now rather than a cached/idle one. Never rejects.
async function getUpdateStatusNow() {
  await fetchLatest();
  return buildStatus();
}

// Back-compat shim for mcp-server.js: returns { localVersion, latestVersion }
// when an update is available, else null. Non-blocking (cache-backed).
function checkFreshness() {
  const status = getUpdateStatus();
  if (status.update_available) {
    return { localVersion: status.current, latestVersion: status.latest };
  }
  return null;
}

// Notify-only guidance returned by get_skill("update-skills"). Does not perform
// the upgrade — it points the user at the `update-skills` skill, which owns the
// apply step (per install type). Kept distribution-agnostic: no bare `git`
// commands that break on npm/npx installs.
function getUpdateInstructions(updateInfo) {
  if (!updateInfo) return null;
  const { localVersion: lv, latestVersion: rv } = updateInfo;
  return [
    `# Update @stuffbucket/skills`,
    ``,
    `Installed: v${lv} — Latest: v${rv}`,
    ``,
    `A newer version is available on npm. To apply it, run the **update-skills**`,
    `skill, which detects your install type and performs the correct upgrade:`,
    ``,
    "```text",
    `get_skill('update-skills')`,
    "```",
    ``,
    `Changelog: https://github.com/stuffbucket/skills/releases`,
  ].join("\n");
}

module.exports = {
  // Primary API
  getUpdateStatus,
  getUpdateStatusNow,
  // Back-compat surface used by mcp-server.js
  checkFreshness,
  getUpdateInstructions,
  // Helpers (exported for reuse/testing)
  isNewer,
  parseSemver,
  getLocalVersion,
};

#!/usr/bin/env node

// Unit tests for the version-check detector (issue #27).
// Network-free: exercises the pure helpers and the synchronous, never-throws
// status surface. Does NOT make a live registry call, so it stays fast and
// deterministic in CI.
//
// Usage: node test-version-check.js
// Exit code: 0 = all pass, 1 = failures

const path = require("path");

const vc = require(path.join(__dirname, "..", "scripts", "version-check.js"));
const updateSkills = require(
  path.join(
    __dirname,
    "..",
    "..",
    "update-skills",
    "scripts",
    "version-check.js",
  ),
);

let passed = 0;
let failed = 0;

function test(name, cond) {
  if (cond) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}`);
    failed++;
  }
}

console.log("version-check Unit Tests");
console.log("========================\n");

// --- parseSemver ---
console.log("1. parseSemver");
test("parses x.y.z", JSON.stringify(vc.parseSemver("1.2.3")) === "[1,2,3]");
test("strips leading v", JSON.stringify(vc.parseSemver("v0.2.18")) === "[0,2,18]");
test("ignores pre-release suffix", JSON.stringify(vc.parseSemver("1.2.3-beta.1")) === "[1,2,3]");
test("returns null for junk", vc.parseSemver("not-a-version") === null);
test("returns null for non-string", vc.parseSemver(null) === null);

// --- isNewer ---
console.log("\n2. isNewer (semver precedence)");
test("0.2.19 > 0.2.18", vc.isNewer("0.2.19", "0.2.18") === true);
test("0.3.0 > 0.2.99", vc.isNewer("0.3.0", "0.2.99") === true);
test("1.0.0 > 0.9.9", vc.isNewer("1.0.0", "0.9.9") === true);
test("equal is not newer", vc.isNewer("0.2.18", "0.2.18") === false);
test("older is not newer", vc.isNewer("0.2.17", "0.2.18") === false);
test("unparseable is not newer (never throws)", vc.isNewer("x", "0.2.18") === false);

// --- getLocalVersion ---
console.log("\n3. getLocalVersion");
const local = vc.getLocalVersion();
test("reads a semver from package.json (not a git tag)", vc.parseSemver(local) !== null);

// --- getUpdateStatus: total shape, never throws, no git dependency ---
console.log("\n4. getUpdateStatus (synchronous, never-throws)");
let status;
let threw = false;
try {
  status = vc.getUpdateStatus();
} catch {
  threw = true;
}
test("does not throw", threw === false);
test("has all UpdateStatus keys", status &&
  ["current", "latest", "update_available", "checked_at", "last_error", "enabled"].every(
    (k) => k in status,
  ));
test("current is the real installed version", status && status.current === local);
test("update_available is a boolean", typeof status.update_available === "boolean");
test("enabled is true", status.enabled === true);
test(
  "idle before any completed fetch (latest null → not available)",
  status.latest === null ? status.update_available === false : true,
);

// --- API surface ---
console.log("\n5. Exposed API");
test("getUpdateStatusNow is a function", typeof vc.getUpdateStatusNow === "function");
test("checkFreshness is a function (back-compat)", typeof vc.checkFreshness === "function");
test("getUpdateInstructions is a function (back-compat)", typeof vc.getUpdateInstructions === "function");
test(
  "checkFreshness returns null when no update known",
  vc.getUpdateStatus().update_available ? true : vc.checkFreshness() === null,
);

// --- getUpdateInstructions: notify-only, no bare git commands ---
console.log("\n6. getUpdateInstructions (notify-only)");
test("null when no update info", vc.getUpdateInstructions(null) === null);
const instr = vc.getUpdateInstructions({ localVersion: "0.2.18", latestVersion: "0.2.19" });
test("mentions both versions", instr.includes("0.2.18") && instr.includes("0.2.19"));
test("routes to the update-skills skill", instr.includes("update-skills"));
test("does not advertise a bare git checkout", !/git .*checkout/.test(instr));

// --- update-skills wrapper delegates without throwing ---
console.log("\n7. update-skills wrapper");
test("checkForUpdate is a function", typeof updateSkills.checkForUpdate === "function");

console.log(`\n${"=".repeat(24)}`);
console.log(`PASS: ${passed}  FAIL: ${failed}`);
console.log(failed === 0 ? "ALL TESTS PASSED" : "SOME TESTS FAILED");
console.log("");
process.exitCode = failed === 0 ? 0 : 1;

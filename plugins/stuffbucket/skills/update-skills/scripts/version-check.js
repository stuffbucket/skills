#!/usr/bin/env node

// Thin wrapper over the single source-of-truth detector in skill-router.
// Detection uses the npm registry dist-tags (works for npm/npx/git/plugin
// installs — no `.git` required); this file only adapts the shape and provides
// a one-shot CLI.
//
//   node scripts/version-check.js   → prints "Update available" / "Up to date"

const {
  getUpdateStatusNow,
} = require("../../skill-router/scripts/version-check");

// Returns { current, latest, updateAvailable, lastError } or null when the
// installed version can't be determined. Never throws.
async function checkForUpdate() {
  const status = await getUpdateStatusNow();
  if (!status.current) return null;
  return {
    current: status.current,
    latest: status.latest,
    updateAvailable: status.update_available,
    lastError: status.last_error,
  };
}

module.exports = { checkForUpdate };

// CLI: node scripts/version-check.js
if (require.main === module) {
  checkForUpdate().then((result) => {
    if (!result) {
      console.log("Could not determine the installed version.");
      process.exitCode = 1;
      return;
    }
    if (result.updateAvailable) {
      console.log(`Update available: ${result.current} → ${result.latest}`);
      console.log(`  Run the update-skills skill to apply it.`);
    } else if (result.latest) {
      console.log(`Up to date: ${result.current}`);
    } else {
      // Offline / registry unreachable — clean idle state, not an error.
      console.log(
        `Installed: ${result.current}. Could not reach the npm registry` +
          (result.lastError ? ` (${result.lastError}).` : "."),
      );
    }
  });
}

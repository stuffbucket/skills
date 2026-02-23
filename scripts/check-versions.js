#!/usr/bin/env node

// Verifies that version strings are consistent across all manifest files.
// Exits with code 1 if any version doesn't match package.json.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const pkgVersion = JSON.parse(
  fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
).version;

const checks = [
  {
    file: ".claude-plugin/marketplace.json",
    fields: ["plugins.0.version"],
  },
  {
    file: ".github/plugin/marketplace.json",
    fields: ["plugins.0.version"],
  },
  {
    file: "plugins/stuffbucket/plugin.json",
    fields: ["version"],
  },
];

let failed = 0;

for (const check of checks) {
  const filePath = path.join(ROOT, check.file);
  if (!fs.existsSync(filePath)) {
    console.log(`  ✗ ${check.file} — file not found`);
    failed++;
    continue;
  }
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  for (const field of check.fields) {
    const value = field.split(".").reduce((obj, key) => obj && obj[key], data);
    if (value === pkgVersion) {
      console.log(`  ✓ ${check.file} → ${field} = ${value}`);
    } else {
      console.log(
        `  ✗ ${check.file} → ${field} = ${value} (expected ${pkgVersion})`,
      );
      failed++;
    }
  }
}

if (failed > 0) {
  console.log(`\nFAIL: ${failed} version mismatch(es)`);
  process.exitCode = 1;
} else {
  console.log(`\nAll versions match ${pkgVersion}`);
}

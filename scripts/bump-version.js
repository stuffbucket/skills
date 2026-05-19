#!/usr/bin/env node

// Bump the version across all manifest files, regenerate derived files,
// and verify consistency.
//
// Usage:
//   npm run bump -- 0.3.0
//
// In CI, pass --ci to skip rebuilds (CI already ran them).

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const args = process.argv.slice(2);
const ciMode = args.includes("--ci");
const newVersion = args.find((a) => /^\d+\.\d+\.\d+$/.test(a));

if (!newVersion) {
  console.error("Usage: npm run bump -- <semver>");
  console.error("  e.g. npm run bump -- 0.3.0");
  process.exit(1);
}

// Files and the JSON paths to update
const targets = [
  { file: "package.json", fields: ["version"] },
  { file: ".claude-plugin/marketplace.json", fields: ["plugins.0.version"] },
  {
    file: ".github/plugin/marketplace.json",
    fields: ["metadata.version", "plugins.0.version"],
  },
  {
    file: "plugins/stuffbucket/.claude-plugin/plugin.json",
    fields: ["version"],
  },
];

function setField(obj, dotPath, value) {
  const keys = dotPath.split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

// 1. Update all manifest files
const changedFiles = [];
for (const target of targets) {
  const filePath = path.join(ROOT, target.file);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  for (const field of target.fields) {
    setField(data, field, newVersion);
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
  changedFiles.push(target.file);
  console.log(`  ✓ ${target.file}`);
}

// 2. Regenerate package-lock.json (skip in CI — npm version already updated it)
if (!ciMode) {
  console.log("\nRegenerating package-lock.json...");
  execSync("npm install --package-lock-only", { cwd: ROOT, stdio: "ignore" });
  changedFiles.push("package-lock.json");
  console.log("  ✓ package-lock.json");
}

// 3. Rebuild index and llms.txt (skip in CI — already built)
if (!ciMode) {
  console.log("\nRebuilding derived files...");
  execSync("npm run build:index", { cwd: ROOT, stdio: "ignore" });
  console.log("  ✓ index.json");
  execSync("npm run build:llms", { cwd: ROOT, stdio: "ignore" });
  console.log("  ✓ llms.txt");
}

// 4. Verify
console.log("\nVerifying...");
try {
  execSync("npm run check:versions", { cwd: ROOT, stdio: "inherit" });
} catch {
  process.exit(1);
}

// 5. Print changed files (one per line, for scripting)
console.log("\nChanged files:");
for (const f of changedFiles) {
  console.log(f);
}

console.log(`\nBumped to ${newVersion}. Review changes, then commit and tag.`);

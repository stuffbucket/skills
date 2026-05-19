#!/usr/bin/env node

// Verifies that seed values (version, namespace, repo URL) are consistent
// across all manifest files. Single source of truth: package.json.
// Exits with code 1 if any value doesn't match.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const pkg = JSON.parse(
  fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
);

// Derive seed values from package.json
const seeds = {
  version: pkg.version,
  namespace: pkg.name.replace(/^@/, "").split("/")[0],
  repoUrl: pkg.repository.url.replace(/^git\+/, ""),
};

function resolve(obj, fieldPath) {
  return fieldPath.split(".").reduce((o, key) => o && o[key], obj);
}

const checks = [
  // Version checks
  { file: ".claude-plugin/marketplace.json", field: "plugins.0.version", seed: "version" },
  { file: ".github/plugin/marketplace.json", field: "metadata.version", seed: "version" },
  { file: ".github/plugin/marketplace.json", field: "plugins.0.version", seed: "version" },
  { file: "plugins/stuffbucket/.claude-plugin/plugin.json", field: "version", seed: "version" },
  // Namespace checks
  { file: ".claude-plugin/marketplace.json", field: "plugins.0.name", seed: "namespace" },
  { file: ".github/plugin/marketplace.json", field: "plugins.0.name", seed: "namespace" },
  { file: "plugins/stuffbucket/.claude-plugin/plugin.json", field: "name", seed: "namespace" },
  // Repo URL checks
  { file: "plugins/stuffbucket/.claude-plugin/plugin.json", field: "homepage", seed: "repoUrl", transform: (v) => v.replace(/\.git$/, "") },
  { file: "plugins/stuffbucket/.claude-plugin/plugin.json", field: "repository", seed: "repoUrl" },
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
  const actual = resolve(data, check.field);
  let expected = seeds[check.seed];
  if (check.transform) expected = check.transform(expected);

  if (actual === expected) {
    console.log(`  ✓ ${check.file} → ${check.field} = ${actual}`);
  } else {
    console.log(
      `  ✗ ${check.file} → ${check.field} = ${actual} (expected ${expected})`,
    );
    failed++;
  }
}

if (failed > 0) {
  console.log(`\nFAIL: ${failed} seed mismatch(es)`);
  process.exitCode = 1;
} else {
  console.log(`\nAll seeds consistent (version=${seeds.version}, namespace=${seeds.namespace})`);
}

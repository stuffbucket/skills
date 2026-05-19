#!/usr/bin/env node

// Regenerates auto-generated sections in README.md from index.json and package.json.
//
// Sections are delimited by <!-- BEGIN:NAME --> / <!-- END:NAME --> markers.
// Everything between the markers is replaced; everything outside is preserved.
//
// Usage:
//   npm run build:readme           # regenerate
//   npm run check:readme           # exit 1 if out of date

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const README_PATH = path.join(ROOT, "README.md");
const INDEX_PATH = path.join(
  ROOT,
  "plugins/stuffbucket/skills/skill-router/index.json",
);
const PKG_PATH = path.join(ROOT, "package.json");

const checkMode = process.argv.includes("--check");

// --- Build skills table from index.json ---
function buildSkillsSection() {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  const skills = index.skills.sort((a, b) => a.name.localeCompare(b.name));

  const lines = ["## Available Skills", "", "| Skill | Description |", "| --- | --- |"];
  for (const s of skills) {
    // Trim description to first sentence for table readability
    const desc = s.description.replace(/^"(.*)"$/, "$1").split(". ")[0];
    lines.push(`| \`${s.name}\` | ${desc} |`);
  }
  return lines.join("\n");
}

// --- Build scripts table from package.json ---
function buildScriptsSection() {
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, "utf8"));

  // Script descriptions — keep in sync with package.json
  const descriptions = {
    setup: "Install deps + create MCP symlinks + build index",
    "build:index": "Rebuild the skill-router index",
    "build:llms": "Regenerate llms.txt from template",
    "build:readme": "Regenerate README.md auto-generated sections",
    bump: "Bump version across all manifests",
    test: "Build index + run MCP server smoke tests",
    "test:repl": "Build index + launch interactive REPL",
    "test:structure": "Run plugin structure tests only",
    lint: "Lint markdown + JS + JSON schemas",
    validate: "Validate all skills (frontmatter + content)",
    "validate:one": "Validate a single skill",
    "check:versions": "Verify version consistency across manifests",
    "check:llms": "Verify llms.txt is up to date",
    "check:readme": "Verify README.md auto-generated sections are up to date",
    new: "Scaffold a new skill",
    package: "Package a skill for submission",
    ci: "Run full CI pipeline (lint + validate + test)",
  };

  const lines = ["### Scripts", "", "| Command | What it does |", "| --- | --- |"];
  for (const [name, desc] of Object.entries(descriptions)) {
    if (pkg.scripts[name]) {
      lines.push(`| \`npm run ${name}\` | ${desc} |`);
    }
  }
  return lines.join("\n");
}

// --- Replace marker sections ---
const generators = {
  SKILLS: buildSkillsSection,
  SCRIPTS: buildScriptsSection,
};

let readme = fs.readFileSync(README_PATH, "utf8");

for (const [name, generate] of Object.entries(generators)) {
  const pattern = new RegExp(
    `(<!-- BEGIN:${name} -->)\\n[\\s\\S]*?(<!-- END:${name} -->)`,
  );
  const match = readme.match(pattern);
  if (!match) {
    console.error(`Marker <!-- BEGIN:${name} --> not found in README.md`);
    process.exit(1);
  }
  const content = generate();
  readme = readme.replace(pattern, `$1\n${content}\n$2`);
}

if (checkMode) {
  const current = fs.readFileSync(README_PATH, "utf8");
  if (current === readme) {
    console.log("README.md is up to date.");
  } else {
    console.log("README.md is out of date — regenerate with:");
    console.log("  npm run build:readme");
    process.exit(1);
  }
} else {
  fs.writeFileSync(README_PATH, readme);
  console.log("README.md updated.");
}

#!/usr/bin/env node

// Structural tests for plugin layout and manifest correctness.
// Catches the class of problems we've hit during marketplace integration:
//
//   - plugin.json in wrong location (must be inside .claude-plugin/)
//   - plugin.json containing fields Claude Code doesn't support (skills, mcpServers as strings)
//   - marketplace source missing ./ prefix
//   - marketplace missing $schema URL
//   - skills/ or .mcp.json placed inside .claude-plugin/ instead of plugin root
//   - SKILL.md files missing from skill directories
//   - marketplace plugin source pointing to non-existent directory
//
// Usage: node tests/test-plugin-structure.js
// Exit code: 0 = all pass, 1 = failures

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
let passed = 0;
let failed = 0;

function test(name, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function readJSON(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function isDir(relPath) {
  const full = path.join(ROOT, relPath);
  return fs.existsSync(full) && fs.statSync(full).isDirectory();
}

// ──────────────────────────────────────────────
// Discover plugins from the Claude Code marketplace manifest
// ──────────────────────────────────────────────

const claudeMarketplace = readJSON(".claude-plugin/marketplace.json");
if (!claudeMarketplace) {
  console.error("FATAL: .claude-plugin/marketplace.json not found");
  process.exit(1);
}

const pluginEntries = claudeMarketplace.plugins || [];
const pluginDirs = pluginEntries
  .map((p) => (typeof p.source === "string" ? p.source : null))
  .filter(Boolean)
  .map((s) => s.replace(/^\.\//, ""));

console.log("Plugin Structure Tests");
console.log("======================\n");

// ──────────────────────────────────────────────
// 1. Marketplace manifest structure
// ──────────────────────────────────────────────
console.log("1. Claude Code marketplace manifest");

test(
  "$schema URL is set",
  claudeMarketplace.$schema ===
    "https://anthropic.com/claude-code/marketplace.schema.json",
  `got: ${claudeMarketplace.$schema}`,
);

test(
  "top-level description is present",
  typeof claudeMarketplace.description === "string" &&
    claudeMarketplace.description.length > 0,
  "required by Anthropic schema",
);

test(
  "owner.name is present",
  claudeMarketplace.owner && typeof claudeMarketplace.owner.name === "string",
);

test("has at least one plugin", pluginEntries.length > 0);

for (const plugin of pluginEntries) {
  const prefix = `plugin "${plugin.name}"`;

  test(
    `${prefix}: source starts with ./`,
    typeof plugin.source === "string" && plugin.source.startsWith("./"),
    `got: ${JSON.stringify(plugin.source)}`,
  );

  test(
    `${prefix}: has description`,
    typeof plugin.description === "string" && plugin.description.length > 0,
  );

  test(
    `${prefix}: has category`,
    typeof plugin.category === "string" && plugin.category.length > 0,
    "recommended by official marketplace",
  );

  test(
    `${prefix}: has author.name`,
    plugin.author && typeof plugin.author.name === "string",
  );
}

// ──────────────────────────────────────────────
// 2. Plugin directory structure (per plugin)
// ──────────────────────────────────────────────
for (const dir of pluginDirs) {
  console.log(`\n2. Plugin directory: ${dir}`);

  // plugin.json must be inside .claude-plugin/, not at plugin root
  test(
    "plugin.json is inside .claude-plugin/",
    exists(`${dir}/.claude-plugin/plugin.json`),
    "Claude Code requires .claude-plugin/plugin.json",
  );

  test(
    "plugin.json is NOT at plugin root",
    !exists(`${dir}/plugin.json`),
    "plugin.json at root is the wrong location",
  );

  // skills/ and .mcp.json must be at plugin root, NOT inside .claude-plugin/
  if (isDir(`${dir}/skills`)) {
    test(
      "skills/ is at plugin root (not inside .claude-plugin/)",
      !isDir(`${dir}/.claude-plugin/skills`),
      "skills/ inside .claude-plugin/ will be ignored",
    );
  }

  if (exists(`${dir}/.mcp.json`)) {
    test(
      ".mcp.json is at plugin root (not inside .claude-plugin/)",
      !exists(`${dir}/.claude-plugin/.mcp.json`),
      ".mcp.json inside .claude-plugin/ will be ignored",
    );
  }

  // ──────────────────────────────────────────────
  // 3. plugin.json content validation
  // ──────────────────────────────────────────────
  const pluginJson = readJSON(`${dir}/.claude-plugin/plugin.json`);
  if (pluginJson) {
    console.log(`\n3. Plugin manifest: ${dir}/.claude-plugin/plugin.json`);

    test("has name", typeof pluginJson.name === "string");
    test(
      "has description",
      typeof pluginJson.description === "string" &&
        pluginJson.description.length > 0,
    );
    test(
      "has version",
      typeof pluginJson.version === "string" && /^\d+\.\d+\.\d+/.test(pluginJson.version),
      `got: ${pluginJson.version}`,
    );

    // Fields that Claude Code rejects as invalid
    test(
      'no "skills" string field (auto-discovered)',
      typeof pluginJson.skills !== "string",
      'Claude Code rejects "skills": "skills/" — remove it',
    );

    test(
      'no "mcpServers" string field (auto-discovered)',
      typeof pluginJson.mcpServers !== "string",
      'Claude Code rejects "mcpServers": ".mcp.json" — remove it',
    );

    // author should be an object, not a string
    if (pluginJson.author !== undefined) {
      test(
        "author is an object (not a string)",
        typeof pluginJson.author === "object" && pluginJson.author !== null,
        `got type: ${typeof pluginJson.author}`,
      );
    }
  }

  // ──────────────────────────────────────────────
  // 4. Skills directory structure
  // ──────────────────────────────────────────────
  const skillsDir = path.join(ROOT, dir, "skills");
  if (fs.existsSync(skillsDir)) {
    console.log(`\n4. Skills: ${dir}/skills/`);

    const skillFolders = fs
      .readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    test("has at least one skill", skillFolders.length > 0);

    for (const skill of skillFolders) {
      test(
        `${skill}/ has SKILL.md`,
        exists(`${dir}/skills/${skill}/SKILL.md`),
        "every skill directory must contain SKILL.md",
      );
    }
  }
}

// ──────────────────────────────────────────────
// 5. Marketplace source targets exist
// ──────────────────────────────────────────────
console.log("\n5. Marketplace source targets");

for (const plugin of pluginEntries) {
  if (typeof plugin.source === "string") {
    const target = plugin.source.replace(/^\.\//, "");
    test(
      `source "${plugin.source}" exists as directory`,
      isDir(target),
      "marketplace points to non-existent plugin directory",
    );
  }
}

// ──────────────────────────────────────────────
// 6. GitHub/Copilot marketplace consistency
// ──────────────────────────────────────────────
const ghMarketplace = readJSON(".github/plugin/marketplace.json");
if (ghMarketplace) {
  console.log("\n6. GitHub/Copilot marketplace consistency");

  test(
    "has metadata.description",
    ghMarketplace.metadata &&
      typeof ghMarketplace.metadata.description === "string",
  );

  test(
    "has metadata.version",
    ghMarketplace.metadata &&
      typeof ghMarketplace.metadata.version === "string",
  );

  // Same plugins listed in both marketplaces
  const claudeNames = pluginEntries.map((p) => p.name).sort();
  const ghNames = (ghMarketplace.plugins || []).map((p) => p.name).sort();
  test(
    "same plugin names in both marketplaces",
    JSON.stringify(claudeNames) === JSON.stringify(ghNames),
    `claude: [${claudeNames}], github: [${ghNames}]`,
  );
}

// ──────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────
console.log(`\n======================`);
console.log(`PASS: ${passed}  FAIL: ${failed}`);

if (failed > 0) {
  console.log("STRUCTURE TESTS FAILED");
  process.exit(1);
} else {
  console.log("ALL STRUCTURE TESTS PASSED");
}

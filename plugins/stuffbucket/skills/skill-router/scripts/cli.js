#!/usr/bin/env node

// One-shot CLI for skill-router.
//
// Usage:
//   skl                        Show help
//   skl list                   List all skills
//   skl list <query>           Search skills by keyword
//   skl get <name>             Print a skill's full SKILL.md
//   skl help                   Show help
//   skl version                Print version
//
// Exits immediately after output — no REPL, no MCP.

const fs = require("fs");
const path = require("path");
const Fuse = require("fuse.js");
const { createFuse, blendedSearch } = require("./search");

// --- Resolve paths ---
const PACKAGE_ROOT = path.join(__dirname, "..", "..", "..", "..", "..");

function resolveRoot() {
  if (fs.existsSync(path.join(PACKAGE_ROOT, "plugins"))) return PACKAGE_ROOT;
  return process.cwd();
}

const ROOT = resolveRoot();
const INDEX_PATH = path.join(__dirname, "..", "index.json");
const SEMANTIC_PATH = path.join(__dirname, "..", "semantic-index.json");

// --- Load data ---
function loadIndex() {
  if (!fs.existsSync(INDEX_PATH)) return { skills: [] };
  return JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
}

function loadSemanticIndex() {
  if (!fs.existsSync(SEMANTIC_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(SEMANTIC_PATH, "utf8"));
  } catch {
    return null;
  }
}

let searcher = null;
let cachedSkills = null;
let semanticIdx = null;

function getSearcher() {
  const index = loadIndex();
  if (cachedSkills === index.skills && searcher)
    return { searcher, skills: cachedSkills };

  cachedSkills = index.skills;
  searcher = createFuse(cachedSkills, Fuse);
  semanticIdx = loadSemanticIndex();
  return { searcher, skills: cachedSkills };
}

function searchSkills(query) {
  const { searcher: s } = getSearcher();
  return blendedSearch(query, {
    fuse: s.fuse,
    items: s.items,
    semanticIdx,
    idField: "name",
  });
}

// --- Commands ---

function cmdList(query) {
  const skills = searchSkills(query || undefined);
  if (skills.length === 0) {
    console.log("No skills found.");
    process.exit(1);
  }

  const nameWidth = Math.max(...skills.map((s) => s.name.length));
  for (const s of skills) {
    console.log(`  ${s.name.padEnd(nameWidth)}  ${s.description || ""}`);
  }
}

function cmdGet(name) {
  if (!name) {
    console.error("Usage: skl get <skill-name>");
    process.exit(1);
  }

  const { searcher: s } = getSearcher();
  const q = name.toLowerCase().trim();

  // Exact match
  const exact = s.items.find((sk) => sk.name === q);
  const skill = exact || s.items.find(
    (sk) => sk.name.startsWith(q) || q.startsWith(sk.name),
  );

  if (!skill) {
    // Try fuzzy
    const results = searchSkills(q);
    if (results.length > 0) {
      console.error(`No exact match for "${name}". Did you mean:`);
      for (const r of results.slice(0, 5)) {
        console.error(`  ${r.name}`);
      }
      process.exit(1);
    }
    console.error(`Skill "${name}" not found.`);
    process.exit(1);
  }

  const skillMdPath = path.join(ROOT, skill.path, "SKILL.md");
  if (!fs.existsSync(skillMdPath)) {
    console.error(`SKILL.md not found at ${skill.path}/SKILL.md`);
    process.exit(1);
  }

  if (skill.name !== q) {
    console.error(`Resolved "${name}" → ${skill.name}\n`);
  }
  console.log(fs.readFileSync(skillMdPath, "utf8"));
}

function cmdVersion() {
  const pkgPath = path.join(PACKAGE_ROOT, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    console.log(`${pkg.name} ${pkg.version}`);
  } else {
    console.log("unknown");
  }
}

function cmdHelp() {
  console.log(`skl — Stuffbucket Skills CLI

Usage:
  skl list [query]     List skills, optionally filtered by keyword
  skl get <name>       Print a skill's full SKILL.md content
  skl version          Print version
  skl help             Show this help

Examples:
  skl list
  skl list git
  skl get code-analysis-skill
  skl get file-management`);
}

// --- Main ---
const [cmd, ...rest] = process.argv.slice(2);

switch (cmd) {
  case "list":
  case "ls":
    cmdList(rest.join(" ") || undefined);
    break;

  case "get":
  case "load":
    cmdGet(rest.join(" "));
    break;

  case "version":
  case "--version":
  case "-v":
    cmdVersion();
    break;

  case "help":
  case "--help":
  case "-h":
  case undefined:
    cmdHelp();
    break;

  default:
    // Bare arg — treat as a get attempt
    cmdGet([cmd, ...rest].join(" "));
    break;
}

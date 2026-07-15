#!/usr/bin/env node

// Detects how @stuffbucket/skills is installed so the update-skills skill can
// choose the correct upgrade command. Prints two space-separated tokens:
//
//   <type> <install-root>
//
// where <type> is one of:
//   git         — a .git directory is present at the package root
//                 (a clone or a Claude Code marketplace plugin install)
//   npm-global  — installed under a global node_modules prefix
//                 (npm install -g @stuffbucket/skills)
//   npx         — running from the npx cache, or an unrecognized layout
//                 (the default `.mcp.json` launch via `npx -p @stuffbucket/skills`)
//
// Best-effort: the update-skills skill lists the command for every type, so an
// ambiguous guess never blocks the user.

const fs = require("fs");
const path = require("path");

const root = path.resolve(path.join(__dirname, "..", "..", "..", "..", ".."));

function detect() {
  // A checked-out repo (clone or plugin marketplace install) has a .git dir.
  if (fs.existsSync(path.join(root, ".git"))) return "git";

  const p = root.replace(/\\/g, "/");

  // npx materializes packages under <npm-cache>/_npx/<hash>/node_modules/...
  if (p.includes("/_npx/")) return "npx";

  // Global installs live under a global prefix, typically .../lib/node_modules
  // (POSIX) or .../npm/node_modules (Windows).
  if (p.includes("/lib/node_modules/") || p.includes("/npm/node_modules/")) {
    return "npm-global";
  }

  return "npx";
}

console.log(`${detect()} ${root}`);

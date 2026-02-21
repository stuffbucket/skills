#!/usr/bin/env node

// Creates MCP config symlinks for editor discovery.
//
//   .mcp.json           → plugins/stuffbucket/.mcp.json  (Claude Code, Cursor)
//   .vscode/mcp.json    → plugins/stuffbucket/.mcp.json  (VS Code)
//
// On Windows without symlink support, copies the file instead.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CANONICAL = path.join("plugins", "stuffbucket", ".mcp.json");

const LINKS = [
  { link: ".mcp.json", target: CANONICAL },
  { link: path.join(".vscode", "mcp.json"), target: CANONICAL },
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createLink(linkPath, targetPath) {
  const fullLink = path.join(ROOT, linkPath);
  const fullTarget = path.join(ROOT, targetPath);

  if (!fs.existsSync(fullTarget)) {
    console.log(`  skip  ${linkPath} — target does not exist: ${targetPath}`);
    return;
  }

  // Check current state of link location
  let stat;
  try {
    stat = fs.lstatSync(fullLink);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    // Doesn't exist — will create below
  }

  if (stat) {
    if (stat.isSymbolicLink()) {
      const existing = fs.readlinkSync(fullLink);
      const resolved = path.resolve(path.dirname(fullLink), existing);
      if (resolved === path.resolve(fullTarget)) {
        console.log(`  ok    ${linkPath} (already linked)`);
        return;
      }
      // Wrong target — remove and recreate
      fs.unlinkSync(fullLink);
    } else {
      // Regular file — don't overwrite
      console.log(`  skip  ${linkPath} — regular file exists (not overwriting)`);
      return;
    }
  }

  ensureDir(path.dirname(fullLink));
  const relTarget = path.relative(path.dirname(fullLink), fullTarget);

  try {
    fs.symlinkSync(relTarget, fullLink);
    console.log(`  link  ${linkPath} → ${relTarget}`);
  } catch (e) {
    if (e.code === "EPERM" && process.platform === "win32") {
      // Windows without Developer Mode — fall back to copy
      fs.copyFileSync(fullTarget, fullLink);
      console.log(`  copy  ${linkPath} ← ${targetPath} (Windows fallback)`);
    } else {
      throw e;
    }
  }
}

console.log("Setting up MCP config symlinks...");
for (const { link, target } of LINKS) {
  createLink(link, target);
}
console.log("Done.");

#!/usr/bin/env node

// Regression test for the MCP launch command.
//
// Guards the bug where `.mcp.json` ran `npx -y @stuffbucket/skills` but the
// package defined no bin matching its unscoped name ("skills"), so npx failed
// with "could not determine executable to run" and the server never started.
//
// The invariant: every `npx`-based MCP launch command that targets this package
// must resolve to a bin that package.json actually declares. We replicate npx's
// bin-resolution rule statically (no network, no install) and assert it holds
// for every committed MCP config file.
//
// Usage: node tests/test-mcp-launch-command.js
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

// Strip a version/tag suffix from a package spec, preserving the scope.
//   "@stuffbucket/skills@1.2.3" -> "@stuffbucket/skills"
//   "skills@latest"            -> "skills"
function packageName(spec) {
  const at = spec.lastIndexOf("@");
  // at === 0 means a leading scope "@scope/name" with no version
  return at > 0 ? spec.slice(0, at) : spec;
}

// The bin npx runs for a bare `npx <pkg>` is the package's UNSCOPED name.
//   "@stuffbucket/skills" -> "skills"
function unscoped(name) {
  return name.includes("/") ? name.split("/").pop() : name;
}

// Replicate npx bin resolution for the two forms we use:
//   npx [-y] <pkgspec>                  -> bin = unscoped(pkgspec)
//   npx [-y] -p <pkgspec> <bin> [...]   -> bin = <bin>
// Returns { pkg, bin } or null if this isn't an npx invocation we recognise.
function resolveNpx(command, args) {
  if (command !== "npx") return null;
  const tokens = [...args];
  let pkgFromFlag = null;
  const positionals = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === "-y" || tok === "--yes" || tok === "--no-install") {
      continue;
    }
    if (tok === "-p" || tok === "--package") {
      pkgFromFlag = tokens[++i];
      continue;
    }
    if (tok.startsWith("-")) {
      // Unknown flag; ignore conservatively.
      continue;
    }
    positionals.push(tok);
  }

  if (pkgFromFlag) {
    // `-p <pkg> <bin>`: first positional is the bin/command to run.
    return { pkg: packageName(pkgFromFlag), bin: positionals[0] };
  }
  if (positionals.length === 0) return null;
  const pkg = packageName(positionals[0]);
  return { pkg, bin: unscoped(pkg) };
}

console.log("MCP Launch Command Tests");
console.log("========================\n");

const pkgJson = readJSON("package.json");
if (!pkgJson) {
  console.error("FATAL: package.json not found");
  process.exit(1);
}

const PACKAGE = pkgJson.name; // "@stuffbucket/skills"
const binKeys = Object.keys(pkgJson.bin || {});

console.log("1. package.json bin declares the package's unscoped name");
test(
  `bin includes "${unscoped(PACKAGE)}" (npx <pkg> resolves to it)`,
  binKeys.includes(unscoped(PACKAGE)),
  `bin keys: [${binKeys.join(", ")}] — without it, "npx -y ${PACKAGE}" fails ` +
    `with "could not determine executable to run"`,
);

// Every declared bin must point at a file that exists.
console.log("\n2. Declared bin targets exist on disk");
for (const [name, target] of Object.entries(pkgJson.bin || {})) {
  test(
    `bin "${name}" -> ${target}`,
    fs.existsSync(path.join(ROOT, target)),
    "bin target file is missing",
  );
}

// Committed MCP config files whose launch command must resolve to a real bin.
const MCP_CONFIGS = [
  "plugins/stuffbucket/.mcp.json",
  ".vscode/mcp.json",
];

console.log("\n3. Committed MCP configs resolve to a declared bin");
for (const rel of MCP_CONFIGS) {
  const cfg = readJSON(rel);
  if (!cfg) {
    // .mcp.json at repo root is a symlink to plugins/stuffbucket/.mcp.json;
    // a missing optional config is not a failure.
    console.log(`  (skipped, not present: ${rel})`);
    continue;
  }
  const servers = cfg.mcpServers || {};
  for (const [serverName, spec] of Object.entries(servers)) {
    const resolved = resolveNpx(spec.command, spec.args || []);
    if (!resolved) {
      // Non-npx launch (e.g. a direct node path): nothing to resolve here.
      test(
        `${rel} [${serverName}] has a runnable command`,
        typeof spec.command === "string" && spec.command.length > 0,
        "missing command",
      );
      continue;
    }
    if (packageName(resolved.pkg) !== PACKAGE) {
      // Targets a different package; out of scope for this repo's bins.
      test(
        `${rel} [${serverName}] targets a named bin`,
        typeof resolved.bin === "string" && resolved.bin.length > 0,
        `could not determine a bin from args: ${JSON.stringify(spec.args)}`,
      );
      continue;
    }
    test(
      `${rel} [${serverName}] "${spec.command} ${(spec.args || []).join(" ")}" -> bin "${resolved.bin}"`,
      binKeys.includes(resolved.bin),
      `resolves to bin "${resolved.bin}" which package.json does not declare ` +
        `(declared: [${binKeys.join(", ")}])`,
    );
  }
}

console.log(`\n========================`);
console.log(`PASS: ${passed}  FAIL: ${failed}`);

if (failed > 0) {
  console.log("MCP LAUNCH COMMAND TESTS FAILED");
  process.exit(1);
} else {
  console.log("ALL MCP LAUNCH COMMAND TESTS PASSED");
}

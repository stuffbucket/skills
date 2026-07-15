#!/usr/bin/env node

// Unit tests for build-index.js frontmatter parsing (the parser-hardening
// follow-up). Guards against the lenient/strict divergence that let 11 skills
// ship invalid YAML: the builder now uses a real YAML parse, so it accepts and
// rejects exactly what the validator (quick_validate.py / PyYAML) does.
//
// Usage: node test-build-index.js   (exit 0 = pass, 1 = fail)

const path = require("path");

// Sanity: these tests assert the STRICT path, which requires js-yaml. It's a
// devDependency, so it must be present when running the suite.
try {
  require("js-yaml");
} catch {
  console.error("js-yaml not installed — run `npm install` first.");
  process.exit(1);
}

const { parseFrontmatter } = require(
  path.join(__dirname, "..", "scripts", "build-index.js"),
);

let passed = 0;
let failed = 0;
function test(name, cond) {
  if (cond) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}`);
    failed++;
  }
}

const fm = (body) => `---\n${body}\n---\nbody text\n`;

console.log("build-index frontmatter parsing");
console.log("==============================\n");

// 1. Valid simple frontmatter
console.log("1. Valid frontmatter");
const simple = parseFrontmatter(fm("name: foo\ndescription: A simple skill"));
test("parses name", simple && simple.name === "foo");
test("parses description", simple && simple.description === "A simple skill");

// 2. The bug: an UNQUOTED colon-space in a value is invalid YAML → rejected
//    (returns null → skill skipped + validate flags it), NOT silently mis-parsed.
console.log("\n2. Unquoted colon-space (the bug) is rejected");
test(
  "returns null for `description: Use when X: do Y`",
  parseFrontmatter(fm("name: foo\ndescription: Use when X: do Y")) === null,
);
test(
  "returns null for `description: decorations: false`",
  parseFrontmatter(fm("name: foo\ndescription: decorations: false")) === null,
);

// 3. The escape hatch: colons ARE allowed when the value is quoted…
console.log("\n3. Quoted values may contain colons");
const quoted = parseFrontmatter(
  fm('name: foo\ndescription: "Use when X: do Y with sidecar: true"'),
);
test("parses a double-quoted description", quoted !== null);
test(
  "colon preserved, quotes stripped",
  quoted && quoted.description === "Use when X: do Y with sidecar: true",
);

// 4. …or written as a block scalar.
console.log("\n4. Block scalars may contain colons");
const block = parseFrontmatter(
  fm("name: foo\ndescription: >-\n  Use when X: do Y"),
);
test(
  "folded block scalar parses with colon intact",
  block && block.description === "Use when X: do Y",
);

// 5. Structure: nested metadata + list allowed-tools survive real parsing
console.log("\n5. Nested structures");
const nested = parseFrontmatter(
  fm("name: foo\ndescription: d\nmetadata:\n  tags:\n    - a\n    - b"),
);
test(
  "metadata.tags is a real list",
  nested &&
    nested.metadata &&
    Array.isArray(nested.metadata.tags) &&
    nested.metadata.tags.join(",") === "a,b",
);

// 6. Not-a-mapping (e.g. a bare list) → null, never a crash
console.log("\n6. Malformed frontmatter never throws");
let threw = false;
try {
  test("bare list frontmatter → null", parseFrontmatter(fm("- a\n- b")) === null);
} catch {
  threw = true;
}
test("did not throw", threw === false);

console.log(`\n${"=".repeat(30)}`);
console.log(`PASS: ${passed}  FAIL: ${failed}`);
console.log(failed === 0 ? "ALL TESTS PASSED" : "SOME TESTS FAILED");
process.exitCode = failed === 0 ? 0 : 1;

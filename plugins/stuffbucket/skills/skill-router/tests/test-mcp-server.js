#!/usr/bin/env node

// Smoke test for the skill-router MCP server.
// Spawns the server as a child process, sends JSON-RPC requests,
// and validates responses.
//
// Usage: node test-mcp-server.js
// Exit code: 0 = all tests pass, 1 = failures

const { spawn } = require("child_process");
const path = require("path");
const readline = require("readline");

const SERVER_PATH = path.join(__dirname, "..", "scripts", "mcp-server.js");
const ROOT = path.join(__dirname, "..", "..", "..", "..", "..");

let requestId = 0;
let passed = 0;
let failed = 0;

function send(proc, method, params) {
  const id = ++requestId;
  const request = JSON.stringify({ jsonrpc: "2.0", id, method, params });
  proc.stdin.write(request + "\n");
  return id;
}

function test(name, actual, expected) {
  if (actual) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name} — expected: ${expected}`);
    failed++;
  }
}

async function run() {
  console.log("MCP Server Smoke Tests");
  console.log("======================\n");

  const proc = spawn("node", [SERVER_PATH, ROOT], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  const rl = readline.createInterface({ input: proc.stdout });
  const responses = [];
  const waiters = [];

  rl.on("line", (line) => {
    try {
      const response = JSON.parse(line);
      if (waiters.length > 0) {
        // Deliver directly to the pending waiter
        const resolve = waiters.shift();
        resolve(response);
      } else {
        // Queue for the next waitForResponse call
        responses.push(response);
      }
    } catch (_) {}
  });

  function waitForResponse() {
    return new Promise((resolve) => {
      // Check if we already have a response queued
      if (responses.length > 0) {
        resolve(responses.shift());
      } else {
        waiters.push(resolve);
      }
    });
  }

  // --- Test 1: initialize ---
  console.log("1. Initialize");
  send(proc, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test", version: "1.0.0" },
  });
  const initResp = await waitForResponse();
  test("has result", !!initResp.result, "result object");
  test(
    "has serverInfo",
    initResp.result &&
      initResp.result.serverInfo &&
      initResp.result.serverInfo.name === "skill-router",
    "serverInfo.name = skill-router",
  );
  test(
    "has tools capability",
    initResp.result &&
      initResp.result.capabilities &&
      initResp.result.capabilities.tools !== undefined,
    "capabilities.tools",
  );

  // Send initialized notification (no response expected)
  proc.stdin.write(
    JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }) + "\n",
  );

  // --- Test 2: ping ---
  console.log("\n2. Ping");
  send(proc, "ping", {});
  const pingResp = await waitForResponse();
  test("responds to ping", !!pingResp.result, "result object");
  test("no error", !pingResp.error, "no error");

  // --- Test 3: tools/list ---
  console.log("\n3. Tools List");
  send(proc, "tools/list", {});
  const toolsResp = await waitForResponse();
  const tools = toolsResp.result && toolsResp.result.tools;
  test("returns tools array", Array.isArray(tools), "array");
  test("has 2 tools", tools && tools.length === 2, "2");
  test(
    "has list_skills",
    tools && tools.some((t) => t.name === "list_skills"),
    "list_skills tool",
  );
  test(
    "has get_skill",
    tools && tools.some((t) => t.name === "get_skill"),
    "get_skill tool",
  );
  test(
    "tools have inputSchema",
    tools &&
      tools.every((t) => t.inputSchema && t.inputSchema.type === "object"),
    "inputSchema.type = object",
  );

  // --- Test 4: list_skills (no filter) ---
  console.log("\n4. List Skills (all)");
  send(proc, "tools/call", {
    name: "list_skills",
    arguments: {},
  });
  const listResp = await waitForResponse();
  const listContent = listResp.result && listResp.result.content;
  test("returns content", Array.isArray(listContent), "content array");
  const listText = listContent && listContent[0] && listContent[0].text;
  let allSkills;
  try {
    allSkills = JSON.parse(listText);
  } catch (_) {
    allSkills = null;
  }
  test("parses as JSON", Array.isArray(allSkills), "array");
  test("has skills", allSkills && allSkills.length >= 3, ">= 3 skills");
  test(
    "skills have name + description",
    allSkills && allSkills.every((s) => s.name && s.description),
    "name + description on each",
  );
  test(
    "does not include skill-router",
    allSkills && !allSkills.some((s) => s.name === "skill-router"),
    "skill-router excluded from index",
  );

  // --- Test 5: list_skills (with query) ---
  console.log("\n5. List Skills (filtered: 'file')");
  send(proc, "tools/call", {
    name: "list_skills",
    arguments: { query: "file" },
  });
  const filterResp = await waitForResponse();
  const filterText = filterResp.result.content[0].text;
  let filteredSkills;
  try {
    filteredSkills = JSON.parse(filterText);
  } catch (_) {
    filteredSkills = null;
  }
  test("returns results", Array.isArray(filteredSkills), "array");
  test(
    "file-management-skill is top result",
    filteredSkills &&
      filteredSkills.length > 0 &&
      filteredSkills[0].name === "file-management-skill",
    "file-management-skill first",
  );

  // --- Test 6: list_skills (stemming test) ---
  console.log("\n6. List Skills (stemming: 'refactoring')");
  send(proc, "tools/call", {
    name: "list_skills",
    arguments: { query: "refactoring" },
  });
  const stemResp = await waitForResponse();
  const stemText = stemResp.result.content[0].text;
  let stemSkills;
  try {
    stemSkills = JSON.parse(stemText);
  } catch (_) {
    stemSkills = null;
  }
  test(
    "returns results for stemmed query",
    Array.isArray(stemSkills) && stemSkills.length > 0,
    "non-empty array",
  );
  test(
    "code-analysis-skill in results",
    stemSkills && stemSkills.some((s) => s.name === "code-analysis-skill"),
    "code-analysis-skill found",
  );

  // --- Test 7: get_skill (exact name) ---
  console.log("\n7. Get Skill (exact: 'example-skill')");
  send(proc, "tools/call", {
    name: "get_skill",
    arguments: { name: "example-skill" },
  });
  const getResp = await waitForResponse();
  const getContent = getResp.result.content[0].text;
  test("returns content", getContent && getContent.length > 0, "non-empty");
  test(
    "contains frontmatter",
    getContent && getContent.includes("name: example-skill"),
    "name: example-skill",
  );
  test("no isError", !getResp.result.isError, "not an error");

  // --- Test 8: get_skill (fuzzy — prefix match) ---
  console.log("\n8. Get Skill (fuzzy prefix: 'file-management')");
  send(proc, "tools/call", {
    name: "get_skill",
    arguments: { name: "file-management" },
  });
  const fuzzyResp = await waitForResponse();
  const fuzzyContent = fuzzyResp.result.content[0].text;
  test(
    "resolves to file-management-skill",
    fuzzyContent && fuzzyContent.includes("file-management-skill"),
    "file-management-skill in content",
  );
  test("no isError", !fuzzyResp.result.isError, "not an error");

  // --- Test 9: get_skill (not found) ---
  console.log("\n9. Get Skill (not found: 'xyzzy-nonexistent')");
  send(proc, "tools/call", {
    name: "get_skill",
    arguments: { name: "xyzzy-nonexistent" },
  });
  const notFoundResp = await waitForResponse();
  test("returns isError", !!notFoundResp.result.isError, "isError = true");
  test(
    "lists available skills",
    notFoundResp.result.content[0].text.includes("Available:") ||
      notFoundResp.result.content[0].text.includes("not found"),
    "shows available skills",
  );

  // --- Test 10: get_skill (missing name param) ---
  console.log("\n10. Get Skill (missing param)");
  send(proc, "tools/call", {
    name: "get_skill",
    arguments: {},
  });
  const missingResp = await waitForResponse();
  test("returns isError", !!missingResp.result.isError, "isError = true");

  // --- Test 11: unknown method ---
  console.log("\n11. Unknown Method");
  send(proc, "foo/bar", {});
  const unknownResp = await waitForResponse();
  test("returns error", !!unknownResp.error, "error object");
  test(
    "method not found code",
    unknownResp.error && unknownResp.error.code === -32601,
    "-32601",
  );

  // --- Done ---
  proc.kill();

  console.log(`\n${"=".repeat(22)}`);
  console.log(`PASS: ${passed}  FAIL: ${failed}`);
  console.log(failed === 0 ? "ALL TESTS PASSED" : "SOME TESTS FAILED");
  console.log("");

  process.exitCode = failed === 0 ? 0 : 1;
}

run().catch((err) => {
  console.error("Test runner error:", err);
  process.exitCode = 1;
});

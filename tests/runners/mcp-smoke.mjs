#!/usr/bin/env node

// CLI-agnostic MCP smoke test.
//
// Spawns an MCP stdio server (given as argv after `--`), drives the protocol,
// and asserts the skill-router actually serves skills:
//
//   initialize  -> serverInfo.name === "skill-router"
//   tools/list  -> exposes list_skills and get_skill
//   list_skills -> grouped index names known skills
//   get_skill   -> returns substantial SKILL.md content
//
// This is the "the skills work" proof that is independent of which CLI
// (claude / copilot) launches the server. It needs no network and no model
// subscription — only the local server process.
//
// Usage:  node mcp-smoke.mjs -- npx -y @stuffbucket/skills
// Exit:   0 = all assertions pass, 1 = failure

import { spawn } from "node:child_process";
import readline from "node:readline";

const sep = process.argv.indexOf("--");
const cmd = sep === -1 ? [] : process.argv.slice(sep + 1);
if (cmd.length === 0) {
  console.error("usage: node mcp-smoke.mjs -- <command> [args...]");
  process.exit(2);
}

// Skills that are part of the package's stable core; used as assertion anchors.
const KNOWN_SKILLS = ["skill-creator", "testing-skill"];
const ANCHOR_SKILL = "skill-creator";

let passed = 0;
let failed = 0;
function check(name, ok, detail) {
  if (ok) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

const proc = spawn(cmd[0], cmd.slice(1), {
  stdio: ["pipe", "pipe", "inherit"], // server banners go to stderr; ignore them
});
proc.on("error", (e) => {
  console.error(`failed to spawn ${cmd.join(" ")}: ${e.message}`);
  process.exit(1);
});

const rl = readline.createInterface({ input: proc.stdout });
const waiters = new Map(); // id -> resolve
rl.on("line", (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return; // non-JSON line (defensive); ignore
  }
  if (msg.id != null && waiters.has(msg.id)) {
    waiters.get(msg.id)(msg);
    waiters.delete(msg.id);
  }
});

let nextId = 1;
function rpc(method, params, timeoutMs = 15000) {
  const id = nextId++;
  const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timeout waiting for ${method}`)),
      timeoutMs,
    );
    waiters.set(id, (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
    proc.stdin.write(payload + "\n");
  });
}
function notify(method, params) {
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

// Pull the first text block out of a tools/call result.
function textOf(result) {
  const content = result && result.result && result.result.content;
  if (!Array.isArray(content)) return "";
  const block = content.find((c) => c && c.type === "text");
  return block ? block.text || "" : "";
}

async function main() {
  console.log(`MCP smoke test: ${cmd.join(" ")}`);
  console.log("=".repeat(40));

  // 1. initialize
  const init = await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "mcp-smoke", version: "1.0" },
  });
  const serverName = init.result?.serverInfo?.name;
  check(
    'initialize -> serverInfo.name === "skill-router"',
    serverName === "skill-router",
    `got: ${JSON.stringify(serverName)}`,
  );
  check(
    "initialize -> protocolVersion present",
    typeof init.result?.protocolVersion === "string",
  );
  notify("notifications/initialized", {});

  // 2. tools/list
  const tools = await rpc("tools/list", {});
  const toolNames = (tools.result?.tools || []).map((t) => t.name);
  for (const t of ["list_skills", "get_skill"]) {
    check(`tools/list exposes "${t}"`, toolNames.includes(t), `got: [${toolNames}]`);
  }

  // 3. list_skills (no query) -> grouped index naming known skills
  const list = await rpc("tools/call", { name: "list_skills", arguments: {} });
  const listText = textOf(list);
  check("list_skills returns non-trivial index", listText.length > 200, `len=${listText.length}`);
  for (const s of KNOWN_SKILLS) {
    check(`list_skills mentions "${s}"`, listText.includes(s));
  }
  const nameCount = (listText.match(/`[a-z0-9][a-z0-9-]+`/g) || []).length;
  check("list_skills lists many skills (>= 10)", nameCount >= 10, `counted ${nameCount}`);

  // 4. get_skill -> substantial SKILL.md content
  const got = await rpc("tools/call", {
    name: "get_skill",
    arguments: { name: ANCHOR_SKILL },
  });
  const gotText = textOf(got);
  check(
    `get_skill("${ANCHOR_SKILL}") returns substantial content`,
    gotText.length > 200,
    `len=${gotText.length}`,
  );
  check(
    `get_skill("${ANCHOR_SKILL}") content is about the skill`,
    /skill/i.test(gotText),
  );

  console.log("=".repeat(40));
  console.log(`PASS: ${passed}  FAIL: ${failed}`);
}

main()
  .catch((e) => {
    console.error(`smoke test error: ${e.message}`);
    failed++;
  })
  .finally(() => {
    proc.stdin.end();
    proc.kill();
    process.exit(failed > 0 ? 1 : 0);
  });

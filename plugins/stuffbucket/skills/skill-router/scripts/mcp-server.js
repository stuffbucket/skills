#!/usr/bin/env node

// Minimal MCP-compatible skill router server.
// Exposes two tools:
//   list_skills  — returns the compact index (tiny context cost)
//   get_skill    — returns full SKILL.md content for a named skill
//
// Two modes of operation (auto-detected):
//   TTY (interactive):  human-friendly REPL — type "list", "get <name>", etc.
//   Pipe (MCP client):  JSON-RPC over stdin/stdout per MCP stdio transport spec.
//
// Usage:
//   npx -y -p @stuffbucket/skills stuffbucket-skills   # via published package (offline after first install)
//   node mcp-server.js              # interactive REPL if run in a terminal
//   node mcp-server.js [rootDir]    # MCP mode when piped from a client

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const Fuse = require("fuse.js");
const { createFuse, blendedSearch } = require("./search");
const {
  checkFreshness,
  getUpdateInstructions,
  getUpdateStatusNow,
  getLocalVersion,
} = require("./version-check");

// Resolve the package root where skills and index.json live.
// Priority:
//   1. Explicit CLI arg (node mcp-server.js /path/to/root)
//   2. Package root (derived from __dirname) — works via npx
//   3. cwd — works for local dev when running from repo root
const PACKAGE_ROOT = path.join(__dirname, "..", "..", "..", "..", "..");

function resolveRoot() {
  if (process.argv[2]) return path.resolve(process.argv[2]);
  // If the index exists relative to the package, use that (npx case)
  if (fs.existsSync(path.join(PACKAGE_ROOT, "plugins"))) return PACKAGE_ROOT;
  // Fallback to cwd (local dev, repo root)
  return process.cwd();
}

const ROOT = resolveRoot();
const INDEX_PATH = path.join(__dirname, "..", "index.json");

// Real installed version, read from the package's package.json (not hardcoded).
// Reported in the MCP `initialize` handshake and used by `check_updates`.
const PACKAGE_VERSION = getLocalVersion() || "0.0.0";

// --- Tool definitions (these are what go into the model's context) ---
// Design principles for model-facing tool descriptions:
//   1. Lead with WHEN to call, not what it returns
//   2. Make the zero-arg easy path obvious
//   3. Don't impose sequencing — let the model decide
//   4. Keep descriptions under 30 words
//   5. Use additionalProperties: false for cleaner constrained decoding
const TOOLS = [
  {
    name: "list_skills",
    description:
      "Search the packaged-skill catalog before answering tasks that might match a curated workflow. Catalog covers Tauri (60+ skills), React, design systems, boundary-engineered TypeScript, GLSL/shaders, GitHub Pages, Azure CLI, git, Docker, code review, evals, and more. Call with no arguments to browse families grouped by root, or pass a natural-language query (e.g. 'tauri vibrancy', 'react performance', 'review my pull request'). Each result includes a 'use when' trigger sentence. Users can force-route by including the phrase 'use stuffbucket' in their request. Costs almost nothing and avoids reinventing solutions the catalog already encodes.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Keyword to filter skills by name, description, or tags. Omit to return all.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_skill",
    description:
      "Load a skill's full instructions by name. Skill names are kebab-case identifiers from list_skills.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Skill name, e.g. code-analysis-skill.",
        },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "check_updates",
    description:
      "Check whether a newer @stuffbucket/skills release is on npm. Returns { current, latest, update_available, checked_at, last_error, enabled }. Notify-only — to apply, load the update-skills skill.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

// --- Load index ---
function loadIndex() {
  if (!fs.existsSync(INDEX_PATH)) {
    return { skills: [] };
  }
  return JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
}

// --- Load semantic index (optional — enhances search when present) ---
const SEMANTIC_PATH = path.join(__dirname, "..", "semantic-index.json");

function loadSemanticIndex() {
  if (!fs.existsSync(SEMANTIC_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(SEMANTIC_PATH, "utf8"));
  } catch {
    return null;
  }
}

// --- Shared search (search.js) ---

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

// Find the best fuzzy match for a skill name in get_skill.
// Returns { exact, matches[] } where matches are sorted by relevance.
function fuzzyFindSkill(skills, name) {
  const q = name.toLowerCase().trim();

  // 1. Exact match on name
  const exact = skills.find((s) => s.name === q);
  if (exact) return { exact, matches: [exact] };

  // 2. Prefix match (e.g., "file-management" → "file-management-skill")
  const prefixMatches = skills.filter(
    (s) => s.name.startsWith(q) || q.startsWith(s.name),
  );
  if (prefixMatches.length === 1)
    return { exact: prefixMatches[0], matches: prefixMatches };

  // 3. Fuse.js fuzzy search across all fields
  const fuseResults = searchSkills(q);
  if (fuseResults.length > 0) {
    // If the top result is clearly better (Fuse sorts by score), use it
    if (fuseResults.length === 1) {
      return { exact: fuseResults[0], matches: fuseResults };
    }
    // Check if there's a strong top match (name contains the query)
    if (fuseResults[0].name.includes(q) || q.includes(fuseResults[0].name)) {
      return { exact: fuseResults[0], matches: fuseResults };
    }
    return { exact: null, matches: fuseResults };
  }

  return { exact: null, matches: [] };
}

// --- Tool handlers ---

// Group skills by prefix family for the empty-query case.
// A "family root" is a skill whose name is the shared prefix of >=2 other skills
// (e.g. `tauri` is root for `tauri-architecture`, `tauri-bundling`, …).
// Returns markdown with families first, "Other" bucket last.
function groupByFamily(skills) {
  const byName = new Map(skills.map((s) => [s.name, s]));

  // First pass: figure out which first-segment prefixes have >=2 skills
  // (the root itself, if present, doesn't count toward the 2 — we want >=2 children OR root+2 children).
  const firstSegBuckets = new Map();
  for (const s of skills) {
    const seg = s.name.split("-")[0];
    if (!firstSegBuckets.has(seg)) firstSegBuckets.set(seg, []);
    firstSegBuckets.get(seg).push(s);
  }

  // A family qualifies if it has >=3 skills sharing the first segment,
  // OR has an explicit root skill (name === seg) plus >=2 others.
  const families = [];
  const claimed = new Set();
  for (const [seg, members] of firstSegBuckets.entries()) {
    const root = byName.get(seg);
    const nonRoot = members.filter((m) => m.name !== seg);
    if ((root && nonRoot.length >= 2) || members.length >= 3) {
      families.push({ seg, root, members });
      for (const m of members) claimed.add(m.name);
    }
  }

  // Sort families by size, largest first
  families.sort((a, b) => b.members.length - a.members.length);

  const other = skills.filter((s) => !claimed.has(s.name));

  const lines = [];
  const truncDesc = (d, n = 140) => {
    if (!d) return "";
    const oneLine = d.replace(/\s+/g, " ").trim();
    return oneLine.length > n ? oneLine.slice(0, n - 1) + "…" : oneLine;
  };

  for (const fam of families) {
    const { seg, root, members } = fam;
    const heading = root
      ? `## ${seg} (${members.length} skills, including root)`
      : `## ${seg} (${members.length} skills)`;
    lines.push(heading);

    // Sort members: root first, then alphabetically
    const sorted = [...members].sort((a, b) => {
      if (a.name === seg) return -1;
      if (b.name === seg) return 1;
      return a.name.localeCompare(b.name);
    });

    // Build indent depth: count hyphens beyond the root segment.
    // Examples (root = "tauri"):
    //   tauri                          -> depth 0
    //   tauri-architecture             -> depth 1
    //   tauri-architecture-ipc-internals -> depth 2 (if tauri-architecture exists as a member)
    const memberNames = new Set(sorted.map((m) => m.name));
    const depthFor = (name) => {
      if (name === seg) return 0;
      // Walk back through hyphenated prefixes and count intermediate members
      const parts = name.split("-");
      let depth = 1;
      // intermediate prefixes between root and this name
      for (let i = 2; i < parts.length; i++) {
        const prefix = parts.slice(0, i).join("-");
        if (memberNames.has(prefix)) depth++;
      }
      return depth;
    };

    for (const m of sorted) {
      const depth = depthFor(m.name);
      const indent = "  ".repeat(depth);
      lines.push(`${indent}- \`${m.name}\` — ${truncDesc(m.description)}`);
    }
    lines.push("");
  }

  if (other.length > 0) {
    lines.push(`## Other (${other.length} skills)`);
    other.sort((a, b) => a.name.localeCompare(b.name));
    for (const s of other) {
      lines.push(`- \`${s.name}\` — ${truncDesc(s.description)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function handleListSkills(params) {
  const query = params && params.query;
  const skills = searchSkills(query);

  // Check for available updates (lazy, cached, non-blocking)
  const updateInfo = checkFreshness();
  const updateBanner = updateInfo
    ? `Update available: ${updateInfo.localVersion} → ${updateInfo.latestVersion}. Call get_skill('update-skills') for instructions.\n\n`
    : "";

  // Empty-query path: grouped markdown by family.
  if (!query) {
    const grouped = groupByFamily(skills);
    return {
      content: [
        {
          type: "text",
          text: updateBanner + grouped,
        },
      ],
    };
  }

  // Query path: existing JSON shape (unchanged).
  const summaries = skills.map((s) => ({
    name: s.name,
    description: s.description,
    tags: s.tags,
  }));

  if (updateInfo) {
    summaries.unshift({
      name: "update-skills",
      description: `Update available: ${updateInfo.localVersion} → ${updateInfo.latestVersion}. Call get_skill('update-skills') for instructions.`,
      tags: ["update", "maintenance"],
    });
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(summaries, null, 2),
      },
    ],
  };
}

// Build a markdown "Related skills" footer for get_skill responses.
// Uses blendedSearch with the loaded skill's name + description as the query,
// excludes the skill itself, and returns the top 5 as markdown bullets.
function buildRelatedFooter(skill) {
  try {
    const query = `${skill.name} ${skill.description || ""}`.trim();
    if (!query) return "";

    const results = searchSkills(query).filter((s) => s.name !== skill.name);
    const top = results.slice(0, 5);
    if (top.length === 0) return "";

    const trunc = (d, n = 100) => {
      if (!d) return "";
      const oneLine = d.replace(/\s+/g, " ").trim();
      return oneLine.length > n ? oneLine.slice(0, n - 1) + "…" : oneLine;
    };

    const lines = ["", "---", "", "## Related skills", ""];
    for (const s of top) {
      lines.push(`- \`${s.name}\` — ${trunc(s.description)}`);
    }
    lines.push("");
    return "\n" + lines.join("\n");
  } catch {
    return "";
  }
}

function handleGetSkill(params) {
  if (!params || !params.name) {
    return {
      content: [{ type: "text", text: "Error: name parameter is required." }],
      isError: true,
    };
  }

  // Handle the virtual "update-skills" skill
  if (params.name === "update-skills") {
    const updateInfo = checkFreshness();
    const instructions = getUpdateInstructions(updateInfo);
    if (instructions) {
      return { content: [{ type: "text", text: instructions }] };
    }
    return {
      content: [{ type: "text", text: "@stuffbucket/skills is up to date." }],
    };
  }

  const { searcher: s } = getSearcher();
  const { exact, matches } = fuzzyFindSkill(s.items, params.name);

  if (exact) {
    const skillMdPath = path.join(ROOT, exact.path, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) {
      return {
        content: [
          {
            type: "text",
            text: `SKILL.md not found at ${exact.path}/SKILL.md`,
          },
        ],
        isError: true,
      };
    }

    const content = fs.readFileSync(skillMdPath, "utf8");

    // If name wasn't an exact string match, note the resolution
    const resolved =
      exact.name !== params.name.toLowerCase().trim()
        ? `Resolved "${params.name}" → ${exact.name}\n\n`
        : "";

    // Build a "Related skills" footer with top-5 siblings by blended search
    // against (name + description). Falls back to Fuse-only when no semantic idx.
    const relatedFooter = buildRelatedFooter(exact);

    return {
      content: [{ type: "text", text: resolved + content + relatedFooter }],
    };
  }

  // No exact match — provide suggestions
  if (matches.length > 0) {
    const suggestions = matches
      .slice(0, 3)
      .map((s) => `  ${s.name}: ${s.description}`)
      .join("\n");
    return {
      content: [
        {
          type: "text",
          text: `No exact match for "${params.name}". Did you mean:\n${suggestions}\n\nCall get_skill with one of these names.`,
        },
      ],
      isError: true,
    };
  }

  const available = s.items.map((sk) => sk.name).join(", ");
  return {
    content: [
      {
        type: "text",
        text: `Skill "${params.name}" not found. Available: ${available}`,
      },
    ],
    isError: true,
  };
}

// Explicit update check (check_updates tool). Notify-only: reports status,
// never installs. Awaits a fresh registry check so a client gets a real answer
// without having to call list_skills first.
async function handleCheckUpdates() {
  const status = await getUpdateStatusNow();
  return {
    content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
  };
}

// --- MCP stdio transport ---
async function handleRequest(request) {
  const { method, params, id } = request;

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: "skill-router",
            version: PACKAGE_VERSION,
          },
        },
      };

    case "notifications/initialized":
      return null;

    case "ping":
      return { jsonrpc: "2.0", id, result: {} };

    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: { tools: TOOLS },
      };

    case "tools/call": {
      const toolName = params && params.name;
      const toolArgs = (params && params.arguments) || {};
      let result;

      if (toolName === "list_skills") {
        result = handleListSkills(toolArgs);
      } else if (toolName === "get_skill") {
        result = handleGetSkill(toolArgs);
      } else if (toolName === "check_updates") {
        result = await handleCheckUpdates();
      } else {
        result = {
          content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
          isError: true,
        };
      }

      return { jsonrpc: "2.0", id, result };
    }

    default:
      // Ignore unknown notifications (no id), error on unknown requests
      if (id === undefined || id === null) return null;
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

// --- Main loop ---

if (process.stdin.isTTY) {
  // Interactive REPL mode — synthesize JSON-RPC from human-friendly commands
  startRepl();
} else {
  // MCP stdio transport — raw JSON-RPC over stdin/stdout
  startMcpTransport();
}

function startMcpTransport() {
  const rl = readline.createInterface({ input: process.stdin });

  rl.on("line", async (line) => {
    try {
      const request = JSON.parse(line);
      const response = await handleRequest(request);
      if (response) {
        process.stdout.write(JSON.stringify(response) + "\n");
      }
    } catch (err) {
      const errorResponse = {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error: " + err.message },
      };
      process.stdout.write(JSON.stringify(errorResponse) + "\n");
    }
  });
}

function startRepl() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "skill-router> ",
  });

  console.log("skill-router interactive mode");
  console.log("Commands:");
  console.log("  list [query]        List skills, optionally filtered");
  console.log("  get <name>          Load a skill by name (fuzzy matching)");
  console.log("  check               Check npm for a newer release");
  console.log("  tools               Show available MCP tool definitions");
  console.log("  help                Show this help");
  console.log("  quit                Exit");
  console.log("");

  rl.prompt();

  rl.on("line", (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    const [cmd, ...rest] = input.split(/\s+/);
    const arg = rest.join(" ");

    switch (cmd.toLowerCase()) {
      case "list":
      case "ls": {
        const result = handleListSkills(arg ? { query: arg } : {});
        printResult(result);
        break;
      }

      case "get":
      case "load": {
        if (!arg) {
          console.log("Usage: get <skill-name>\n");
          break;
        }
        const result = handleGetSkill({ name: arg });
        printResult(result);
        break;
      }

      case "check":
      case "updates": {
        handleCheckUpdates().then(printResult);
        break;
      }

      case "tools": {
        for (const tool of TOOLS) {
          console.log(`  ${tool.name}`);
          console.log(`    ${tool.description}`);
          const params = Object.keys(tool.inputSchema.properties || {});
          if (params.length) {
            console.log(`    params: ${params.join(", ")}`);
          }
        }
        console.log("");
        break;
      }

      case "help":
      case "?": {
        console.log("  list [query]        List skills, optionally filtered");
        console.log(
          "  get <name>          Load a skill by name (fuzzy matching)",
        );
        console.log(
          "  tools               Show available MCP tool definitions",
        );
        console.log("  help                Show this help");
        console.log("  quit                Exit");
        console.log("");
        break;
      }

      case "quit":
      case "exit":
      case "q": {
        rl.close();
        return;
      }

      default: {
        // Treat bare input as a fuzzy get_skill attempt
        const result = handleGetSkill({ name: input });
        printResult(result);
        break;
      }
    }

    rl.prompt();
  });

  rl.on("close", () => {
    process.exit(0);
  });
}

function printResult(result) {
  if (!result || !result.content) return;
  for (const item of result.content) {
    if (item.type === "text") {
      console.log(item.text);
    }
  }
  if (result.isError) {
    console.log("");
  }
  console.log("");
}

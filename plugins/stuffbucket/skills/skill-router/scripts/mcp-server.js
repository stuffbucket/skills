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
//   npx @stuffbucket/skills         # via published package (offline after first install)
//   node mcp-server.js              # interactive REPL if run in a terminal
//   node mcp-server.js [rootDir]    # MCP mode when piped from a client

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { createFuse, blendedSearch } = require("./search");

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
      "Discover available skills. Call with no arguments to see all skills, or pass a query to filter by keyword.",
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
  searcher = createFuse(cachedSkills);
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
function handleListSkills(params) {
  const skills = searchSkills(params && params.query);

  const summaries = skills.map((s) => ({
    name: s.name,
    description: s.description,
    tags: s.tags,
  }));

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(summaries, null, 2),
      },
    ],
  };
}

function handleGetSkill(params) {
  if (!params || !params.name) {
    return {
      content: [{ type: "text", text: "Error: name parameter is required." }],
      isError: true,
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

    return {
      content: [{ type: "text", text: resolved + content }],
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

// --- MCP stdio transport ---
function handleRequest(request) {
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
            version: "1.0.0",
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

  rl.on("line", (line) => {
    try {
      const request = JSON.parse(line);
      const response = handleRequest(request);
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

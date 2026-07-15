# SkillOps: Industry Landscape and Repo Positioning

Research brief (mid-2026) on how agent **skills** have evolved across Anthropic, OpenAI, Vercel, and
GitHub Copilot, and where `@stuffbucket/skills` sits in that landscape. "SkillOps" is the working
name for the pattern this repo already leans on: an MCP tool returns a *guidance document* for an
area of concern (e.g. `design`), the model plans against it, then loads the specific leaf skills it
needs. This document exists to orient future work — it is research, not a spec.

## TL;DR

- **The `SKILL.md` folder format is now an open standard** (`agentskills.io`, published Dec 18, 2025)
  and has been adopted by Anthropic, OpenAI (Codex/ChatGPT), GitHub Copilot, Vercel, Google
  (Antigravity/Gemini CLI), and Cursor within weeks. This repo's authoring contract (`name` ≤64
  kebab, `description` ≤1024, `references/` overflow, optional `license`/`metadata`/`compatibility`/
  `allowed-tools`) is essentially identical to that standard — strong validation and high
  portability.
- **Everyone converged on "progressive disclosure"**: load only skill `name`+`description` up front
  (~100 tokens each), load the full `SKILL.md` body only when triggered, load bundled
  `scripts`/`references`/`assets` only when read. This is the exact L1→L2→L3 model.
- **The differentiator here is the transport.** The mainstream model discovers skills by *filesystem
  scan* + model relevance. This repo discovers them through a two-tool **MCP router**
  (`list_skills`/`get_skill`) with blended semantic + keyword search — constant tool-count as the
  catalog grows. The closest industry parallels are GitHub's **Agent Finder / ARD** and Vercel's AI
  SDK **`loadSkill`** cookbook.
- **The "returns-a-document-then-plan" pattern is real and industry-wide**, and this repo already
  implements a strong version of it via root-index skills (`design`, `boundary`, `tauri`, `pages`,
  `react`) whose `get_skill` response is a routing table + decision flow, not an action.

## Timeline (2025–2026)

| Date | Event |
| --- | --- |
| Jun 13, 2025 | Anthropic "How we built our multi-agent research system" — orchestrator-worker, 3–5 parallel subagents, +90.2% vs single agent, ~15× tokens. |
| ~Sep 29, 2025 | Claude **Code** SDK renamed to Claude **Agent** SDK; `ClaudeCodeOptions` → `ClaudeAgentOptions`. |
| Oct 2, 2025 | Anthropic API Skills beta header `skills-2025-10-02` (earliest dated Skills API surface). |
| Oct 16, 2025 | **Anthropic Agent Skills public launch** across claude.ai, Claude Code, API, Agent SDK; pre-built pptx/xlsx/docx/pdf skills. |
| Oct 2025 | Claude Code **plugins + marketplaces** (public beta): bundle skills, agents, hooks, MCP servers. |
| Oct 6, 2025 | OpenAI DevDay: **AgentKit** (Agent Builder, ChatKit, Connector Registry), **Apps SDK** (MCP servers with UI). |
| Oct 23, 2025 | **Vercel Agent** public beta — "two core skills: Code Review and Investigations." |
| Nov 4, 2025 | Anthropic "Code execution with MCP" — expose MCP servers as on-demand code modules; load tool defs lazily. |
| Dec 18, 2025 | **Agent Skills published as open standard** (`agentskills.io`). OpenAI (Codex/ChatGPT) and GitHub Copilot add support within 48h; Microsoft wires it into VS Code. |
| Dec 22, 2025 | **AI SDK 6** stable — `ToolLoopAgent`, stable MCP (HTTP/OAuth/resources/prompts), `needsApproval`. |
| Jan 2026 | Vercel **`skills` CLI + skills.sh** registry/leaderboard. Standard spreads to Google Antigravity, Cursor, Gemini CLI (20+ tools). |
| Feb 25, 2026 | **GitHub Copilot CLI GA.** |
| Apr 15, 2026 | OpenAI "next evolution of the Agents SDK" — model-native harness, native sandbox execution. |

## Per-vendor summary

### Anthropic (the source standard)

- **Canonical Skill:** a directory with a required `SKILL.md` (YAML frontmatter `name` + `description`
  required; `name` ≤64 chars, no reserved words "anthropic"/"claude"; `description` ≤1024 chars and
  "must include both what the Skill does and when Claude should use it"), plus bundled
  instructions/code/resources.
- **Three-level progressive disclosure** (verbatim from the docs): L1 metadata (~100 tokens/skill,
  always in system prompt) → L2 `SKILL.md` body (<5k tokens, read via bash when triggered) → L3
  resources (no context cost until a file is read or a script's output returns).
- **No separate router:** the base model matches intent against L1 `description` text. The Agent SDK
  adds a `skills` filter option and a built-in `Skill` tool; skills are **filesystem-only** in the
  SDK (no programmatic registration).
- **Distribution/governance:** Claude Code plugins + marketplaces; approved plugins pinned to a
  commit SHA. Custom slash-commands have been **merged into skills**.
- **MCP interplay:** "Code execution with MCP" (Nov 2025) applies the same on-demand-disclosure idea
  to *tools* — expose MCP servers as filesystem code modules and load definitions lazily. MCP's
  `prompts` primitive lets a server hand the model a reusable workflow template — the native MCP
  analogue of "server returns a guidance document."
- Key docs: `platform.claude.com/docs/en/agents-and-tools/agent-skills/overview`,
  `code.claude.com/docs/en/skills`, `code.claude.com/docs/en/agent-sdk/skills`,
  `code.claude.com/docs/en/plugins`.

### OpenAI

- **Adopted the open standard** in Codex (`~/.codex/skills`, `SKILL.md` + frontmatter) — same
  three-tier progressive disclosure; "Codex loads the full `SKILL.md` instructions only when it
  decides to use a skill." Skills written for Claude Code run in Codex.
- **Split model:** always-on `AGENTS.md` (layered, loaded at session start) vs on-demand Skills.
  OpenAI's own framing: "always run your linter before a PR → AGENTS.md; follow a specific review
  workflow when asked → a Skill."
- **Other capability primitives:** Responses API + Agents SDK **tools** (function/hosted/MCP),
  **GPTs** (instructions + knowledge + Actions), **Apps SDK** (capability = MCP server + UI).
  Routing lives in Agents SDK **handoffs** (triage agent delegates) and the **manager**
  (agents-as-tools) patterns.
- Discovery is closer to a static manifest (name/description/path given at session start) than a
  queryable router.

### Vercel

- **Two tracks:** (1) Anthropic-style `SKILL.md` skills — adopted verbatim; (2) "skills" as a
  product label inside Vercel Agent (Code Review, Investigations), a naming overlap only.
- **Reference router implementation:** the AI SDK cookbook "Add Skills to Your Agent" implements the
  discover → advertise (`name: description` lines in the system prompt) → `loadSkill` (read body,
  strip frontmatter, return `{skillDirectory, content}`) → act (generic `readFile`/`bash`) loop —
  the same two-step as this repo, but via an in-process tool rather than MCP.
- **Distribution:** `vercel-labs/skills` CLI installs skills by **symlinking/copying** folders into
  each agent's on-disk dir; `skills.sh` registry + leaderboard. Notably, `vercel/vercel-plugin`
  **discovers skills declared in `.claude-plugin/marketplace.json` / `plugin.json`** — the same
  manifest files this repo already ships.
- **Dynamic tool selection:** AI SDK `prepareStep` + `activeTools` narrow the toolset per step;
  `stopWhen` controls the loop. Embedding-based skill selection exists only in the community
  (`toolpick`), not first-party.
- **Positioning line:** Vercel keeps Skills (passive instructions, on disk, no credentials) and MCP
  (active tools, auth) *separate*. This repo deliberately does **skills-over-MCP** — the sharpest
  architectural contrast to draw.

### GitHub Copilot

- **Adopted the open standard** (Dec 18, 2025): `SKILL.md` in `.github/skills/`, `.claude/skills/`,
  `.agents/skills/`, `~/.copilot/skills/`; frontmatter `name` ≤64 / `description` ≤1024 /
  `allowed-tools` / `user-invocable` / `disable-model-invocation` — nearly identical to this repo's
  contract. `gh skill` installs from repos and writes provenance (source repo, ref, tree SHA) for
  drift detection.
- **Seven customization surfaces:** always-on custom instructions (`copilot-instructions.md`,
  path-scoped `*.instructions.md` with `applyTo` globs, `AGENTS.md`), manual prompt files
  (`*.prompt.md`), custom agents (`*.agent.md`), subagents, **Agent Skills** (the only
  relevance-loaded surface), hooks, and MCP servers.
- **The closest ARD/router analog:** **Agent Finder / Agentic Resource Discovery (ARD)** — "a
  discovery service that … searches a catalog of capabilities and returns ranked matches that GitHub
  Copilot can use on demand," implementing the open ARD spec. It is itself **distributed as a
  skill** (drop its `SKILL.md` into `~/.copilot/skills`). This is essentially this repo's
  `list_skills`/`get_skill` router in a draft-spec wrapper — the shape matches, but ARD is nascent
  (see the maturity caveat under "Watch / interoperate"), so read this as convergent design, not a
  standard to adopt. Catalog: `github.com/agentfinder`; spec: `ards-project`.
- Older lineage: **Skillsets** (2024 Copilot Extensions) route over ≤5 remote API endpoints via
  natural-language inference descriptions — a server-side router, different lineage from `SKILL.md`.

## The "returns-a-guidance-document-then-plan" pattern

This is the SkillOps core, and it recurs everywhere:

- **Progressive disclosure itself** (all vendors): L1 description is the "guidance about which
  capability to use," L2 body is the "guidance document," bundled code/resources are the "act."
- **This repo's root-index skills** (`design`, `boundary`, `tauri`, `pages`, `react`): `get_skill`
  returns a routing table + numbered *Decision flow* + cross-family edges — a plan the model executes
  by loading leaf skills. `get_skill` also appends a "Related skills" footer, reinforcing plan-then-act.
- **GitHub Agent Finder / ARD:** catalog search → ranked matches → load on demand.
- **Vercel `loadSkill`:** advertise descriptions → model calls `loadSkill` → act.
- **OpenAI Codex Skills + Agents SDK handoffs:** metadata-first selection; triage agent routes to a
  specialist that owns the next step.
- **Anthropic "Code execution with MCP" + MCP `prompts`:** the tool-side version — return/expose
  definitions on demand instead of loading everything up front.

## Where `@stuffbucket/skills` sits

**Convergent (keep, it's now standard):** `SKILL.md` + frontmatter contract, progressive disclosure,
`references/` overflow, plugin/marketplace manifests, the two-level parent/child family pattern
(Tauri) mirroring orchestrator-worker specialization.

**Differentiated (the moat):**

- **Skills-over-MCP router** — one server, constant tool-count, intent search, centralized
  versioning/provenance — vs the mainstream decentralized filesystem scan.
- **Blended semantic + keyword search** (`semantic-index.json` + Fuse.js) — most vendors just inject
  `name: description` lines and let the model choose; embedding ranking is left to the community.
- **Root-index "planning document" skills** — an explicit, curated version of the two-step pattern
  the rest of the industry does implicitly.

**Watch / interoperate:**

- **ARD (Agentic Resource Discovery)** is a draft spec for exactly this router layer — *watch, don't
  bet yet.* Announced ~June 2026 with a long roster of named backers (Microsoft, Google, GitHub,
  Cisco, Databricks, Hugging Face, Nvidia, Salesforce, ServiceNow, Snowflake), but that roster is an
  announcement, not a commit graph: the `ards-project` org is small (`ard-spec` ~375 stars, the other
  repos in the low tens, ~47 followers) and the only shipping *harness* that consumes it is GitHub
  Copilot's Agent Finder. Do **not** conflate its maturity with the `SKILL.md`/`agentskills.io`
  standard (§below), which is genuinely broadly adopted — ARD is a separate, month-old proposal for
  the discovery layer with one real consumer. Track it as a possible future interop target; the value
  today is that it validates the router *shape*, not that it's a safe standard to implement against.
- **Always-on tier.** OpenAI/Copilot pair on-demand Skills with always-on `AGENTS.md`. This repo has
  no always-on instruction tier beyond the README priming snippet — a gap to consider mirroring.
- **`agentskills.io` conformance + `AGENTS.md` presence** would make every skill here portable to
  Codex/Copilot/Cursor/Gemini with no changes.

## Improvement backlog (surfaced by this review)

Prioritized; see the session summary for detail. These are findings, not yet actioned.

1. **Semantic index is dark in the published package.** `mcp-server.js` reads `semantic-index.json`,
   but the only builder is `site/scripts/build-semantic-index.js` (needs `@huggingface/transformers`,
   reads a `site/` artifact). `npm run build:index` and `prepublishOnly` build only the keyword
   `index.json`; `publish.yml` runs `build:index` then `npm publish` and never builds the site. npm
   silently skips the missing `semantic-index.json` in `files`, so the shipped router falls back to
   keyword-only search. **Fix:** add a first-party `build:semantic` step wired into `build:index`/
   `prepublishOnly`/`publish.yml`, or vendor a committed semantic index.
2. **`CLAUDE.md` inaccuracy.** It says the index files are "committed and shipped"; they are
   `.gitignore`d and only built at publish time (and semantic never is). Reconcile the doc with
   reality once (1) is decided.
3. **`agentskills.io` conformance pass.** Validate the repo's authoring contract against the
   published open standard and note any drift in `spec/agent-skills-spec.md`.
4. **Consider an `AGENTS.md` / always-on tier** to match the OpenAI/Copilot split (conditional
   Skills vs persistent guidance).
5. **Track ARD** (low priority) — a month-old draft spec with one real consumer (Copilot Agent
   Finder), not an established standard. Watch for real multi-harness adoption before investing; do
   not treat it as a safe interop target yet.
6. **Cross-host distribution.** Given Vercel-plugin and Copilot both consume `.claude-plugin`
   manifests and `SKILL.md` dirs, document/verify this repo's skills installing cleanly into
   `.github/skills` / Vercel `skills` CLI / Codex.

## Sourcing note

Compiled from official docs and vendor posts (Anthropic `platform.claude.com` / `code.claude.com`;
OpenAI `developers.openai.com` / DevDay; Vercel AI SDK cookbook + changelogs; GitHub `github.blog` /
`docs.github.com` / `github/docs` source). Several `anthropic.com/engineering/*`, `vercel.com`, and
`docs.github.com` pages return 403 to automated fetchers; figures from those (e.g. the ~98.7%
code-execution-MCP token reduction, the ~600k skills.sh figure) are secondary-sourced and flagged as
approximate. Full per-vendor reports with per-claim citations are in the session record.

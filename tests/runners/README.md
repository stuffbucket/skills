# CLI runners (Docker-isolated, subscription-free)

These runners prove that the skills load and serve correctly when launched by a
real AI-assistant CLI — both the **Claude Code CLI** (`claude`) and the **GitHub
Copilot CLI** (`copilot`) — from a clean, isolated container, with **no model
subscription** and **no network**.

## How the "no subscription" guarantee works

Images are **built with network** (to install the CLI and the package under
test), then each runner is **executed with `docker run --network none`**. With
the network removed, the container provably cannot reach any model API or the
npm registry — so everything asserted is static wiring + the local MCP server,
never a paid model call.

The build under test is installed **locally** into `/work`, so the exact
documented launch command — `npx -y @stuffbucket/skills` — resolves offline from
that directory (npx prefers a local `node_modules` install). This is what
catches the original bug: if `package.json` doesn't expose a `skills` bin, that
command fails and the runner goes red.

## Usage

```sh
tests/runners/run.sh            # build the tarball + both images, run both
tests/runners/run.sh claude     # only the Claude Code CLI runner
tests/runners/run.sh copilot    # only the GitHub Copilot CLI runner
```

`run.sh` packs the current working tree (`npm run build:index && npm pack`), so
it always tests your local build, not whatever is published to npm.

## What each runner asserts

**Claude (`claude-runner.sh`)**

1. `claude` runs offline (no login).
2. `claude mcp add skill-router -- npx -y @stuffbucket/skills` registers the
   server with the documented command.
3. `claude mcp list` health-checks and reports **`✓ Connected`**.
4. The shared protocol smoke test passes.

**Copilot (`copilot-runner.sh`)**

1. `copilot` runs offline (no login).
2. `copilot mcp add skill-router -- npx -y @stuffbucket/skills` registers it.
3. `copilot mcp get skill-router --json` persists `npx` + `@stuffbucket/skills`.
   (Copilot only health-checks servers at agent runtime, which needs auth, so
   the smoke test below stands in for that offline.)
4. The shared protocol smoke test passes.

**Shared protocol smoke (`mcp-smoke.mjs`, CLI-agnostic)**

Drives the MCP server over stdio and asserts it actually serves skills:

- `initialize` → `serverInfo.name === "skill-router"`
- `tools/list` → exposes `list_skills` and `get_skill`
- `list_skills` → grouped index naming known skills (`skill-creator`,
  `testing-skill`) and listing many entries
- `get_skill("skill-creator")` → substantial SKILL.md content

It takes the server command as `node mcp-smoke.mjs -- <command> [args...]`, so it
can exercise the same `npx -y @stuffbucket/skills` invocation the CLIs use.

## Images

Both runners use a small **`node:24-alpine`** base (Copilot requires Node 24+).
Only what each CLI needs is added — `bash` + `ca-certificates` for Claude, plus
`libstdc++`/`libgcc` for Copilot's native binary — and the npm cache is cleaned
in each layer. Approximate sizes (arm64):

| Runner  | Image    |
| ------- | -------- |
| claude  | ~550 MB  |
| copilot | ~825 MB  |

The size is dominated by the CLI packages themselves (the Copilot native binary
alone is ~127 MB), not the base distro.

**Copilot on musl:** the Copilot CLI ships a musl build, but its native *agent*
binary currently segfaults on startup under Alpine/musl (an upstream bug — it
prints a benign `terminated by signal SIGSEGV` line). That binary is never used
by the config commands this runner exercises (`mcp add/list/get` fall back to
JS) or by `mcp-smoke.mjs` (plain node), so the runner passes. `copilot-runner.sh`
filters only that one known-benign line so a genuine error would still surface.

## Requirements

- Docker (daemon running).
- Network access **for the build step only**; the test step runs with
  `--network none`.

CLI versions are pinned in the Dockerfiles for reproducibility.

# CLI runners (keyless install + MCP-registration proof)

These runners prove that `@stuffbucket/skills` **installs** and **registers its
MCP server** when driven by a real AI-assistant CLI — the **Claude Code**
(`claude`), **GitHub Copilot** (`copilot`), and **OpenAI Codex** (`codex`) CLIs —
from a clean container, with **no model API key and no connection to an LLM**.

They run each CLI from the shared, single-purpose images published by
[`stuffbucket/ai-cli-images`](https://github.com/stuffbucket/ai-cli-images):
`ghcr.io/stuffbucket/ai-cli-{claude,copilot,codex}`.

## How the "no LLM" guarantee works

No auth env var is ever set (`ANTHROPIC_API_KEY`, `GH_TOKEN`, `OPENAI_API_KEY`,
…), so the CLIs cannot make a model call. The meaningful assertions don't need
one anyway: registering an MCP server, health-checking it, and calling its tools
are all **local** operations — the MCP server is a plain stdio process, and the
API key only gates the *model*, not the MCP. npm network is used only to fetch
the CLI (for the deferred-install images) and the package's runtime deps.

The build under test is installed **locally** (from `npm pack`) into a fresh
workdir inside the container, so the documented launch command —
`npx -y @stuffbucket/skills` — resolves to the local build, never whatever is
published to npm. This is what catches a broken launch: if `package.json`
doesn't expose a `skills` bin, that command fails and the runner goes red.

## Usage

```sh
tests/runners/run.sh                 # all three runners
tests/runners/run.sh claude          # one (claude | copilot | codex)
tests/runners/run.sh claude codex    # a subset
```

`run.sh` packs the current working tree (`npm run build:index && npm pack`), so
it always tests your local build.

| Env | Default | Meaning |
| --- | --- | --- |
| `AI_CLI_REGISTRY` | `ghcr.io/stuffbucket` | image registry / namespace |
| `AI_CLI_TAG` | `latest` | image tag |
| `AI_CLI_PULL` | (unset) | `1` = always `docker pull` (CI). Default reuses a same-named local image if present, else pulls. |

### Running before the GHCR images are public

The `ai-cli-*` packages are pulled anonymously in CI once they're public. Until
then (or for offline local work), build them once from the `ai-cli-images`
checkout and `run.sh` will reuse them automatically:

```sh
docker build -t ghcr.io/stuffbucket/ai-cli-claude  <ai-cli-images>/images/claude-code
docker build -t ghcr.io/stuffbucket/ai-cli-copilot <ai-cli-images>/images/copilot
docker build -t ghcr.io/stuffbucket/ai-cli-codex   <ai-cli-images>/images/codex
```

## How a runner works

`run.sh` overrides each image's entrypoint (the CLI) with `bash` and runs the
matching `<cli>-runner.sh`, with `tests/runners/` bind-mounted read-only at
`/opt/runner` (so `pkg.tgz` and `mcp-smoke.mjs` are available). Shared steps live
in `lib.sh`:

- `ensure_cli` — installs the deferred CLI (`claude`/`copilot`) the same way the
  image's bootstrap entrypoint would (no-op for the baked-in `codex`).
- `setup_local_build` — installs `pkg.tgz` into a fresh workdir so
  `npx -y @stuffbucket/skills` resolves the local build, and `cd`s there.
- `smoke` — runs the CLI-agnostic `mcp-smoke.mjs` against the launch command.

## What each runner asserts

**Claude (`claude-runner.sh`)**

1. the (deferred) `claude` CLI installs and runs, keyless.
2. `claude mcp add stuffbucket -- npx -y @stuffbucket/skills` registers it.
3. `claude mcp list` health-checks and reports **`✓ Connected`** — keyless.
4. the shared protocol smoke passes.

**Copilot (`copilot-runner.sh`)**

1. the (deferred) `copilot` CLI installs and runs, keyless.
2. `copilot mcp add stuffbucket -- npx -y @stuffbucket/skills` registers it.
3. `copilot mcp get stuffbucket --json` persists `npx` + `@stuffbucket/skills`.
   (Copilot only health-checks at agent runtime, which needs auth, so the smoke
   below stands in for that keyless.)
4. the shared protocol smoke passes.

**Codex (`codex-runner.sh`)**

1. the (baked-in) `codex` CLI runs, keyless.
2. `codex mcp add stuffbucket -- npx -y @stuffbucket/skills` registers it.
3. `codex mcp list` shows it **enabled** and `config.toml` has
   `[mcp_servers.stuffbucket]`. (Codex also only contacts a model at agent
   runtime, so the smoke stands in for a live check.)
4. the shared protocol smoke passes.

**Shared protocol smoke (`mcp-smoke.mjs`, CLI-agnostic)**

Drives the MCP server over stdio and asserts it actually serves skills — this is
the part that *calls the MCP*, and it works without a key because the server is
local:

- `initialize` → `serverInfo.name === "skill-router"` (the server's protocol
  name; the registration key is `stuffbucket`, per the canonical `.mcp.json`).
- `tools/list` → exposes `list_skills` and `get_skill`.
- `list_skills` → grouped index naming known skills (`skill-creator`,
  `testing-skill`) and listing many entries.
- `get_skill("skill-creator")` → substantial SKILL.md content.

It takes the server command as `node mcp-smoke.mjs -- <command> [args...]`, so it
exercises the same `npx -y @stuffbucket/skills` invocation the CLIs register.

## Requirements

- Docker (daemon running).
- Network access (to pull the images, install the deferred CLIs, and fetch the
  package's deps). No model API key, and no LLM is ever contacted.

CLI versions are pinned by the `ai-cli-images` build (`versions.json`).

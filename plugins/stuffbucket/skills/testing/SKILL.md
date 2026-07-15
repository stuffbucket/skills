---
name: testing
description: Root index for the testing-* family — writing and running tests across any language or runtime. Use when creating unit, integration, or end-to-end tests, structuring test files, naming tests by behavior, designing code for testability, mocking or injecting dependencies, measuring coverage, running mutation testing, pinning contracts a type checker cannot see, or debugging a test that fails only in the full suite. Covers universal practices with multi-runtime run commands (Node test runner, Jest, Vitest, pytest, Bun) plus a Bun-specific center of gravity. Routes to specific testing-* sub-skills.
---

# Testing

Family of testing skills, split into universal practices that hold in any language or runtime and a
Bun-specific cluster for the footguns this repo hits daily. Start at a universal leaf for the shape
of the problem, then drop into a `testing-bun-*` leaf when the runtime is Bun.

## Routing table

Pick a universal leaf for the shape of the problem; jump to a `testing-bun-*` leaf when the runtime is Bun.

### Universal practices (any language or runtime)

- `testing-fundamentals` — file placement, arrange-act-assert, naming by behavior, what to test vs skip, debugging, coverage. Multi-runtime run commands (Node, Jest, Vitest, pytest, Bun). Start here.
- `testing-dependency-injection` — design for testability by injecting the filesystem, network, clock, or a shared module via optional params with real defaults, instead of mocking modules.
- `testing-mutation` — mutation testing and surviving mutants; why coverage lies; killable vs dead vs proven-equivalent; why not to gate CI on a mutation score.
- `testing-contract-tests` — pin contracts a type checker can't see: enum / union completeness, cross-boundary parity (Rust↔TS, catalog↔mirror), authored-but-skipped suites that un-skip with the code.

### Bun (the runtime this repo uses)

- `testing-bun-runner` — the `bun test` runner: `bun:test` imports, lifecycle hooks, single-file runs, coverage, in-memory SQLite, env-gating expensive suites, Bun-version correctness. The Bun entry point.
- `testing-bun-mock-leaks` — the `mock.module` cross-file forward-leak (top Bun footgun): passes alone, fails in the full suite; awaited restore doesn't reliably land on CI; `mock.restore` skips modules.
- `testing-bun-http` — test Hono / fetch handlers with in-memory `app.request()` (no port bind), read streaming / SSE bodies, and the gated real-port exception kept away from files that mock the server.
- `testing-bun-dom-free` — test UI logic in a Bun repo with no jsdom: split into a DOM-free core taking injected storage / history / location, test with fakes, verify the DOM glue by grepping source.

## Cross-family edges

- **Design for testability first** — `testing-dependency-injection` is the bridge: most "I can't test this" problems are shape problems, not tooling problems.
- **Runtime capabilities beyond testing** — non-test Bun features (bundler, package manager, shell, native APIs) belong in a future `bun-*` family. Keep only the testing slice in `testing-bun-*`.
- **Code review** — `code-analysis-skill`, `code-review-cycle` when a review turns up missing or misleading coverage.

## Decision flow

1. New to the codebase / "where does this test go, what do I assert?" — `testing-fundamentals`.
2. "This function touches the filesystem/network/clock and I want to mock it" — `testing-dependency-injection` (usually: inject instead).
3. Coverage is green but you don't trust it — `testing-mutation`.
4. Testing an enum/union for completeness, or two sides that agree only by convention — `testing-contract-tests`.
5. Runtime is Bun — `testing-bun-runner`, then the specific `testing-bun-*` leaf for the footgun.
6. "Passes alone, fails in the full suite" — `testing-bun-mock-leaks`.
7. Testing an HTTP handler in Bun — `testing-bun-http`. Testing UI logic with no DOM harness — `testing-bun-dom-free`.

## When NOT to use this skill

- Choosing or configuring a test **framework** at the project level unrelated to writing tests — that's project setup.
- Non-Bun runtime specifics beyond the multi-runtime pointers here — go to that runtime's own reference.
- General Bun capabilities that are not about testing (bundling, install, shell) — a future `bun-*` family, not this one.

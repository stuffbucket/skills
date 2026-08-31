---
name: testing-bun-runner
description: The Bun test runner and its idioms. Use when writing tests with the bun test command, importing from the bun:test module, structuring lifecycle hooks, running a single file, measuring coverage, using an in-memory SQLite database, gating expensive suites behind an environment variable, or reasoning about why the Bun version is a test-correctness concern. The Bun-specific entry point of the testing skills. Part of the testing skill family.
---

# Bun Test Runner

Bun ships its own test runner. There is no Jest, no Vitest, no ts-jest,
and no Babel layer to configure — Bun executes TypeScript directly, so a
`.test.ts` file runs with zero transpile step. This leaf is the hub for
the Bun-specific testing skills: it covers the runner and its idioms,
then dispatches to the siblings for the sharp edges. For test structure,
naming, and coverage philosophy that apply to any runner, load the
`testing-fundamentals` skill.

## The bun:test API and lifecycle

Import everything from the built-in `bun:test` module — no install, no
config to wire it up:

```ts
import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  afterAll,
  mock,
  spyOn,
} from "bun:test";

describe("adder", () => {
  let calls: number;
  beforeEach(() => {
    calls = 0;
  });
  afterEach(() => {
    // per-test cleanup runs here
  });

  test("adds two numbers", () => {
    expect(1 + 2).toBe(3);
  });
});
```

Hooks nest with `describe` blocks: `beforeEach`/`afterEach` run around
each test in scope, `afterAll` once when the block finishes. `mock` and
`spyOn` come from the same module — their leak discipline is its own
topic, below.

## Running tests

The runner discovers `*.test.ts` (and `.spec`, `.js`, etc.) files
automatically:

```bash
bun test                          # run every discovered test
bun test path/to/file.test.ts     # run a single file
bun test --coverage               # run all and report coverage
```

An optional `bunfig.toml` at the repo root configures the `[test]`
block. Use `preload` to run global setup before any test, and `root` to
scope where discovery starts:

```toml
[test]
preload = ["./test/setup.ts"]
root = "./src"
```

## Global isolation via preload

A preload file runs BEFORE any test module is imported, which makes it
the one correct place for process-wide setup. Point credential and
config directories at a throwaway temp dir so tests never read or write
real machine state, install global resets, and pin an outermost safety
net that restores mocks after every test:

```ts
import { afterEach, mock } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.APP_CONFIG_DIR = mkdtempSync(join(tmpdir(), "app-"));
afterEach(() => mock.restore());
```

That `afterEach` is a backstop, not a substitute for disciplined mock
handling. Module-level mocks leak across files in ways a top-level
restore does not fully catch — load the `testing-bun-mock-leaks` skill
before you reach for `mock.module`, `mock()`, or `spyOn`.

## In-memory SQLite

Bun's `bun:sqlite` opens an in-memory database when you pass the special
`:memory:` path, giving each test a fast, isolated store with no files
to clean up. There are two idioms depending on who owns the connection:

```ts
import { Database } from "bun:sqlite";

// 1. Direct: your test constructs the connection.
const db = new Database(":memory:");

// 2. Indirect: code under test opens its own connection from an env var.
process.env.DB_PATH = ":memory:";
```

Reach for the direct form in unit tests; use the env-var form when the
subject reads its own DB path at startup.

## Env-gated opt-in suites

Some suites are expensive or depend on the environment — they bind real
ports, shell out to a real build, or hit a network. Skip those by
default and let a developer opt in with an environment flag, so `bun
test` stays fast and hermetic:

```ts
describe.skipIf(!process.env.MY_FLAG)("real port server", () => {
  // only runs when MY_FLAG is set
});
```

For the real-port and HTTP-server case specifically, load the
`testing-bun-http` skill.

## The Bun version is a test-correctness concern

Because the runner IS the runtime, the Bun version is not a mere tooling
detail — it is part of the test's meaning. A version delta can change
how `bun:test`, `bun:sqlite`, or the standard library behaves, so a
suite that passes locally can fail in CI (or vice versa) purely from a
version mismatch. Pin the Bun version in the repo and keep the CI pin in
lockstep with the local pin; move them together in a single change.

## Where to go next

Dispatch to the sibling leaves for the sharp edges:

- Mock, spy, or module-replacement isolation and cross-file leaks — load
  the `testing-bun-mock-leaks` skill.
- HTTP routes, real ports, or SSE streaming — load the
  `testing-bun-http` skill.
- Browser-facing code with no DOM harness available — load the
  `testing-bun-dom-free` skill.
- Universal structure, naming, and coverage that outlive any one runner
  — load the `testing-fundamentals` skill.

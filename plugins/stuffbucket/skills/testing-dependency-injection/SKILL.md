---
name: testing-dependency-injection
description: Design code for testability by injecting dependencies instead of mocking modules. Use when a function reaches for the filesystem, network, clock, database, or a shared module and you want to test it without global mocks. Covers optional-parameter dependency injection with real defaults, why mocking shared modules is risky global state, and choosing between injection, a real module with a temp directory, and mocking as a last resort. Part of the testing skill family.
---

# Testing With Dependency Injection

A unit under test should not reach out to the world. When a function opens a
file, calls the network, reads the clock, or talks to a database by importing
those capabilities directly, the test has no clean seam: the only way to
control behavior is to reach into the module system and swap globals. Dependency
injection removes that need. The collaborators arrive as arguments, so a test
supplies fakes and a production caller supplies nothing.

This skill covers one concern: designing for testability through injection. For
the framework mechanics of writing and running tests, load the
`testing-fundamentals` skill. For the specific Bun hazard that makes injection
the safe default, load the `testing-bun-mock-leaks` skill.

## The core idea: inject side-effecting collaborators

Take an options object of optional dependencies, each with a real default. The
default wires up production behavior, so real callers pass nothing. Tests pass
fakes for exactly the collaborators they need to control.

```ts
type Deps = {
  readFile?: (path: string) => Promise<string>;
  exec?: (cmd: string) => Promise<{ stdout: string }>;
};

async function detectTool(name: string, opts: Deps = {}): Promise<boolean> {
  const readFile = opts.readFile ?? ((p) => Bun.file(p).text());
  const exec = opts.exec ?? realExec;

  try {
    const cfg = await readFile(`/etc/${name}.conf`);
    if (cfg.includes("enabled")) return true;
  } catch {
    // fall through to probing the binary
  }
  const { stdout } = await exec(`${name} --version`);
  return stdout.trim().length > 0;
}
```

Production code calls `detectTool("ripgrep")`. A test calls it with fakes:

```ts
const found = await detectTool("ripgrep", {
  readFile: async () => "enabled",
  exec: async () => ({ stdout: "" }),
});
```

No global was touched. The seam is local to this call, deterministic, and gone
the moment the function returns.

## Why prefer injection over module mocking

A module mock is global mutable state shared across the whole test run. When you
rewrite what a module exports, every file that imports it — now and later in the
run — sees the replacement. That produces three recurring failures:

- **Leakage.** A mock installed in one test bleeds into unrelated tests unless
  every path restores it, and restoration is easy to forget.
- **Import-graph coupling.** The mock only works if the code under test imports
  the symbol the way you expect; refactoring the import breaks the test for
  reasons unrelated to behavior.
- **Shared-module blast radius.** Mocking a module imported by several files
  (a logger, an HTTP client, a config loader) changes behavior far outside the
  unit you meant to test.

Injection avoids all three. The substitution lives in the argument list, applies
to one call, and cannot leak because there is no global to restore.

## The decision ladder

Prefer options in order; drop to the next only when the one above cannot work.

1. **Inject the dependency.** Pass the collaborator as a parameter with a real
   default. This is the default choice for anything side-effecting.
2. **Use the real module against a disposable resource.** Point the genuine
   implementation at a temp home directory, a scratch file, or an in-memory
   backend (`:memory:` SQLite, an ephemeral port). There is nothing to mock
   because the real code runs against real-but-throwaway state.
3. **Mock as a last resort.** Only mock a module you own, never a shared
   framework or server library, and always restore it. Reach here only when
   injection and a real disposable resource are both impractical.

## Designing for injection

The pattern adapts to whatever shape your code already has.

Constructor or parameter injection for classes — dependencies enter once and are
stored:

```ts
class Backup {
  constructor(private clock: () => number = Date.now) {}
  stamp() {
    return `backup-${this.clock()}`;
  }
}
```

Factory functions that close over dependencies — callers build a configured
function:

```ts
function makeFetcher(http = globalThis.fetch) {
  return (url: string) => http(url).then((r) => r.json());
}
```

A test-only setter for an unavoidable singleton — expose one seam and keep it
out of the production path:

```ts
let deps = { now: () => Date.now() };
export function __setDeps(next: Partial<typeof deps>) {
  deps = { ...deps, ...next };
}
```

Injection through arguments is cleaner than a setter; use the setter only when a
long-lived singleton gives you no argument to thread through.

## Smell list: signals to lift a dependency to a parameter

If any of these appears deep inside business logic, that is the design telling
you to make it a parameter:

- `Date.now()`, `new Date()`, or any direct clock read
- `fetch`, a raw socket, or an HTTP client constructed inline
- `fs` / `Bun.file` / `readFile` reaching a hard-coded path
- a database or cache client instantiated where it is used
- `process.env` read from inside a function instead of passed in
- randomness (`Math.random`, UUID generation) baked into logic

Each of these is a collaborator wearing the costume of a language builtin. Lift
it to an argument with a real default and the unit becomes deterministic without
a single global mock.

## Cross-links

- For the Bun-specific reason module mocking is dangerous — `mock.module`
  cross-file leakage — load the `testing-bun-mock-leaks` skill.
- For framework setup, assertions, and test structure, load the
  `testing-fundamentals` skill.

---
name: testing-bun-mock-leaks
description: Avoid the Bun mock.module cross-file leak, the most common Bun testing footgun. Use when reaching for mock.module or spyOn in a Bun test, when a test passes alone but fails in the full suite, or when a mock seems to bleed into another file. Covers why module mocks persist forward across files, why an awaited restore does not reliably land on continuous integration, that mock.restore only resets spies, the sanctioned escape hatch, and preferring dependency injection or a real module instead. Part of the testing skill family.
---

# Avoiding Bun mock.module Cross-File Leaks

Bun's `mock.module` and `spyOn` mutate process-wide state that Bun does
not reset between test files. The result is the single most common Bun
testing footgun: a mock applied in one file silently poisons every file
that runs after it. This skill is about that one leak. It is portable to
any Bun repo; substitute your own module names where the examples say
"a shared module such as your server library".

## The failure signature

The tell is always the same shape:

```bash
# Green in isolation
bun test path/to/file.test.ts   # passes

# Red in the full run
bun test                        # the SAME test fails
```

A test that passes alone but fails inside the whole suite is almost
never a bug in that test. It is leaked global test state — a
`mock.module` or an unrestored `spyOn` from **another file** that ran
earlier in the same worker. Continuous integration makes it worse:
CI enumerates and orders test files differently from your local machine,
so the poisoning file may run before your test on CI but after it
locally. That is why this class of bug is green on your laptop and red
on CI. When you see this signature, do not add retries — find the file
that leaked state.

## Why mock.module leaks forward

Bun does **not** reset module mocks between test files in a run.
`mock.module(id, factory)` rewrites the process-wide module registry the
instant it executes. From that moment on, every file loaded afterward
that imports `id` receives the mocked version — not just the file that
called it.

Placed at the **top level** of a test file (module scope, outside any
`describe`/`beforeEach`), the mock installs as soon as Bun imports that
file, and it stays installed for the remainder of the worker's run. It
poisons sibling files that had nothing to do with the mock.

```ts
// poisons every later file that imports the server library
mock.module("your-server-lib", () => ({
  createServer: () => ({ listen: () => {} }),
}));
```

The scope of the damage is "every file after this one in this worker",
which is exactly the non-local, order-dependent behavior that makes it
so hard to trace.

## Why an awaited restore is not enough for a shared module

The intuitive fix — install in `beforeAll`, restore in `afterAll` — does
not reliably work for a module that other files import:

```ts
import * as real from "your-server-lib";

afterAll(async () => {
  // best-effort, NOT a guarantee for a shared module
  await mock.module("your-server-lib", () => real);
});
```

Two problems. First, re-pointing the registry does not reliably re-link
import bindings that other files already resolved when they were first
evaluated; those live bindings may still reference the mock. Second, the
restore does not deterministically land before the **next file's static
imports** are evaluated on CI — module linking for the following file
can happen before your `afterAll` runs in the order CI chose. So for a
module another file imports, restoring is best-effort cleanup, never a
guarantee. The only robust move is to not leak it in the first place.

## mock.restore only resets spies — never module mocks

This is a classic and costly confusion, so state it plainly:
`mock.restore()` undoes `spyOn`. It does **not** undo `mock.module`.

Even an outermost safety net in a preload file:

```ts
// preload.ts — resets SPIES between tests, does nothing for mock.module
afterEach(() => {
  mock.restore();
});
```

...will happily leave every `mock.module` override in place. If you are
relying on a global `mock.restore()` to clean up module mocks, they are
still leaking. Restoring spies and restoring module mocks are two
different problems.

## spyOn leaks the same way

`spyOn(obj, "method")` patches the real method on the real object. If
you do not restore it, that patch persists for every later file in the
worker — same forward-leak mechanism as `mock.module`. Always restore
per file (or per test):

```ts
import { spyOn, afterEach } from "bun:test";

const spy = spyOn(console, "error").mockImplementation(() => {});

afterEach(() => {
  spy.mockRestore();
});
```

The global `afterEach(() => mock.restore())` net is defense-in-depth,
not a substitute for restoring your own spies. Treat every `spyOn` as
something you own and must put back.

## The lint-catchable footgun (and its limit)

Two fire-and-forget forms never land their restore because the call is
discarded, so a lint rule can ban exactly these:

```ts
// BANNABLE: return value discarded, restore can never happen
void mock.module("your-server-lib", factory);
mock.module("your-server-lib", factory); // bare expression statement
```

A lint selector matching a `void mock.module(...)` or a bare
`mock.module(...)` expression statement catches these reliably. But
the leak is **not** fully lintable: an `await`ed `mock.module` of a
shared module still leaks (per the restore section above), and it is
indistinguishable by a syntactic selector from a legitimate mock of a
module you own. Lint narrows the blast radius; it does not remove the
need for discipline.

## The durable fixes, in order

Prefer these top to bottom:

1. **Do not mock at all.** Use the REAL module pointed at a disposable
   resource — a temp config dir, an `:memory:` database, an ephemeral
   port. Real code exercised against a throwaway backing store has no
   registry to leak.
2. **Inject the dependency.** Pass the collaborator in as an argument or
   constructor parameter so the test supplies a fake without touching
   the module registry. Load the `testing-dependency-injection` skill
   for the durable pattern.
3. **If you must mock, mock only a module YOU own** — never a shared
   framework or server library that sibling files import. A mock of a
   small internal module you control has a bounded blast radius.

## The sanctioned escape hatch

Only for a module you own (not a shared library other files import),
the safe pattern is a fully awaited install and restore, spreading the
real module so you override the minimum:

```ts
import { beforeAll, afterAll } from "bun:test";

let actual: typeof import("./your-own-module");

beforeAll(async () => {
  actual = await import("./your-own-module");
  await mock.module("./your-own-module", () => ({
    ...actual, // keep everything real...
    fetchToken: async () => "test-token", // ...override only what you need
  }));
});

afterAll(async () => {
  await mock.module("./your-own-module", () => actual);
});
```

Awaiting both directions is mandatory; the `...actual` spread keeps you
from accidentally blanking exports the file under test still needs.

## A concrete cautionary tale

A real-port test binds an ephemeral port and starts the actual server to
prove the server library genuinely works end to end. A sibling file did
a top-level `mock.module` on that same server library, stubbing
`createServer` with an object whose `listen` did nothing. Because the
module mock leaked forward, the real-port test — running later in the
same worker — got the stub instead of the real server. There was no real
listener, so the test crashed trying to connect to a port nothing was
serving.

Two fixes applied together:

- Gate the real-port test behind an env flag so it only runs in a
  process where the server library is guaranteed unmocked.
- Better, inject the server-start function into the code under test so
  the real-port test supplies the real one and no `mock.module` is
  needed anywhere.

Real-port tests and a mocked server library fundamentally cannot share a
worker. For how to structure real-port HTTP tests so they stay isolated,
load the `testing-bun-http` skill.

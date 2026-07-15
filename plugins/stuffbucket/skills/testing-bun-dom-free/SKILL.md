---
name: testing-bun-dom-free
description: Test UI logic in a Bun repo that has no DOM harness. Use when there is no jsdom or happy-dom available and you need to test browser-facing code, or when deciding what to unit-test versus what to verify by grepping source. Covers splitting UI into a DOM-free core that takes injected structural interfaces for storage, history, and location, testing that core with fakes, and verifying the thin DOM glue by grepping the markup for contract attributes. Part of the testing skill family.
---

# Testing Browser-Facing Code Without a DOM Harness

Bun repos frequently ship no `jsdom` and no `happy-dom`, and the test
runner has no browser at all. This skill is the pattern for testing UI
logic anyway, and for deciding what to unit-test versus what to verify
by reading source as text. It is one concern only. For running and
structuring the tests themselves, load the `testing-bun-runner` skill;
for treating a source grep as a first-class contract, load the
`testing-contract-tests` skill.

## The constraint

Under `bun test` there is no `window`, no `document`, and no
`localStorage`. You cannot render a component, and you cannot even
import a module that touches those globals at module scope — the import
throws because the runtime lacks the globals, and a server-side
`tsconfig.json` usually omits the DOM lib, so the types are not there
either. Reaching for a DOM shim is a real dependency and a real
decision; treat it as out of scope until the project deliberately makes
it (see the last section).

## The pattern: split into a DOM-free core plus thin glue

Divide every browser-facing module into two layers:

- A **DOM-free core** that holds all the logic and touches no browser
  global. It is plain functions over plain data.
- A **thin glue layer** that reads `window` / `document` and hands the
  real objects to the core.

Test the core directly with fakes. The glue shrinks to a handful of
trivial lines that just forward globals, and you verify those by
grepping source rather than executing them. The hard-to-test surface
collapses from "the whole feature" to "three lines of wiring."

## Make the core DOM-free by injecting structural interfaces

The core must never name `window.localStorage`, `window.history`, or
`window.location`. Instead it declares minimal **structural**
interfaces describing only the members it uses, and accepts them as
parameters. Tests pass fakes; the glue passes the real `window.*`,
which structurally satisfies the interface for free.

```ts
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface HistoryLike {
  readonly length: number;
  replaceState(data: unknown, unused: string, url?: string): void;
}

export interface LocationLike {
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
}

// Pure: all inputs injected, no globals referenced.
export function loadDraft(storage: StorageLike, key: string): string {
  return storage.getItem(key) ?? "";
}
```

The glue is then a one-liner such as
`loadDraft(window.localStorage, "draft")`, which the type checker
accepts because the real objects match the structural shape.

## Also inject non-DOM ambient dependencies

The same discipline applies to any ambient global, not just DOM ones.
Pass an id generator — a `() => string` — instead of calling
`crypto.randomUUID()` inside the core, and inject a clock or timer
instead of reading `Date.now()`. The core then produces deterministic
output under test, and no assertion depends on a real random value or
wall-clock time.

## Test the core with fakes

Arrange in-memory fakes, drive the core function, then assert on the
returned view-model or on the calls the fake recorded. A fake can also
enforce an invariant: give the core a fake `HistoryLike` and assert it
only ever calls `replaceState` and never grows `length`, proving the
core rewrites the URL rather than pushing new entries.

```ts
import { expect, test } from "bun:test";
import { loadDraft, type StorageLike } from "./draft";

function fakeStorage(seed: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

test("loadDraft returns the stored value", () => {
  expect(loadDraft(fakeStorage({ draft: "hi" }), "draft")).toBe("hi");
});

test("loadDraft defaults to empty string when absent", () => {
  expect(loadDraft(fakeStorage(), "draft")).toBe("");
});
```

## Verify the glue by source-grep

The DOM wiring that remains is verified by reading the source or markup
**as text**, not by rendering it. Assert that the contract holds: the
handler references the required element ids or `data-` attributes, and
the routing source never calls a banned API. This is a contract test —
load the `testing-contract-tests` skill for how to keep the message
load-bearing and the check resistant to false passes.

```ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("markup exposes the ids the glue wires up", () => {
  const html = readFileSync(new URL("./panel.html", import.meta.url), "utf8");
  for (const id of ["draft-input", "save-btn"]) {
    expect(html).toContain(`id="${id}"`);
  }
});

test("router never pushes history; it only replaces", () => {
  const src = readFileSync(new URL("./router.ts", import.meta.url), "utf8");
  expect(src.includes("pushState")).toBe(false);
});
```

Grep the smallest stable token that proves the contract — an id string,
a `data-` attribute, an API name — and phrase the failure so a reader
knows which contract broke and where, not merely that a string was
absent.

## When to reach for a real DOM

If the project later adopts `happy-dom` (typically wired through a Bun
test preload) that is a deliberate, separate investment with its own
setup and cost. Until that decision is made and documented, default to
this core-plus-grep split: it needs no new dependency, runs at native
`bun test` speed, and keeps the untestable surface down to a few lines
of glue.

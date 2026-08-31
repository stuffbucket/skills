---
name: testing-contract-tests
description: Pin contracts and cross-boundary agreements that a type checker cannot see. Use when testing a discriminated union or enum for completeness, when two sides agree only by convention such as a Rust and TypeScript pair or a translation catalog and its mirror, or when scaffolding a test spec before the implementation exists. Covers runtime enumeration tests, cross-boundary parity tests, and authored-but-skipped suites that un-skip atomically with the code. Part of the testing skill family.
---

# Contract and Parity Tests

Some agreements are invisible to a compiler. A type checker proves that each
side of a boundary is internally consistent, but it cannot prove that two
independently-compiled sides still agree with each other, nor that a runtime
list actually contains every case it claims to. Contract tests pin those
agreements at runtime, where they are load-bearing. This skill covers three
shapes: enumeration tests, cross-boundary parity tests, and spec-first
authored-but-skipped suites.

## When a type checker is not enough

A compiler is a single-language, single-compilation-unit tool. It verifies the
code in front of it. It says nothing about a sibling file compiled by a
different toolchain, a string parsed at the far end of an HTTP hop, or whether
a hand-maintained array is complete. Those are contracts held together by
convention, and convention drifts silently. A contract test is the assertion
that fails the moment the convention is broken, instead of a user hitting it
in production.

## Enumeration tests over unions and enums

A common trap: you have a discriminated union and an `as const` list of its
members, and you reach for `satisfies` to keep them honest. But `satisfies`
only proves that every member you listed is a VALID member of the union. It
does not prove the list is COMPLETE — drop an entry and it still compiles
green. To guarantee exhaustiveness, assert at runtime: the array length equals
the expected count, and the array contains each required member by name.

```ts
type Shape = "circle" | "square" | "triangle";

// `satisfies` proves each entry is a valid Shape.
// It does NOT prove every Shape appears — a missing entry still type-checks.
const ALL_SHAPES = ["circle", "square", "triangle"] as const satisfies readonly Shape[];

test("ALL_SHAPES is exhaustive", () => {
  expect(ALL_SHAPES).toHaveLength(3);
  expect(ALL_SHAPES).toContain("circle");
  expect(ALL_SHAPES).toContain("square");
  expect(ALL_SHAPES).toContain("triangle");
});
```

The length assertion is the trip wire: add a fourth member to `Shape` and the
count is wrong until someone updates both the list and the test. The
`toContain` assertions localize the failure to the missing case.

## Cross-boundary parity tests

When two sides agree only by convention and no compiler spans the gap, a
one-sided rename compiles cleanly on each side and breaks only at runtime.
Examples: a Rust enum variant and its TypeScript mirror, a URL query key built
in one module and parsed in another, a translation catalog and a mirrored copy
in another package. Pin the agreement with a test that reads BOTH sides and
asserts the shared token exists in each. Reading the other side as raw text is
legitimate here — you are testing the wire, not the types.

```ts
import { readFileSync } from "node:fs";

test("Rust status enum stays mirrored in the TS client", () => {
  const rust = readFileSync("../core/src/status.rs", "utf8");
  const ts = readFileSync("./src/status.ts", "utf8");

  for (const variant of ["Pending", "Active", "Closed"]) {
    expect(rust).toContain(variant);
    expect(ts, `TS mirror is missing "${variant}" — rename both sides together`).toContain(variant);
  }
});
```

The failure message is load-bearing: it names the broken invariant and tells
the next reader that the fix is to change both sides, not to relax the test.

## Spec-first authored-but-skipped suites

You can author the contract before the implementation exists. Write the full
behavioral suite as `describe.skip(...)` up front — it documents the intended
contract and turns into a real regression guard the moment the body lands. Pair
it with a LIVE sibling `describe(...)` that asserts whatever shape you CAN
verify today: exported constants, the presence of a stub, the module's public
surface. The skipped block is un-skipped atomically in the same change that
ships the behavior.

```ts
describe("parser (active now)", () => {
  test("exports the expected token constants", () => {
    expect(TOKENS).toContain("LPAREN");
    expect(TOKENS).toContain("RPAREN");
  });
});

describe.skip("parser behavior (un-skip when parse() lands)", () => {
  test("parses a balanced expression", () => {
    expect(parse("(a b)")).toEqual({ head: "a", args: ["b"] });
  });
  test("rejects an unbalanced expression", () => {
    expect(() => parse("(a b")).toThrow();
  });
});
```

Reserve `describe.skip` for the not-yet-implemented case. For suites that are
implemented but genuinely expensive or environment-dependent — needing a real
port, a network, or a platform-specific binary — gate them with
`describe.skipIf(...)` on a runtime condition instead, so they run where they
can and skip where they cannot. For that HTTP and real-port guidance, load the
`testing-bun-runner` family.

## Source-grep as a contract

Sometimes the behavior you need to pin lives in glue that no unit test can
reach: rendered markup, a generated file, a build manifest. Grepping the source
for a required attribute or string is a legitimate contract test — it asserts
that the untestable artifact still carries the token the rest of the system
depends on. Load the `testing-bun-dom-free` skill for the pattern of
source-grepping instead of standing up a DOM.

## Why these earn their keep

Contract and enumeration tests are precisely the high-signal tests that
mutation testing rewards: each one pins a specific, mutable fact, so a mutant
that breaks the fact gets caught. If you want to measure whether these tests
actually constrain the code they guard, load the `testing-mutation` skill.

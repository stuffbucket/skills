---
name: testing-fundamentals
description: Core testing practices that apply in any language or runtime. Use when placing test files, structuring a test with arrange-act-assert, naming tests by behavior, deciding what to test versus skip, debugging a failing test, or setting a coverage philosophy. Includes multi-runtime run commands for the Node test runner, Jest, Vitest, pytest, and Bun. For Bun-specific testing load testing-bun-runner. Part of the testing skill family.
---

# Testing Fundamentals

Practices that hold in any language or runtime. This leaf covers structure, naming, scope, coverage
philosophy, and debugging. It does not cover test doubles, whether a green test proves anything, or
Bun specifics — those live in sibling skills, cross-linked below.

- For test doubles (fakes, stubs, spies, injection seams) load the `testing-dependency-injection` skill.
- To learn whether a passing test actually proves something load the `testing-mutation` skill.
- For Bun idioms (`bun:test`, mock leaks, in-memory HTTP, no jsdom) load the `testing-bun-runner` skill.

## Test file placement

Mirror the source tree so a reader can find the test for any file by its path. Co-locate fast unit
tests next to the code; keep slow integration and end-to-end suites in a top-level `tests/` (or
`test/`) directory so they can be run — or skipped — as a group.

| Test kind | Where it lives | Why |
| --- | --- | --- |
| Unit | Next to source (`foo.ts` + `foo.test.ts`) | Found instantly; moves with the code |
| Integration | `tests/integration/` | Slower; needs setup/teardown as a group |
| End-to-end | `tests/e2e/` | Slowest; often gated separately in CI |

Pick one filename convention (`*.test.*` or `*.spec.*`) and apply it everywhere; runners glob on it.

## Arrange-Act-Assert

Every test has three visual sections: build the inputs (arrange), run the one thing under test
(act), then check the outcome (assert). One act per test — if you need a second act, write a second
test.

```ts
test("returns the discounted total when a coupon applies", () => {
  // arrange
  const cart = new Cart([{ price: 100 }]);
  // act
  const total = cart.totalWith(coupon("SAVE10"));
  // assert
  expect(total).toBe(90);
});
```

```python
def test_returns_discounted_total_when_coupon_applies():
    # arrange
    cart = Cart([Item(price=100)])
    # act
    total = cart.total_with(coupon("SAVE10"))
    # assert
    assert total == 90
```

## Naming by behavior

Name the test after the behavior, not the method. Use "expected result when condition" or
"expected result given input". A good name reads as a sentence and tells you what broke without
opening the body.

```text
GOOD: "returns 404 when the user is not found"
BAD:  "test getUser"

GOOD: "raises ValidationError given a negative quantity"
BAD:  "test_quantity_2"

GOOD: "retries three times then surfaces the last error"
BAD:  "testRetry"
```

## What to test, what to skip

Test:

- The public API — the contract callers depend on.
- Edge cases — empty, zero, one, max, boundary, and off-by-one inputs.
- Error paths — invalid input, timeouts, and failure branches, not just the happy path.
- State transitions — that an action moves the system into the state you claim.

Skip:

- Private internals — test them through the public API that exercises them.
- Library and framework code — you did not write it; trust its own suite.
- Trivial getters/setters and pass-through wrappers with no logic.
- Generated code — test the generator's output contract, not the generated lines.

## Coverage philosophy

Coverage is visibility, not a target. It tells you which lines never ran under test — a map of blind
spots, most often unexercised error paths. Read it that way.

- Do not chase 100 percent; the last few percent is usually generated code or unreachable guards.
- Do not gate CI on a raw coverage number — it rewards assertion-free tests that merely execute lines.
- Do treat a newly uncovered branch in a diff as a prompt: is that error path worth a test?

Coverage counts execution, not verification: a line can be covered by a test that asserts nothing and
still be completely unprotected. To find out whether your green tests would actually catch a bug, load
the `testing-mutation` skill.

## Debugging a failing test

Work the checklist in order; stop as soon as one step explains the failure.

1. Read the assertion and the actual-vs-expected diff before touching anything — the message usually
   names the bug.
2. Decide who is wrong: the test (stale expectation, bad fixture) or the code (real regression).
   Never "fix" a test to make it green without answering this.
3. Isolate it — run only this test (`.only`, a name filter, or a path) to remove suite interference.
4. Log at the arrange/act boundary: print the arranged inputs and the act's return value to see where
   reality diverges from the expectation.
5. Check order-dependence: a test that passes alone but fails in the full suite points at leaked
   global state — a shared singleton, an unrestored mock, an env var, the clock, or the filesystem.
6. Fix the root cause, then re-run the whole suite to confirm you did not just move the failure.

## Run commands by runtime

Each command runs the whole suite; append a path or name filter to narrow it.

| Runtime | Command |
| --- | --- |
| Node test runner | `node --test` |
| Jest | `npx jest` |
| Vitest | `npx vitest` |
| pytest | `python -m pytest` |
| Bun | `bun test` |

For Bun-specific idioms — the `bun:test` API, mock leaks across files, in-memory HTTP, and the
absence of jsdom — load the `testing-bun-runner` skill as the entry point to the Bun testing leaves.

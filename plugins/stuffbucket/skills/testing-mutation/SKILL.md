---
name: testing-mutation
description: Mutation testing and how to act on surviving mutants. Use when coverage looks green but you doubt the tests would catch a real bug, when deciding whether a test suite actually pins behavior, or when running a mutation tool such as StrykerJS. Covers why coverage is not enough, the killable versus dead versus proven-equivalent disposition of surviving mutants, and why not to gate continuous integration on a mutation score. Part of the testing skill family.
---

# Mutation Testing

Coverage tells you a line executed. It cannot tell you whether a test would
notice if that line were wrong. Mutation testing answers the harder question,
and it changes how you read a green suite. This skill is one concern only:
mutation testing and what to do with what it finds. For the philosophy of
coverage and what a test is for, load the `testing-fundamentals` skill; for
pinning discriminated-union completeness, load the `testing-contract-tests`
skill.

## What mutation testing answers

Line coverage asks "did this line run?". Mutation testing asks "if this line
were WRONG, would a test fail?". A mutation tool makes small, mechanical edits
to your source — each edited copy is a *mutant* — and runs the whole suite
against each one. Typical mutations:

- flip a comparison: `<` becomes `<=`, `>` becomes `>=`
- negate a condition: `if (ready)` becomes `if (!ready)`
- swap a boolean literal: `true` becomes `false`
- change a return: `return x` becomes `return null`
- remove a statement or a call entirely

If some test fails on the mutant, the mutant is *killed* — a test distinguished
correct code from broken code. If every test still passes, the mutant
*survives*: no test in your suite can tell the difference. A surviving mutant is
a concrete, reproducible claim that a real bug of that exact shape would ship
green.

## Why coverage is not enough

Consider a subtly inverted conditional. Someone writes:

```ts
function render(msg: Message): string {
  if (!hasThinking(msg)) {
    return formatWithThinking(msg);
  }
  return formatPlain(msg);
}
```

The `!` is wrong — it should be `if (hasThinking(msg))`. Every line here can be
fully covered and the suite fully green, because the one fixture the tests use
happens to produce the same string on both branches (say it has no thinking
block, so both formatters emit identical output). Coverage is 100%. The bug is
real. Mutation testing is what catches this class: the tool will also try the
*correct* form as a mutant, see that no test fails, and flag it as survived.
That surviving mutant is the missing test staring back at you.

## Disposition of a surviving mutant

This is the heart of the skill. Every surviving mutant falls into exactly one of
three honest buckets. Force each survivor into one — do not let survivors
accumulate unexamined, and do not invent a fourth "documented-equivalent"
catch-all to avoid the work.

### Killable — a real gap

The mutant represents a bug a real test would catch, and you simply do not have
that test. This is the common and valuable case. Write the test that
distinguishes the mutant from the original: pick an input where correct and
mutated code diverge, and assert the correct output. Re-run mutation; the mutant
is now killed. Do this.

### Dead / unreachable — the branch cannot run

The mutated branch can never execute given the types, invariants, or the actual
callers. Example: a mutant negates a guard whose condition is already guaranteed
true by an upstream type or an earlier assertion, so both forms behave
identically because the other path is unreachable. The right fix is not a test —
it is to remove the dead code, or encode the impossibility in the type system
(narrow the input type, use a non-nullable type, make the illegal state
unrepresentable) so the mutant cannot exist. If the code truly cannot run, delete
it; the mutant disappears with it.

### Proven-equivalent — genuinely identical behavior

The mutation produces behavior that is identical to the original over the entire
reachable input domain — not "identical for the inputs we tried", but provably
identical for every input that can occur. Example: `x >= 0` versus `x > -1` when
`x` is a non-negative integer. Keep such a mutant surviving ONLY with a written
proof over the reachable domain, plus a reason the code stays in its current
form. The proof is the price of the disposition. Reject "documented-equivalent"
as a lazy label: if you cannot write the proof, the mutant is killable, not
equivalent — go write the test.

The discipline: a survivor is never just "noise". It is killable, dead, or
proven-equivalent, and you say which in review.

## Do not gate CI on a mutation score

It is tempting to compute a single mutation-score percentage and fail the build
below a threshold. Resist it.

- Mutation runs are slow — every mutant re-runs the suite — so a blocking gate
  punishes every push with minutes-to-hours of latency.
- Results are flaky under concurrency and timeouts; a mutant killed only by a
  race or a slow timer flips run to run.
- A single global percentage invites gaming: people add weak assertions or
  exclude hard files to move the number, learning nothing.

The real bar is per-survivor adjudication in review — each survivor sorted into
one of the three buckets by a human — not a number a machine compares to a
threshold. Run mutation deliberately: on demand, scoped to a module or a hot
path you are changing, as an investigative tool, not as a merge gate.

## Practical setup with StrykerJS

Keep the target NARROW. Mutation cost scales with source size times suite
runtime, so point it at one module and one focused test file at a time. A
minimal `stryker.conf.json` using the command runner:

```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "testRunner": "command",
  "commandRunner": { "command": "bun test test/dispatch.test.ts" },
  "mutate": ["src/dispatch.ts"],
  "reporters": ["clear-text", "html"],
  "concurrency": 2
}
```

Run it on demand rather than wiring it into the default test task, for example a
dedicated script:

```bash
bun run mutate      # e.g. "mutate": "stryker run"
# or directly:
npx stryker run
```

Read the `clear-text` output, open each survivor, and adjudicate it. Then move
the `mutate` glob to the next module and repeat.

## Where to point mutation

Highest signal comes from pure logic on hot paths, where an inverted condition
ships silently and hurts every request:

- input preprocessing and normalization
- protocol or format translation (request/response mapping, serialization)
- dispatch, routing, and model/handler selection gates
- policy, permission, and rule matching

These are branch-dense, side-effect-light, and cheap to mutate. For exhaustive
handling of discriminated unions and enums — where the risk is a missing case
rather than an inverted one — pin completeness with the
`testing-contract-tests` skill instead of, or alongside, mutation.

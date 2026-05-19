---
name: code-review-cycle
description: "Run a full code review cycle on recent changes: lint auto-fix, three-agent quality review (reuse, quality, efficiency), boundary analysis with separate new-file and modified-file review tracks, code smell audit with deferred triggers, and error-contract review. Use after implementing a feature or fix, before committing. Invoke with /code-review-cycle or when the user asks to 'review the code', 'check quality', 'run the review cycle', or 'clean up before commit'."
---

# Code Review Cycle

Run a structured review cycle on code changes. Run BEFORE committing, not after.

## Identify Changes

Produce two explicit lists — these drive different review tracks in Phase 3:

```bash
# New files (no prior version to diff against)
git diff --name-only --diff-filter=A HEAD

# Modified files (have a prior version)
git diff --name-only --diff-filter=M HEAD
```

If no staged/unstaged changes, use `HEAD~1` as base. Store both lists and the full diff.

## Phase 1: Lint

1. Detect project linter (eslint, biome, ruff, golangci-lint, clippy, etc.)
2. Run with auto-fix on changed files only
3. If no linter configured, note as recommendation — do not add one
4. Report what was auto-fixed

Do not modify CI/CD configuration.

## Phase 2: Simplify (Three-Agent Review)

Launch three agents in parallel. Each gets the full diff.

**Agent 1 — Reuse**: Existing utilities that could replace new code. Duplicated functions. Inline logic that should use a utility.

**Agent 2 — Quality**: Redundant state. Copy-paste variation. Leaky abstractions. Stringly-typed code. Unnecessary comments.

**Agent 3 — Efficiency**: Redundant work, repeated reads, N+1 patterns. Missed concurrency. TOCTOU. Overly broad operations.

Wait for all three. Aggregate findings.

## Phase 3: Boundary Analysis (two tracks)

New files and modified files get different reviews because they have different failure modes. Launch both tracks in parallel.

### Track A: Modified-File Review

Load `boundary-scope-escape` via `get_skill("boundary-scope-escape")`.

On the diff of modified files:

- Values whose identity escapes their lexical scope (literals repeated across files)
- Whether escaping values are toolchain-enforced (closed) or convention-only (open)
- Domain dependency order (D1 primitives → D2 references → D3 types)
- Any previously-closed boundaries reopened by the change (load `boundary-drift-detection`
  via `get_skill("boundary-drift-detection")` if the change touches multiple domains)

### Track B: New-File Review

New files have no diff baseline — every line is "added." They need checks that diff-based review misses:

1. **Name collisions**: For each exported type, interface, class, constant, or function in the new file,
   grep the project for existing exports with the same name. Duplicate names with different definitions
   are scope escapes. Must be unified before commit.

2. **Reimplemented patterns**: For each function in the new file, check whether equivalent logic exists elsewhere in the project. New files written in isolation tend to reimplement rather than import.

3. **Error contracts**: For each function that can fail (async, I/O, subprocess, parsing):
   - Are `catch` blocks scoped to expected error types? Bare `catch {}` on I/O is a smell.
   - Do error types match the project's established pattern? If the project has typed errors, new code must use them.
   - Is the throw-vs-return-warnings contract clear and consistent with adjacent modules?

4. **Import direction**: Does the new file import from the correct layer? A persistence module importing
   from a UI layer, or a library importing from a CLI module, is a boundary violation.

5. **Interface width**: Does any new type accept more states than intended? `any`,
   `Record<string, unknown>` where a narrower type exists, union types wider than the valid set,
   optional fields that should be required.

### Combine results

Merge findings from both tracks. Report open boundaries with domain layer and files involved.

## Phase 4: Code Smell Audit

Review the changed code for design smells:

1. **God function** — does too many things, changes for multiple reasons
2. **Shotgun surgery** — adding a feature requires touching many files
3. **Primitive obsession** — bare primitives where domain types would be safer
4. **Data clumps** — fields that always travel together but aren't their own type
5. **Long parameter lists** — 4+ params that should be grouped
6. **Feature envy** — reaches into another module's data more than its own

Classify each: **fix now** (will cause bugs) or **defer with trigger** (tolerable, has a concrete condition for when it must be fixed).

## Phase 5: Error Contract Review

Verify every function that crosses a boundary (I/O, network, subprocess, parsing):

1. **Catch scope**: Each catch scoped to expected error type, not bare `catch {}`
2. **Type consistency**: If the module uses typed errors, all error paths use them
3. **Contract clarity**: Each public function is clearly throw-or-return-warnings, not mixed
4. **Fallback scope**: Fallback paths trigger only on expected failures, not unrelated errors

## Phase 6: Fix and Document

### Fix (in order)

1. Lint auto-fixes (done in Phase 1)
2. Simplify findings — fix or skip with reason
3. Boundaries — unify duplicate types (Track B finding 1), close D1 escapes, note higher-domain boundaries
4. Smell fixes — "fix now" items only
5. Error contracts — narrow catches, unify error types

### Document Deferred Work

Append deferred smells to `SMELLS.md` in the project root:

```markdown
## <Smell name> — <one-line description>

**File:** `<path>`
**Trigger:** <concrete condition when this must be fixed>
**Fix:** <what to do when triggered>
```

### Summary

Report concisely:

- Lint: what was auto-fixed
- Simplify: what was fixed, what was skipped
- Boundaries — Track A: scope escapes found/closed on modified files
- Boundaries — Track B: name collisions, reimplementations, error contract gaps found on new files
- Smells: fixed now vs deferred (with triggers)
- Error contracts: what was narrowed or unified

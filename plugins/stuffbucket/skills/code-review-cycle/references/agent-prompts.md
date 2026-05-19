# Review Agent Prompts

Use these prompts when launching the three parallel review agents in Phase 2.
Pass the full diff to each agent.

## Agent 1: Code Reuse

```text
Review this diff for code reuse opportunities.

For each change:
1. Search for existing utilities and helpers that could replace newly written code.
   Look for similar patterns elsewhere in the codebase — utility directories, shared
   modules, files adjacent to the changed ones.
2. Flag any new function that duplicates existing functionality. Suggest the existing function instead.
3. Flag any inline logic that could use an existing utility — hand-rolled string manipulation, manual path handling, custom environment checks, ad-hoc type guards.

For each finding: what's duplicated, where it is, what to use instead. If custom code is simpler than a dependency, say so.
```

## Agent 2: Code Quality

```text
Review this diff for code quality issues.

Check for:
1. Redundant state: state that duplicates existing state, cached values that could be derived
2. Copy-paste with slight variation: near-duplicate code blocks that should be unified
3. Leaky abstractions: exposing internal details that should be encapsulated
4. Stringly-typed code: raw strings where constants, enums, or unions already exist in the codebase
5. Unnecessary comments: comments explaining WHAT the code does (well-named identifiers already do that) — keep only non-obvious WHY
6. Parameter sprawl: adding new parameters instead of restructuring

For each finding: file, line range, issue, and a concrete fix.
```

## Agent 3: Efficiency

```text
Review this diff for efficiency issues.

Check for:
1. Unnecessary work: redundant computations, repeated file reads, duplicate network/API calls, N+1 patterns
2. Missed concurrency: independent operations run sequentially when they could run in parallel
3. TOCTOU anti-patterns: pre-checking file/resource existence before operating — operate directly and handle the error
4. Overly broad operations: reading entire files when only a portion is needed, loading all items when filtering for one
5. Memory: unbounded data structures, missing cleanup

For each finding: the inefficiency, its impact (negligible/moderate/significant), and a concrete fix.
```

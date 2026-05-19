---
name: boundary
description: Root index for the boundary-* family — differential closure analysis for code and AI-generated code. Treats each domain (types, schemas, state machines, shared values) as having a boundary condition d(S) between current state and validity; the family enumerates open domains, encodes seeds, controls generation, and detects drift. Use when the user asks about making invalid states unrepresentable, single source of truth, type-driven design, AI code-gen safety, drift detection in diffs, or LLM noise vs signal.
---

# Boundary

A TypeScript-leaning engineering family that formalizes "make invalid states unrepresentable" as a
boundary condition `d(S)` between a system's current representation and the set of valid states.
Each skill is one step in resolving or guarding that boundary.

## Routing table

The skills are designed as a pipeline; pick the entry by what you have in hand.

### Discovery — what is open?

- `boundary-scope-escape` — enumerate values whose identity escapes their lexical scope. First
  step of differential closure analysis: produces an ordered inventory of open domains with
  dependencies. Start here when auditing for shared values redefined across files, diagnosing
  inconsistency bugs, or prepping a refactor.

### Resolution — close it

- `boundary-seed-encoding` — encode shared values as seeds in domain-native representations so the
  toolchain (not convention) prevents independent redefinition. Drives `d(S) → ∅` in dependency
  order. Use after `boundary-scope-escape` produces its inventory.
- `boundary-domain-closure` — structure code so the set of representable states equals the set of
  valid states. Per-domain closure under prerequisites (valid(Dn) needs closed(Dm)). Use when
  designing types, schemas, state machines.

### Guarding — keep it closed

- `boundary-drift-detection` — detect when a diff reopens a closed domain or widens a boundary
  condition. Hamming-distance change locality, delta-epsilon crossover. Use when reviewing PRs,
  auditing generated code, or verifying refactors.
- `boundary-generation-control` — constrain AI code generation to preserve or resolve boundary
  conditions (never expand). Controls what is representable in the generation context instead of
  relying on instructions. Use when prompting an LLM to edit a typed codebase.
- `boundary-noise-model` — characterize stochastic LLM noise so drift detection can distinguish
  sampling variance from semantic drift. Provides the probabilistic floor that makes
  delta-epsilon rigorous. Use when calibrating ε thresholds or reproducibility criteria.

## Cross-family edges

- `code-analysis-skill` — for the raw static-analysis pass that feeds `boundary-scope-escape` and `boundary-drift-detection`.
- `testing-skill` — domain closure usually pairs with property-style tests; `boundary-domain-closure` types narrow the surface, tests cover the rest.
- `code-review-cycle` — drift detection plugs into PR review.
- `react-composition` — when the open domain is a React component API (boolean-prop proliferation), encode the seed as discriminated-union props.
- `tauri-security-capabilities-authoring` — capability files are a closed-domain authoring exercise; the same closure discipline applies.
- `git-workflow-skill` — diffs are the substrate for drift detection.

## Decision flow

1. "Where are the inconsistencies?" → `boundary-scope-escape` to inventory open domains.
2. Have an inventory; want to fix it → `boundary-seed-encoding` (acts on the inventory).
3. Designing a new type / schema / state machine from scratch → `boundary-domain-closure`.
4. Reviewing a diff for regressions → `boundary-drift-detection`.
5. Prompting an LLM to edit closed code → `boundary-generation-control`, calibrated by `boundary-noise-model`.
6. Don't trust whether a difference is real or sampling noise → `boundary-noise-model`.

## When NOT to use this skill

- Plain refactoring with no shared-value-across-files concern — just refactor.
- Runtime validation (Zod, io-ts) divorced from compile-time guarantees — boundary skills favor compile-time closure first.
- Pure performance work — closure can constrain options but is not the right lens.
- One-shot AI codegen where correctness is verified by humans, not types — overkill.

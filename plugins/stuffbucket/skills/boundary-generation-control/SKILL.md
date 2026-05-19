---
name: boundary-generation-control
description: "Constrain AI code generation to preserve or resolve boundary conditions — never expand them. Controls what is representable in the generation context rather than relying on instructions. The prompt defines the open interior, seeds shape continuation, types enforce closure, and delta-epsilon characterizes the generation boundary. Respects the domain partial order: generation context must reflect which domains are closed and which boundary conditions remain open."
license: MIT
metadata:
  category: boundary-theory
  domain: general
---

# Boundary: Generation Control

Constrain AI code generation to produce output that **preserves or resolves d(S)** — never expands it.

## The Problem

LLMs generate code by sampling from a distribution shaped by context. That distribution does not respect semantic domain boundaries. The model may emit `padding: 16px` instead of `padding:
var(--spacing-md)` — not because it can't use the token, but because both are equally representable in its output space.

**Natural language instructions cannot fix this.** "Use design tokens" is imprecise and unenforceable. Each failure reopens a resolved boundary condition.

**The constraint:** No a priori requirements on humans that they can't reliably satisfy. No reliance on prose instructions to LLMs.

**The principle:** Control what is **representable** in the generation context, not what the model is **instructed** to do.

## Framework: Generation as d(S) Management

The generation context is itself a domain with boundary conditions. What the model can see determines what it can produce:

```text
Prompt (intent)       →  identifies which d(S) the model should resolve
Seed (existing code)  →  shapes continuation toward closed patterns
Schema (types)        →  constrains output to the closed state space
Context boundary      →  which domains are visible determines where drift can occur
```

Where the context has unresolved boundary conditions, the model fills from its training distribution — which does not respect your domain boundaries. **Generation drift occurs precisely at unresolved
boundary conditions in the context.**

### Noise, Confidence, and Reproducibility

Generation is stochastic. The same context produces different outputs. The noise model (see `boundary-noise-model`) provides three tools:

- **Noise floor (η)**: Expected syntactic variance between two in-domain generations. Not all differences are drift — filter noise before judging.
- **Domain confidence (κ)**: P(output stays in-domain | context). Determines whether to generate, tighten context, or close prerequisites first.
- **Reproducibility equivalence (≈)**: Two outputs are equivalent if they resolve the same d(S) components regardless of syntactic differences. "Same result" means same boundary effect, not same
tokens.

Context closure directly controls κ. More closed domains in context → higher κ → more reliable generation. This is the actionable link: **improving context closure improves generation confidence
measurably.**

### Respecting the Partial Order

The generation context must reflect the domain dependency structure:

- **Closed prerequisite domains** → include their seeds and types (model preserves closure)
- **The target open boundary** → the d(S) the model should resolve (this is the work)
- **Other open boundaries** → exclude or minimize (these are drift vectors)

If prerequisite domains aren't closed, generation for dependent domains is unreliable — the model has no stable foundation to build on.

## When to Use This Skill

- Structuring a codebase so LLMs generate consistent code by default
- Choosing what context to include/exclude for a generation task
- Reviewing LLM output for boundary violations
- Designing projects where code generation is a regular workflow
- Diagnosing recurring drift patterns in generated code

## Generation Control Strategies

### Strategy 1: Seed with references, never literals

The model's continuation distribution is shaped by what it sees. Include files that demonstrate reference patterns. Exclude files containing raw literals for seeded values.

Context file selection is a d(S) management decision — you are resolving the generation context's boundary conditions before the model runs.

### Strategy 2: Type-constrain the output shape

Provide type definitions, interfaces, and schemas. The narrower the type, the smaller the boundary condition on the output space. Types are structural (part of the representation); instructions are
semantic (require interpretation). The model conforms to visible types far more reliably.

### Strategy 3: Reflect the partial order in context

Structure context to show:

- Which domains are closed (include seeds, types, references)
- Which boundary condition the model should resolve (the target d(S))
- What the closed domains establish (the foundation the model builds on)

Exclude:

- Files from unrelated domains (reduces cross-domain drift)
- Raw values that should only be accessed via seeds
- Patterns you don't want (negative examples expand the representable set)

### Strategy 4: Estimate confidence before generating

Before generating, estimate domain confidence κ by assessing context:

| Context Property | κ Effect |
| ----------------- | ---------- |
| All prerequisite domains closed, seeds visible | ↑ high |
| Narrow type constraints visible | ↑ high |
| Literals present alongside references | ↓ low |
| Open prerequisite domains | ↓ unreliable |
| Large target d(S) | ↓ moderate |

| κ Level | Action |
| --------- | -------- |
| High (>0.95) | Generate and verify once |
| Moderate (0.8–0.95) | Generate, verify, may retry once |
| Low (0.5–0.8) | Tighten context before generating |
| Unreliable (≤0.5) | Do not generate — close prerequisite domains first |

### Strategy 5: Post-generation boundary verification

After generation, apply `boundary-drift-detection` with noise filtering:

1. Filter noise-floor variations (naming, formatting, equivalent expressions)
2. Did the remaining signal stay in the intended domain?
2b. Did it introduce `any`, `as unknown as`, or `as any`? These indicate the generation
    context lacked a type the model needed — the context has an unresolved boundary
    condition. Do not accept `any` as valid output. Instead: find or derive the correct
    type (e.g., `Parameters<Fn>[0]`, re-export from the dependency), add it to the
    context, and regenerate.
3. Did it use seeds/references or introduce new literals?
4. Does it type-check against the domain's closure?
5. Did any resolved boundary conditions reopen?
6. Are prerequisite domains still intact?

For reproducibility: if you need consistent results, verify that multiple generations are **reproducibility-equivalent** — same d(S) effect, not same tokens. See `boundary-noise-model`.

### Strategy 6: Iterative context tightening

If drift is detected:

1. Identify which boundary condition in the context the model exploited
2. Tighten the seed (add more reference examples)
3. Tighten the schema (narrow the types)
4. Reduce context scope (exclude cross-domain files)
5. Regenerate and re-verify

Each iteration resolves a context boundary condition that permitted drift, increasing κ for the next attempt. If κ remains low after tightening, the prerequisite domains may not be sufficiently
closed — step back in the partial order.

A common signal that context needs tightening: the model emits `any` for a value it
passes to an external API. The fix is to make the external API's parameter type visible
in the context — import it, derive it via `Parameters<>`, or define a compatible local
interface. `any` means the model couldn't find a type, not that no type exists.

## The Generation Boundary Model

```text
d(S) of context = ∅ for closed domains  →  model preserves closure
d(S) of target  ≠ ∅                     →  model works to resolve it
d(S) of other   ≠ ∅                     →  drift vectors — minimize these

Generation quality ∝ (closed context domains) / (total visible domains)
```

The ideal: all context domains are closed except the one the model is working on. The model can only drift through boundary conditions that exist in the context.

## Guidelines

- **Never rely on prose instructions alone.** They are semantic, not structural — the model interprets them probabilistically. Structure the context instead.
- **The best generation control is invisible.** A well-seeded, type-closed codebase naturally constrains generation. Invest in closure; generation control follows.
- **Control the context, not the model.** You cannot change the model's weights. You can change what it sees. The generation boundary is a function of the input representation.
- **Respect the partial order.** Don't ask the model to generate in D5 when D2 is open. The model needs closed prerequisites to produce reliable output.
- **d(S) ≠ ∅ in the target is expected.** That's the boundary condition the model is resolving. The problem is when d(S) ≠ ∅ in *other* domains — those are drift vectors.
- **Estimate κ before generating.** If confidence is low, tighten context or close prerequisites rather than generating and hoping. Prevention is cheaper than detection.
- **Reproducibility means same d(S) effect, not same tokens.** Two syntactically different outputs that resolve the same boundary conditions are equivalent. Don't chase token-level determinism — it's
not achievable and not necessary.
- **Measure drift, don't assume compliance.** Always verify with `boundary-drift-detection`, with noise filtering from `boundary-noise-model`.
- **The full pipeline:** enumerate boundaries → encode seeds → close domains (in order) → estimate confidence → control generation context → detect drift (with noise filtering). Each skill reinforces
the others.

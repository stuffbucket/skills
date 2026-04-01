---
name: boundary-noise-model
description: "Characterize the stochastic noise envelope of LLM code generation to distinguish acceptable sampling variance from semantic drift. Use when evaluating whether differences between generated outputs are noise or signal, establishing reproducibility criteria for generation tasks, determining confidence levels for context closure states, or calibrating ε thresholds for drift detection. Provides the probabilistic foundation that makes delta-epsilon analysis rigorous over a non-deterministic generator."
license: MIT
metadata:
  category: boundary-theory
  domain: general
---

# Boundary: Noise Model

Characterize the noise envelope of LLM generation to distinguish sampling variance from semantic drift.

## The Problem

LLM generation is stochastic. The same context produces different outputs across runs. The delta-epsilon framework in its deterministic form cannot distinguish:

- **Noise**: two outputs that differ syntactically but resolve the same d(S) — acceptable variance
- **Drift**: two outputs where one resolves d(S) and the other expands it — a boundary violation

Without a noise model, every syntactic difference looks like potential drift. This produces false positives that erode trust in the detection system, or forces ε so wide that real drift passes
undetected.

## Framework: Stochastic Differential Closure

The deterministic framework says: |δ| < ε → in-domain, |δ| ≥ ε → drift.

The stochastic extension says: **ε is not a fixed threshold. It is a function of the noise floor of the generation process.**

### The Generation Distribution

For a given context C and target domain D, the model samples from a distribution P(output | C). This distribution has:

- **A mode region** — outputs that are most probable. These cluster around the patterns present in the context.
- **A tail region** — less probable outputs that diverge further from context patterns.
- **A domain boundary** — the boundary condition d(S) that separates in-domain outputs from drift.

The noise envelope is the variance of P within the mode region. Drift is when a sample falls outside the domain boundary, regardless of its probability.

### Three Quantities

| Quantity | Definition | Purpose |
| ---------- | ----------- | --------- |
| **Noise floor (η)** | The expected syntactic variance between two samples from P that both resolve d(S) | Baseline — variation below η is not signal |
| **Domain confidence (κ)** | P(output resolves d(S) \| context C) — the probability that a sample stays in-domain | Measures how well the context constrains generation |
| **Reproducibility equivalence (≈)** | Two outputs are equivalent if they resolve the same d(S) components, regardless of syntactic differences | When two generations are "the same" |

## When to Use This Skill

- Evaluating whether differences between two generated outputs are meaningful
- Calibrating ε for `boundary-drift-detection` — setting the threshold above the noise floor
- Estimating confidence before committing to a generation strategy
- Determining how many generations to sample to achieve target confidence
- Diagnosing whether a recurring drift pattern is a context problem (fixable) or a noise floor problem (inherent)

## Characterizing the Noise Floor

### What Varies (noise — below η)

These differences between two in-domain generations are expected sampling variance:

| Variation | Example | Why It's Noise |
| ----------- | --------- | ---------------- |
| Variable naming | `items` vs `elements` vs `data` | Semantically equivalent; no d(S) effect |
| Statement ordering | Independent declarations in different order | No semantic dependency |
| Formatting | Whitespace, line breaks, bracket placement | No semantic content |
| Equivalent expressions | `x !== null` vs `x != null` vs `x` | Same domain semantics |
| Comment presence/absence | Added or omitted inline comments | No structural effect |
| Import ordering | Same imports, different sequence | No semantic content |

### What Doesn't Vary (signal — above η)

These differences indicate a boundary condition change:

| Variation | Example | Why It's Signal |
| ----------- | --------- | ---------------- |
| Literal vs. reference | `16px` vs `var(--spacing-md)` | d(S) effect: reference preserves closure, literal reopens |
| Type widening | `Status` vs `Status \| string` | d(S) effect: wider type expands representable states |
| Seed bypass | Hardcoded value vs. imported constant | d(S) effect: bypass reopens a resolved boundary |
| Domain crossing | Layout code in a logic file | d(S) effect: touches a domain outside the target |
| Convention break | camelCase in a snake_case codebase | Hamming distance exceeds semantic distance |

### The Boundary Between Noise and Signal

Some variations are ambiguous — they depend on context:

| Variation | Noise When... | Signal When... |
| ----------- | -------------- | ---------------- |
| Different API usage | Both are idiomatic for the domain | One bypasses the established pattern |
| Structural alternatives | `if/else` vs ternary — same semantics | Different control flow with different error handling |
| Abstraction level | Both are appropriate for the scope | One introduces unnecessary indirection or coupling |

For ambiguous cases, apply the **d(S) test**: does this variation change which boundary conditions are resolved? If yes, it's signal. If no, it's noise.

## Domain Confidence

### Definition

κ(C, D) = P(output resolves d(S) of D | context C)

Domain confidence is the probability that a generation from context C produces an output that stays within domain D and resolves (or at minimum preserves) the target boundary condition.

### Factors That Increase κ

| Factor | Effect on κ | Mechanism |
| -------- | ------------ | ----------- |
| More closed prerequisite domains in context | ↑ | Model has stable foundation; fewer drift vectors |
| Narrower type constraints visible | ↑ | Smaller representable output space |
| More seed examples using references | ↑ | Continuation distribution favors references |
| Fewer unrelated domains in context | ↑ | Fewer cross-domain contamination paths |
| Target d(S) is small/specific | ↑ | Less room for the model to diverge |

### Factors That Decrease κ

| Factor | Effect on κ | Mechanism |
| -------- | ------------ | ----------- |
| Open prerequisite domains | ↓ | Foundation is unstable; dependent results unreliable |
| Wide types (`any`, `string`, loose schemas) | ↓ | Large representable space includes invalid states |
| Literals in context alongside references | ↓ | Model treats both as acceptable patterns |
| Large target d(S) | ↓ | More room for divergence |
| Cross-domain files in context | ↓ | Contamination paths available |

### Confidence Thresholds

| κ Range | Interpretation | Action |
| --------- | --------------- | -------- |
| κ > 0.95 | High confidence — most generations will be in-domain | Generate and verify once |
| 0.8 < κ ≤ 0.95 | Moderate — occasional drift expected | Generate, verify, may need one retry |
| 0.5 < κ ≤ 0.8 | Low — drift is common | Tighten context before generating; sample multiple times |
| κ ≤ 0.5 | Unreliable — more drift than signal | Do not generate. Close prerequisite domains first |

These are not measured numerically in practice — they are estimated by assessing the context against the factors above. The table provides the decision framework.

## Reproducibility Equivalence

### Definition

Two outputs O₁ and O₂ are **reproducibility-equivalent** (O₁ ≈ O₂) if:

1. They resolve the same components of d(S)
2. They preserve the same closed domains
3. They introduce no new boundary conditions that the other doesn't
4. Their differences are entirely within the noise floor η

### The Equivalence Test

Given two outputs from the same context and target:

1. Run `boundary-drift-detection` on each independently
2. Compare their d(S) effect classifications
3. If both have the same classification for every domain in the partial order → **equivalent**
4. If they differ on any domain's d(S) effect → **not equivalent** — one of them drifted

### Why This Matters

Reproducibility equivalence defines what "the same result" means for stochastic generation. Two outputs can look completely different syntactically and be equivalent. Two outputs can look nearly
identical and not be equivalent (if one subtle difference is a boundary violation).

The equivalence class is defined by d(S) effect, not by syntax.

## Calibrating ε

The deterministic ε from `boundary-drift-detection` must be calibrated against the noise floor:

```text
ε_effective = ε_domain + η

Where:
  ε_domain  = the semantic boundary of the domain (fixed by ∂S)
  η         = the noise floor of the generation process (varies with context)
```

- Variations below η: **noise** — do not flag
- Variations between η and ε_effective: **review** — may be noise or signal depending on d(S) effect
- Variations above ε_effective: **drift** — flag unconditionally

### Practical Calibration

You don't measure η numerically. You estimate it by asking:

1. **Could this difference appear between two correct implementations?** If yes → likely noise.
2. **Does this difference change which boundary conditions are resolved?** If yes → signal regardless of magnitude.
3. **Is this difference in a dimension that the domain's ∂S constrains?** If yes → apply strict ε. If no → apply noise tolerance.

## Guidelines

- **Not all differences are drift.** The noise model prevents false positives that erode trust in boundary detection. Calibrate ε above the noise floor.
- **Not all similarities are equivalence.** Two outputs using the same literal `16px` are not equivalent to two outputs using `var(--spacing-md)`, even though each pair is internally consistent.
Equivalence is about d(S) effect.
- **κ is a decision tool, not a measurement.** You estimate confidence from context properties to decide whether to generate, tighten context, or close prerequisites first. Don't try to compute an
exact number.
- **The noise floor varies by domain.** Variable naming has high η (many acceptable variants). Value references have low η (literal vs. reference is binary). Calibrate per domain.
- **When in doubt, apply the d(S) test.** If a variation changes which boundary conditions are resolved, it's signal. If it doesn't, it's noise. This test is always available regardless of η
estimation quality.
- **Reproducibility doesn't mean identical.** It means the same d(S) effect. Accept syntactic variance; reject semantic divergence.

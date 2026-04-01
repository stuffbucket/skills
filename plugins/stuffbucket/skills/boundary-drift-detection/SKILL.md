---
name: boundary-drift-detection
description: "Detect when code changes reopen closed domains or widen boundary conditions — expanding d(S) where it was resolved. Uses Hamming distance to measure change locality and delta-epsilon to characterize the exact boundary where a change crosses into another semantic domain. Respects the domain partial order: drift in a prerequisite domain invalidates dependent domains. Use when reviewing diffs, auditing generated code, or verifying refactors."
license: MIT
metadata:
  category: boundary-theory
  domain: general
---

# Boundary: Drift Detection

Detect when a change **expands d(S)** — reopening a resolved boundary condition or widening an open one — and identify which domains in the partial order are affected.

## Framework: Differential Closure Analysis

Every code change has a d(S) effect:

- **Resolves d(S)** — moves a boundary condition toward ∅ (seeding, typing, constraining)
- **Preserves d(S)** — no boundary conditions change (in-domain modification)
- **Expands d(S)** — reopens a resolved boundary or widens an open one (drift)

Drift is the third case. Because domains form a partial order, drift in Dm invalidates all dependent Dn.

### Delta-Epsilon Characterization (Stochastic)

For any change δ, there exists an ε-neighborhood within which the change stays within its semantic domain. But ε is not a fixed threshold — it is a function of the noise floor η of the generation
process:

```text
ε_effective = ε_domain + η

|δ| < η           →  noise — acceptable sampling variance, not signal
η ≤ |δ| < ε_eff   →  review — may be noise or signal, apply d(S) test
|δ| ≥ ε_eff       →  drift — d(S) expanded, boundary crossed
```

**Hamming distance** measures how many independent coordinates differ. Small Hamming distance = local change. Large Hamming distance relative to semantic distance = likely boundary crossing. But
Hamming distance must be interpreted against η: some coordinates have high noise floors (variable names) and others have near-zero (literal vs. reference).

See `boundary-noise-model` for characterizing η, domain confidence κ, and reproducibility equivalence.

## When to Use This Skill

- Reviewing diffs for unintended d(S) expansion
- Auditing LLM-generated code for domain violations
- Validating refactors stayed within their domain
- Post-generation verification
- Monitoring the partial order: has a prerequisite domain reopened?

## How to Detect Drift

### Step 1: Name the intended domain

What domain was the change supposed to affect? At what layer in the partial order?

### Step 2: Compute the change footprint

1. **Files touched** — modified, added, or deleted
2. **Domains touched** — which semantic domains do those files belong to?
3. **Values changed** — literals, references, or structures altered
4. **Cross-references affected** — anything referenced elsewhere?

### Step 3: Filter noise from signal

Before classifying d(S) effect, separate noise from signal. For each difference in the footprint:

1. **Could this difference appear between two correct implementations?** If yes → likely noise (below η)
2. **Does this difference change which boundary conditions are resolved?** If yes → signal regardless of magnitude
3. **Is this difference in a constrained dimension of ∂S?** If yes → strict ε. If no → apply noise tolerance

Discard noise-floor variations (variable naming, formatting, import order, equivalent expressions). Retain signal variations for classification.

### Step 4: Classify the d(S) effect

| Footprint (signal only — noise filtered) | d(S) Effect | Assessment |
| ------------------------------------------ | ------------- | ------------ |
| All changes within intended domain, using existing references | Preserves | **In-bounds** |
| Changes resolve a boundary condition (literal → reference) | Resolves | **Closure progress** |
| Changes touch dependent domain via necessary coupling | Preserves | **Boundary** — verify minimality |
| Changes introduce new literals for seeded values | Expands | **Drift** — reopening a resolved domain |
| Changes touch unrelated domain | Expands | **Escape** — crossed a boundary |
| Changes touch prerequisite domain | Expands | **Cascade** — dependents invalidated |

### Step 5: Assess partial order impact

If drift occurred:

- **Which domain boundary was crossed?**
- **Is it a prerequisite domain?** If so, which dependent domains are now unreliable?
- **Is the expansion necessary?** (Schema changes necessarily affect consumers)
- **Is it minimal?** (Only required cross-domain effects)

## Drift Patterns in Generated Code

### Literal Duplication (reopening a resolved boundary)

The LLM emits a literal where a seed exists. d(S) was ∅; now it's not.

**Detection:** New literal matching an existing seed value.

### Interface Widening (expanding a boundary condition)

A function accepts more states than intended — `| string`, `any`, optional properties.

**Detection:** Type changes that increase representable states beyond ∂S.

### Style Contamination (bypassing domain boundaries)

Inline styles or local overrides that duplicate or contradict token-derived values.

**Detection:** New style definitions outside the established token system.

### Prerequisite Violation (cascade drift)

A change in a lower domain (D1/D2) that wasn't propagated to dependent domains.

**Detection:** Dependent domain code references values that changed upstream.

## Output Format

```text
CHANGE: <description>
INTENDED DOMAIN: <Dn — name and layer>
NOISE FILTERED: <variations classified as noise and excluded>
d(S) EFFECT: resolves | preserves | expands
DOMAINS TOUCHED: <list with layers>
DRIFT: none | boundary | escaped | cascade
CONFIDENCE (κ): high | moderate | low | unreliable
CASCADE IMPACT: <dependent domains invalidated, if any>
DETAILS: <what crossed where>
RECOMMENDATION: <accept | scope tighter | close reopened domain | fix forward from Dm | tighten context and regenerate>
```

## Guidelines

- **Not all differences are drift.** Filter noise before classifying. Variations below the noise floor η are sampling variance, not signal. See `boundary-noise-model` for characterizing η.
- **Not all cross-domain changes are drift.** Necessary coupling preserves d(S). The test is whether the cross-domain effect is necessary and minimal.
- **Reopening a resolved boundary is the most serious drift.** d(S): ∅ → ≠∅ erases prior closure work. Highest priority.
- **Cascade drift is the most damaging.** Drift in a prerequisite domain invalidates every dependent. When detected, stop and fix forward from the affected prerequisite.
- **Drift compounds.** Each undetected expansion of d(S) accumulates. Detect early.
- **Calibrate ε above the noise floor.** ε_effective = ε_domain + η. Flagging noise as drift erodes trust in the detection system. See `boundary-noise-model` for calibration.
- **LLM-generated code has higher η but needs tighter ε.** The noise floor is wider (more syntactic variance) but the domain boundary must be stricter (LLMs don't detect scope escape during
generation). Separate the two thresholds.
- **Most powerful over closed domains.** Well-seeded, type-closed domains make drift mechanically detectable — the toolchain catches it.

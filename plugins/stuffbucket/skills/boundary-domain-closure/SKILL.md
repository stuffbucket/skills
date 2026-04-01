---
name: boundary-domain-closure
description: "Structure code so that the set of representable states equals the set of valid states for a given domain, resolving the boundary condition d(S) → ∅. Each domain is a type boundary; closing it adds a constraint layer. Domains have prerequisites — valid(Dn) requires closed(Dm) for all prerequisites Dm. Use when designing types, schemas, state machines, or any structure where invalid states should be unrepresentable."
license: MIT
metadata:
  category: boundary-theory
  domain: general
---

# Boundary: Domain Closure

Resolve the boundary condition d(S) for a domain by making the set of representable states equal to the set of valid states.

## Framework: Differential Closure Analysis

Each domain is a **type boundary** — a constraint layer. Closing it establishes a property that subsequent domains depend on:

- **d(S)** = the boundary condition between the current state and closure for this domain
- **d(S) = ∅** = closure achieved — the boundary condition is resolved
- **valid(Dn) ← closed(Dm)** for all Dm ∈ prereqs(Dn) — domains form a partial order

### The Dependency Chain

| Closure | Establishes |
| --------- | ------------- |
| D1 closed | Value space is well-formed |
| D2 closed | Reference graph is acyclic and total |
| D3 closed | State space is bounded |
| D4 closed | Transitions are valid |
| D5 closed | Composition is well-formed |

A failure in Dm makes all dependent Dn results unreliable. **Stop at the first open domain and fix forward.**

Closure is stronger than validation. Validation detects invalid states at runtime. Closure **prevents their construction** at authoring time.

## When to Use This Skill

- After seeds are encoded, to verify the domain is actually closed
- Designing types, schemas, state machines, or component APIs
- Confirming that d(S) = ∅ for a domain before proceeding to its dependents
- Any time the question is: "how do I prevent invalid combinations?"

## Open vs. Closed Boundary Conditions

| Property | d(S) ≠ ∅ (open boundary) | d(S) = ∅ (resolved) |
| ---------- | -------------------------- | --------------------- |
| Invalid states | Representable | Unrepresentable |
| Error surface | Runtime | Author time |
| Dependent domains | Unreliable | Can proceed |
| LLM generation | Can produce invalid combinations | Types constrain output |

## How to Close a Domain

### Step 1: Confirm prerequisites

Check that all prerequisite domains are closed. If Dm is open and Dn depends on it, close Dm first. Results from Dn are unreliable otherwise.

### Step 2: Define ∂S — the boundary invariants

What must hold for this domain to be correct?

- Which states are valid?
- Which combinations are valid?
- What relationships between values must hold?

### Step 3: Measure d(S) — the boundary condition

Compare the current representation to ∂S. The boundary condition d(S) is precisely what separates the current state from closure:

- Can invalid states be constructed?
- Can all valid states be expressed?
- Is enforcement native or conventional?

### Step 4: Choose closure techniques

| Technique | What It Closes | Domain |
| ----------- | --------------- | -------- |
| Union/enum types | Discrete state sets | Any typed language |
| Discriminated unions | State + associated data | TypeScript, Rust, etc. |
| Branded/opaque types | Interchangeable-looking values | Any typed language |
| Schema with `additionalProperties: false` | Object shapes | JSON Schema, OpenAPI |
| Exhaustive matching | All branches handled | Pattern matching languages |
| `@scope` / `@layer` | Style application boundaries | CSS |
| Foreign key constraints | Relational integrity | Databases |
| State machine transitions | Valid next-states | Any |

### Step 5: Apply closure and verify

Restructure the representation, then verify all three closure conditions:

1. **Completeness** — every valid state is representable (∂S is not over-tight)
2. **Soundness** — no invalid state is representable (∂S is enforced)
3. **Nativeness** — enforcement is native to the domain's toolchain (not convention-dependent)

If any condition fails, d(S) ≠ ∅ — the boundary condition persists. Identify which component remains open and iterate.

### Step 6: Confirm dependent domains can proceed

Once d(S) = ∅, the property this domain establishes is available to its dependents. Proceed to the next domain in the partial order.

## Guidelines

- **d(S) is a boundary condition, not a state.** It describes what lies between where you are and where the domain is closed. It is precise and structural.
- **Respect the partial order.** Don't close D4 before D2 is verified. The dependency chain is load-bearing — a failure in D2 makes D4 results unreliable.
- **Stop at the first open domain and fix forward.** The partial order tells you where to start. Don't skip ahead.
- **Close at the narrowest scope.** A function's parameters should be closed to that function's valid inputs, not to all inputs in the module.
- **Prefer structural closure over nominal.** A type that structurally cannot represent invalid states is stronger than one that nominally forbids them.
- **Closure composes — verify composition.** If domain A and domain B are closed independently, verify their composition is also closed. If not, the boundary between them is a new open domain.
- **Don't close prematurely.** During exploration, open boundaries are expected. Close when the valid states are known and stability matters.

---
name: boundary-seed-encoding
description: "Encode shared values as seeds in domain-native representations that toolchains enforce inescapably, resolving boundary conditions by closing domains in dependency order. Use when acting on a scope-escape inventory to establish single sources of truth. The seed lives in a representation where the toolchain — not convention — prevents independent redefinition, driving d(S) → ∅ for the target domain."
license: MIT
metadata:
  category: boundary-theory
  domain: general
---

# Boundary: Seed Encoding

Encode scope-escaping values as **seeds** — single sources of truth in representations the toolchain enforces — to resolve boundary conditions by closing domains in dependency order.

## Framework: Differential Closure Analysis

A seed resolves a specific boundary condition d(S) by closing the domain it belongs to:

- **Before seeding:** d(S) ≠ ∅ — a boundary condition exists between the current state and closure. The value exists as independent literals; the invariant ∂S is unenforced.
- **After seeding:** d(S) = ∅ — the boundary condition is resolved. All sites reference the seed. The toolchain enforces ∂S.

### Respecting the Dependency Order

Domains form a partial order. Seeds must be encoded in dependency order:

- **D1 seeds first** (primitive values, tokens) — establishes that the value space is well-formed
- **D2 seeds next** (references, imports) — establishes that the reference graph is acyclic and total
- Higher domains build on the closure of lower domains

Seeding a D3 domain while D1 is still open produces unreliable closure. Fix forward from the first open domain.

## The Seed Encoding Principle

The enforcement mechanism must be **native to the domain** where the violation occurs and **unrepresentable in domains where it doesn't apply**. A seed is not a comment, not a naming convention, not
a rule file. It is a value in a representation where the toolchain rejects the alternative.

### Constraint

No a priori requirements on humans that they can't reliably satisfy. No reliance on natural language instructions to LLMs. The seed makes the correct path the only path the toolchain accepts.

## When to Use This Skill

- After `boundary-scope-escape` has produced an ordered inventory of boundary conditions
- When establishing single sources of truth for the first open domain
- When choosing where and how to define a seed
- When the question is: "what representation makes independent redefinition unwritable?"

## Choosing the Representation

The seed lives where the **consumer toolchain** enforces the reference:

| Domain Layer | Seed Representation | Enforcement Mechanism |
| ------------- | -------------------- | ----------------------- |
| D1: Values | Design tokens (JSON/YAML → generated code) | Build step generates the only consumable form |
| D2: References | Import/module system | Resolution fails if reference is broken |
| D3: Contracts | Schema (OpenAPI, GraphQL, Protobuf) | Codegen produces types; hand-written types won't compile |
| D4: Configuration | Typed config with single entry point | Import resolution; literals rejected by linter |
| D5: Business rules | Lookup tables / enums with exhaustive matching | Compiler/runtime rejects unlisted values |
| D6: Cross-service | Shared package / schema registry | Version-pinned dependency; no copy-paste path |

### Enforcement Hierarchy

```text
Build error > Lint error > Runtime error > Convention > Comment > Nothing
```

Prefer representations where bypassing the seed is a build error.

## How to Encode a Seed

### Step 1: Confirm prerequisites are closed

Check the dependency order from `boundary-scope-escape`. If prerequisite domains are still open, seed those first. Seeding out of order produces unreliable closure.

### Step 2: Select the target boundary condition

From the inventory, take the first open domain in dependency order.

### Step 3: Define ∂S precisely

State the invariant: "All spacing values derive from the 4px base unit" or "All API paths resolve through the route registry."

### Step 4: Choose the narrowest enforceable representation

The representation must make violation either impossible or a detectable error at the earliest possible stage (build > lint > runtime).

### Step 5: Author the seed

Create the single source of truth in the chosen representation.

### Step 6: Replace all open sites

Every occurrence of the literal becomes a reference to the seed.

### Step 7: Close the bypass path

If the toolchain accepts both the literal and the reference, add a lint rule or build step to reject the literal form. The domain is not closed until the bypass is blocked.

### Step 8: Verify closure

Confirm d(S) = ∅ for this domain: the boundary condition between current state and closure is resolved. Then proceed to the next domain in dependency order.

## Guidelines

- **The seed is not the value; it is the representation.** `--spacing-md: 16px` is a seed. `16px` is a literal. The seed's power is that consumers write `var(--spacing-md)`.
- **Follow the dependency order.** Don't seed D3 before D1 is closed. The partial order is load-bearing.
- **A seed that can be ignored is not a seed.** If the toolchain accepts both paths, the boundary condition persists — d(S) ≠ ∅ until the bypass is closed.
- **Seeds compose.** A spacing scale seed can derive from a base unit seed. Composition follows the domain hierarchy.
- **Don't over-seed.** Only values with scope-escaping identity need seeds. Coincidentally equal values should remain independent — they share no ∂S.

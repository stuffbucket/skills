---
name: boundary-scope-escape
description: "Enumerate values whose identity escapes their lexical scope — the first step of differential closure analysis. Use when auditing a codebase for shared values defined independently across files, diagnosing inconsistency bugs, or preparing for refactoring. Produces an ordered inventory of open domains with their dependency structure: each entry identifies a boundary condition d(S) between the current state and closure."
license: MIT
metadata:
  category: boundary-theory
  domain: general
---

# Boundary: Scope Escape Enumeration

Enumerate the boundary conditions in a codebase — values whose identity escapes their defining scope — and order them by dependency.

## Framework: Differential Closure Analysis

This skill operates within **differential closure analysis**, which treats a software system as a mathematical object:

- **∂S** = the set of invariants that must hold (the boundary of the valid state space)
- **d(S)** = the boundary condition between the current state and closure — what separates where you are from where the system is well-formed
- **d(S) ≠ ∅** describes a boundary condition, not a state. It is the precise characterization of what lies between the current representation and closure.

### Domain Dependency Structure

Domains form a **partial order**:

```text
valid(Dn) ← closed(Dm) for all Dm ∈ prereqs(Dn)
```

d(S) is not just a set — it has structure. Each domain is a type boundary:

- **Closing D1** establishes that the value space is well-formed
- **Closing D2** establishes that the reference graph is acyclic and total
- Each subsequent domain adds a constraint layer
- A failure in D2 makes dependent domains (D4, D5, D8...) unreliable

**You stop at the first open domain and fix forward.**

## When to Use This Skill

- Auditing a codebase to produce a structured inventory of boundary conditions
- Diagnosing inconsistency bugs by identifying which domain boundary they belong to
- Before refactoring, to determine the dependency order of what must close
- Prioritizing work: which domain is the first open prerequisite?

## How to Enumerate Boundary Conditions

### Step 1: Identify candidate values

Search for literals that appear in more than one file:

- Numeric literals (dimensions, durations, thresholds, limits)
- String literals (URLs, keys, labels, format strings)
- Color values, breakpoints, z-indices
- Configuration values (retry counts, buffer sizes, API paths)

### Step 2: Classify each candidate

| Question | If Yes | If No |
| ---------- | -------- | ------- |
| Must these values change together? | **Scope-escaping** — shared identity | Coincidental equality |
| Does changing one break the other's correctness? | **Coupled** — the invariant ∂S spans both sites | Independent |
| Is the relationship enforced by the toolchain? | **Closed** — d(S) = ∅ for this boundary | **Open** — d(S) ≠ ∅ |

### Step 3: Assign to domains

Group scope-escaping values by semantic domain. Each domain is a type boundary — a layer of constraints:

| Layer | Domain Example | What Closure Establishes |
| ------- | --------------- | -------------------------- |
| D1 | Primitive values (tokens, constants) | Value space is well-formed |
| D2 | References (imports, token usage) | Reference graph is acyclic and total |
| D3 | Types (interfaces, schemas) | State space is bounded |
| D4 | State (machines, reducers) | Transitions are valid |
| D5 | Composition (component trees, module graph) | Assembly is well-formed |
| ... | Higher domains | Additional constraint layers |

### Step 4: Establish the dependency order

For each domain, identify its prerequisites. Domain Dn is valid only if all prerequisite domains Dm are closed.

Map the partial order. Find the **first open domain** in dependency order — this is where work begins.

### Step 5: Characterize each boundary condition

For each open domain, starting from the first in dependency order:

```text
DOMAIN: <Dn — name and layer>
PREREQUISITES: <which domains must be closed first>
PREREQS CLOSED: yes | no (if no, this domain's results are unreliable)
INVARIANT (∂S): <what must hold>
OPEN SITES: <file:line, file:line, ...>
d(S): <the boundary condition — what separates current state from closure>
RISK: <consequence of this boundary remaining open>
```

## Guidelines

- **d(S) ≠ ∅ is a boundary condition, not a state.** It describes what lies between where you are and where the system is closed. It is precise, not vague.
- **Respect the dependency order.** Don't enumerate D5 boundaries before confirming D1-D4 are closed. Results from dependent domains are unreliable if prerequisites are open.
- **Stop at the first open domain and fix forward.** The inventory is ordered, not flat. Work proceeds domain by domain.
- **Coincidental equality is not a boundary condition.** Two `16` values that don't need to change together have no shared ∂S.
- **The test is semantic, not syntactic.** Same literal ≠ same identity. `padding: 16px` and `gap: 1rem` may share a boundary. `16` in spacing and `16` in retry count do not.
- **This skill enumerates and orders. It does not prescribe closure.** The `boundary-seed-encoding` and `boundary-domain-closure` skills handle closure.

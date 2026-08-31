# Child issue body template

Copy everything below the line into the issue body. Keep all five headings,
in this order. Do not add or remove sections.

---

## Problem / root cause

State the **symptom** (what is observably wrong) and the **mechanism** (why it
happens). One without the other is incomplete: a symptom with no mechanism is a
bug report; a mechanism with no symptom is a hypothesis.

- Symptom: what a user or test observes.
- Mechanism: the specific code path / condition that produces it.

## Fix

Describe the concrete change and point at **exact locations**. Use
`path/to/file.ext:LINE` (or `:START-END`) so a reviewer can jump straight to
the spot.

- Change: what to add / remove / alter.
- Location(s): `src/…/file.ts:NN`, `src/…/other.ts:NN-MM`.

## Verified against / learning from others

List the authoritative sources you checked or copied from, each with a link and
an authority label:

- `[Source name](url)` — **first-party** (the spec / upstream docs / the code
  being matched — authoritative).
- `[Source name](url)` — **inferred/copied** (a blog, a Q&A answer, a sibling
  project you are imitating — not authoritative; verify before trusting).

If you had no external source, say so: "No external source; derived from
in-repo behavior at `file:line`."

## Dependency / ordering

State how this issue relates to its siblings:

- Must land **after** #NNN (this builds on it).
- Must land **before** #NNN (that one builds on this).
- **Conflicts** with #NNN — both edit `path/to/file.ext` (same lines / adjacent
  lines); they cannot land in parallel. Proposed order: this one first.
- Or: **independent** — no shared files, no prerequisite; parallelizable.

## Scope

- Workstream: the area/change-surface this belongs to.
- Siblings: #NNN, #NNN (the other children in this effort).
- Epic: #NNN.

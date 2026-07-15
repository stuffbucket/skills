# Epic body template

Copy everything below the line into the epic body. Keep all four headings, in
this order. The epic is the single roof over every child issue in this effort.

---

## Why

The problem space and what the investigation surfaced. Describe the shape of
the problem, what triggered the work, and link the source findings (research
log, triage notes, failing report). A reader who knows nothing should finish
this section understanding *why this effort exists*.

## Target architecture / understanding

The end-state you are steering toward. Describe the intended structure once, so
each child issue can be judged against it ("does this move us toward the
target?"). This is the shared mental model; keep it concrete but not
implementation-by-implementation.

## Tracked pieces

A checklist linking **every** child issue, one line each, in landing order.
Reflect the merge sequence here (annotate prerequisites inline):

- [ ] #NNN — one-line summary (land first)
- [ ] #NNN — one-line summary (after #NNN)
- [ ] #NNN — one-line summary (independent)
- [ ] #NNN — one-line summary (before #NNN — shared file)

Ordering rule: anything that another piece builds on, or that edits a file a
sibling also edits, comes first. Independent pieces can go in any order — mark
them so.

## Provenance of this understanding

The sources behind this plan and how much to trust each. A later reader must be
able to separate load-bearing fact from working assumption:

- `[Source name](url)` — **first-party** (authoritative: spec, upstream docs,
  the code being matched).
- `[Source name](url)` — **inferred/copied** (imitated from a sibling project
  or third-party writeup; not authoritative).
- Assumptions still unverified: list them explicitly so they can be checked
  later.

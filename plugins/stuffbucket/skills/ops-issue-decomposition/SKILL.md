---
name: ops-issue-decomposition
description: Turn a body of investigation findings into a small set of focused child issues unified by one tracking epic, with explicit dependency and conflict sequencing. This is step 2 of the ops-workflow method. Use after a triage or research pass produces findings you must convert into trackable work — when asked to "break this into issues", "file child issues under an epic", "decompose these findings", "split this into workstreams", plan a merge order, or detect issues that will conflict because they edit the same files. Covers grouping findings into workstreams, the fixed child-issue and epic body templates, and computing a safe landing order across siblings.
license: MIT
metadata:
  category: ops
  domain: github-workflow
---

# Ops: Issue Decomposition

Convert a pile of findings into a small set of **workstreams**, file one
**child issue** per workstream under a single **tracking epic**, and pin down
the **order** they must land in. Findings that stay in a research log never get
fixed; findings that become one giant issue never get reviewed. This skill is
the bridge: it makes the work small, attributable, and safely sequenceable.

Inputs you should already have: a set of findings, each with a symptom, a
mechanism (root cause), and ideally a file:line location. If you only have
symptoms, go back and finish triage first — a child issue without a mechanism
is a bug report, not a workstream.

## 1. Decompose findings into workstreams

Group findings by **change surface**, not by symptom. Two findings belong in
the same workstream when fixing them touches the same module, the same layer,
or the same subsystem — because they will be reviewed, tested, and merged as a
unit.

- Cluster by area: which directory / module / boundary the fix lives in.
- Keep workstreams small enough that one reviewer can hold the whole change in
  their head. If a workstream spans three unrelated subsystems, split it.
- Aim for a handful of workstreams, not one per finding and not one for
  everything. Merge trivially-related findings; split anything that mixes
  concerns.

Then map one-to-one: **one workstream → one child issue**, and **all child
issues → one epic**. Do not create an epic per workstream; the epic is the
single roof over the whole effort.

## 2. Write each child issue

Every child issue uses the same fixed body template so reviewers always know
where to look. The full template is
`<skill_dir>/assets/child-issue-template.md` — copy it verbatim and fill each
section. The sections are:

- `## Problem / root cause` — the symptom **and** the mechanism that produces
  it. Not just "X is broken"; say why X breaks.
- `## Fix` — the concrete change, with **exact `file:line` references**. A
  reviewer should be able to open the file at that line and see the spot.
- `## Verified against / learning from others` — authoritative external
  sources with links (upstream docs, specs, the code you are matching). Label
  each source **first-party** (the authoritative source itself) vs
  **inferred/copied** (a blog, an answer, a sibling project you are imitating).
- `## Dependency / ordering` — what must land before or after this, which
  siblings conflict because they touch the same file/lines, or the single word
  `independent`.
- `## Scope` — which workstream this is, its sibling issues, and a link to the
  epic.

Do not invent extra sections and do not drop sections. The fixed shape is what
makes a set of child issues reviewable as a batch.

## 3. Write the epic

One epic tracks the whole effort. The full template is
`<skill_dir>/assets/epic-template.md`. Its sections are:

- `## Why` — the problem space and what the investigation surfaced.
- `## Target architecture / understanding` — the end-state you are steering
  toward, so each child can be judged against it.
- `## Tracked pieces` — a checklist that links **every** child issue, one line
  each: `- [ ] #NNN — one-liner`.
- `## Provenance of this understanding` — the sources behind the plan and their
  authority level (first-party vs inferred), so a later reader can tell what is
  load-bearing fact vs working assumption.

The epic is the durable record. If someone reads only the epic, they should
understand the problem, the target, every piece of work, and how much to trust
the reasoning.

## 4. Sequence the workstreams

Before you publish, compute the landing order. Two issues that edit the **same
file or the same lines** will conflict on merge — that is the primary signal.

1. List every child issue against the files/lines it changes.
2. Flag any pair that overlaps on a file (and especially on adjacent lines) —
   these cannot land in parallel.
3. For each conflict or logical prerequisite, state a direction: **"B before
   C"**, **"D after C"**. A fix that another fix builds on lands first.
4. Everything with no overlap and no prerequisite is **independent /
   parallelizable** — say so explicitly; silence reads as "unknown".

Record the resulting order in **two** places:

- the epic's `## Tracked pieces` (order the checklist, or add a one-line
  ordering note), and
- each child's `## Dependency / ordering` section (the per-issue view).

Keeping both in sync is the point: the epic gives the merge captain the global
order, and each child tells its own author what to wait for.

## Worked example (compact)

A child issue:

```markdown
## Problem / root cause
Origin guard rejects valid same-site requests: `isTrusted()` compares the raw
`Origin` header against `config.host` but never strips the port, so
`https://app.local:8443` never matches `app.local`.

## Fix
Normalize both sides before compare in `src/lib/auth/origin-guard.ts:42` —
parse to URL and compare `.hostname`, not the raw string.

## Verified against / learning from others
- WHATWG URL spec, "host vs hostname" (first-party).
- Matching normalization in `opencode`'s guard, `packages/auth/origin.ts`
  (inferred/copied — we mirror their approach, not authoritative).

## Dependency / ordering
Conflicts with #331 (also edits origin-guard.ts). Land this before #331.

## Scope
Workstream: auth. Siblings: #331, #332. Epic: #338.
```

The epic that roofs it:

```markdown
## Why
Triage of the single-window redesign surfaced five auth/routing defects that
block the new transport. Findings in research_log/2026-07-origin.md.

## Target architecture / understanding
One origin guard, host-normalized, shared by HTTP and WS paths.

## Tracked pieces
- [ ] #330 — normalize host in origin guard (land first)
- [ ] #331 — reuse guard on the WS upgrade path (after #330)
- [ ] #332 — presence registry cleanup (independent)

## Provenance of this understanding
- WHATWG URL spec (first-party).
- opencode auth module (inferred — imitated, not authoritative).
```

This shape was proven on real issues `#330` (child) and `#338` (epic) in
`stuffbucket/maximal`.

## Checklist before you publish

- Every finding maps into exactly one workstream; no orphans.
- One child issue per workstream, all filled from the fixed template.
- Exactly one epic, its checklist links every child.
- Every same-file/same-line conflict is flagged and given a direction.
- Independent items are labeled `independent`, not left silent.
- The order appears in both the epic and each child's dependency section.

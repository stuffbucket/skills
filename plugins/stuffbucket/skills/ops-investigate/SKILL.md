---
name: ops-investigate
description: "Read-only investigation discipline that precedes writing issues or code — step 1 of the ops-workflow method. Scout a problem to map its facets, then fan out parallel read-only subagents (one per facet) and produce a facet-indexed findings map where every claim cites file:path:line. Then verify each load-bearing claim against an authoritative external source and record provenance. Use when you must understand an unfamiliar system, gather facts, or confirm a claim before changing anything; when preparing to decompose work into issues; or when a surprising value needs tracing to its origin. Never author blind. Feeds ops-issue-decomposition."
license: MIT
metadata:
  category: ops
  domain: github-workflow
---

# Ops: Investigate Before Acting

Do the read-only research that must happen before you write an issue or a line
of code. This skill covers step 1 of the `ops-workflow` method:
INVESTIGATE-BEFORE-ACTING and VERIFY-AGAINST-OTHERS. Its output is a
facet-indexed findings map plus a provenance block, which feed directly into
`ops-issue-decomposition`.

Investigation is read-only. Make no edits until the findings map and provenance
block exist and every load-bearing claim is verified.

## Scout, then fan out

Never author blind. Map the problem before you dig into it.

### Scout first

Spend a short pass building a rough map of the problem's facets: which code
paths, docs, config, and history are plausibly involved. The scout is cheap and
disposable — its only job is to name the facets worth a dedicated deep read.

### Fan out, one subagent per facet

Launch read-only subagents in parallel, one per facet. Launch the whole fan-out
in a single batch so the agents run concurrently — do not spawn them one at a
time and wait. Typical facets to sweep:

- Code and dispatch paths — where the behavior actually lives.
- Docs and decision records (ADRs) — stated intent and prior rationale.
- Configuration — pins, flags, environment, defaults.
- Git history, branches, and PRs — how and when the fact entered.

For the complete facet sweep and what each subagent must return, read
`references/facet-checklist.md`.

Keep every subagent read-only. They gather and cite; they do not edit.

## Cite file:path:line in every finding

The deliverable is a findings map indexed by facet, not prose. Each entry is a
claim with an exact citation:

```text
FACET: <one of the swept facets>
CLAIM: the specific fact found
CITATION: file/path:line (absolute path, exact line)
NOTE: any ambiguity or follow-up needed
```

Rules:

- Every claim carries a `file:path:line` citation. A claim with no citation is
  a guess — drop it or mark it explicitly unverified.
- Index by facet, not by narrative. The map is a lookup table, not an essay.
- Stay read-only through this step. Findings describe the current state; they
  do not change it.

## Verify each load-bearing claim

A load-bearing claim is one a later decision or issue will rest on. Verify each
against an AUTHORITATIVE EXTERNAL source — not just the repo that stated it.

Sources in priority order:

1. Official API or product documentation.
2. The upstream project's SOURCE repository.
3. The EXACT PR or commit that introduced the fact.

Trace surprising values to their origin. A price, limit, or default copied from
another provider's entry is NOT first-party — say so explicitly. In-repo
agreement is not verification: two files can be wrong together.

Distinguish first-party and authoritative facts from inferred or copied ones.
Label every claim with how you know it, never assume.

## Produce a provenance block

Record provenance for each verified claim, labeling its authority level. This
block feeds the "Verified against / learning from others" section that
`ops-issue-decomposition` consumes.

Use the template in `references/provenance-template.md`. Each entry names the
claim, its source, the authority level (first-party / upstream-source /
introducing-commit / inferred / copied), and a link or ref that a reader can
open to check for themselves.

## Cross-references — do not duplicate

- This is step 1 of `ops-workflow`. Load that index through the skill-router
  MCP `get_skill` tool if you need the full method map.
- The findings map and provenance block are the input to
  `ops-issue-decomposition`. Load it next: `get_skill("ops-issue-decomposition")`.
- For generic git inspection mechanics — log, blame, diff, branch and PR
  archaeology — use `git-workflow-skill`. Do not restate git commands here.

## Guidelines

- Never author blind. If no findings map exists yet, you are not ready to write
  an issue or code.
- Scout, then fan out in one batch. Serial subagent launches waste the
  concurrency this step depends on.
- No claim without a `file:path:line` citation.
- No load-bearing claim without external verification and recorded provenance.
- Investigation is read-only. The first edit belongs to a later step, after the
  findings and provenance exist.

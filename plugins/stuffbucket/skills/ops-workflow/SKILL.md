---
name: ops-workflow
description: "Umbrella index and dispatcher for the ops-* skill family that manages a body of work in a GitHub repo. Acts as a semantic table of contents: routes you to the right ops-* sub-skill to load next via the skill-router. Use when planning, decomposing, or shipping a body of work in a GitHub repo; turning an investigation into child issues and a tracking epic; sequencing workstreams by dependency; setting gh identity, labels, needs-bot vs needs-triage routing, or Conventional-Commit titles; building deterministic no-LLM ops automation such as drift watchers or scheduled issue-only jobs; or whenever you are unsure which ops-* skill to use next and need to pick one. Does not itself perform the steps — it names the sibling skill to fetch and the order to run them."
license: MIT
metadata:
  category: ops
  domain: github-workflow
---

# Ops Workflow

Index for the `ops-*` skill family. This skill is a map, not a manual: it
does not perform the work. It routes you to the one sibling skill that owns
the step you are about to take, and tells you the order the steps chain in.
Load the named sibling through the skill-router before acting.

## The method

Managing a body of work in a GitHub repo follows four steps. Each step has a
dedicated sibling skill that holds the actual procedure. Do not reproduce
that procedure here — load the sibling when you reach its step.

1. Investigate before acting; verify findings against independent sources.
2. Decompose the work into workstreams: child issues plus one tracking epic,
   sequenced by dependency.
3. Establish identity and GitHub hygiene before any outward action.
4. Build deterministic, no-LLM ops automation for ongoing drift and schedules.

Generic git mechanics (the low-level branch, commit, and PR moves the steps
above depend on) are not a step of their own — they are a shared dependency;
reach for `git-workflow-skill` when you need them.

## How to load the next skill

Every sibling lives in this same repo and is fetched on demand through the
skill-router MCP, not read inline. Load one with:

```text
get_skill("ops-investigate")
```

which maps to the tool `mcp__plugin_stuffbucket_skill-router__get_skill`. If
you do not yet know which sibling you need, search first:

```text
list_skills("ops")
```

which maps to `mcp__plugin_stuffbucket_skill-router__list_skills`. Load at
most one or two skills per task — if you need more, the task is under-
decomposed, so go back to step 2.

## Intent to next-skill routing

Match your immediate intent to a row, load the named skill through the
skill-router, then follow that skill. Do not act from this table alone.

| If you are about to… | Load this skill next |
| --- | --- |
| Understand an unfamiliar system, gather facts, or confirm a claim before changing anything; fan out read-only research and record provenance | `ops-investigate` |
| Turn findings into work: split into workstreams, open child issues under one tracking epic, write issue bodies, order them by dependency | `ops-issue-decomposition` |
| Take any outward GitHub action: check `gh` identity, apply labels, route `needs-bot` vs `needs-triage`, or write Conventional-Commit titles | `ops-github-hygiene` |
| Stand up recurring automation: drift watchers, scheduled jobs, deterministic no-LLM tooling that emits issues only, with worktree and git hygiene | `ops-automation` |
| Perform generic git mechanics — branching, committing, rebasing, resolving conflicts, opening a PR — that the steps above rely on | `git-workflow-skill` |

## Recommended order and chaining

Run the steps in order; each feeds the next.

- Start with `ops-investigate`. Its verified findings are the input to
  decomposition — do not decompose from an unverified premise.
- Feed those findings into `ops-issue-decomposition`. The child issues and
  tracking epic it produces are the unit of work everything else references.
- Before you open, label, or comment on anything from step 2, pass through
  `ops-github-hygiene` once to fix identity and labeling. It gates every
  outward action, so revisit it whenever you touch GitHub.
- Reach for `ops-automation` only once the manual workflow is stable and
  worth automating. It emits issues, which flow back into step 2.
- Drop into `git-workflow-skill` at any point you need the underlying git or
  PR mechanics; it is a dependency of the other steps, not a phase of its own.

## Guidelines

- This skill only routes. If you find yourself doing the work here, stop and
  load the sibling that owns it.
- Pick exactly one sibling per intent. When two rows seem to match, you are
  probably mid-transition between steps — choose the earlier step.
- The family is: `ops-workflow` (this index), `ops-investigate`,
  `ops-issue-decomposition`, `ops-github-hygiene`, `ops-automation`, plus the
  generic `git-workflow-skill`. Cross-reference them by name; never restate
  their content.

---
name: ops-automation
description: "Build deterministic, no-LLM, no-interactive-auth ops automation for maintaining a GitHub repo, plus the git hygiene for running many agents against one repo. Use when standing up a drift watcher or scheduled maintenance job that reads a pinned source-of-truth constant and files one idempotent labelled issue instead of opening a PR; when separating ops tooling from product code under scripts/ops with its own test and typecheck lane; when deciding what an unattended CI job may poll (only public upstream authorities, never product secrets); or when isolating parallel-agent work in git worktrees while avoiding destructive stash or reset operations in a shared tree. Step 4 of the ops-workflow method."
license: MIT
allowed-tools: read_file write_file list_directory
metadata:
  category: ops
  domain: github-workflow
---

# Ops Automation

Build unattended tooling that keeps a GitHub repo honest without a human or an
LLM in the loop, and run parallel agents against that repo without stepping on
each other. This is step 4 of the `ops-workflow` method: reach for it once the
manual workflow is stable and worth automating.

This skill teaches the pattern. For generic git mechanics (branch, commit,
rebase, PR) load `git-workflow-skill`. For the label and identity conventions
of the issues this automation files, load `ops-github-hygiene`. Do not restate
their content here.

For a full worked example distilled from a production drift watcher, read
[references/drift-watcher-example.md](references/drift-watcher-example.md).

## The five principles

Every ops automation you build must hold all five. They are not style
preferences — each one closes a specific failure mode.

### 1. Deterministic, no LLM, no interactive auth

The job must produce the same result every run given the same inputs. No model
call, no prompt, no browser login, no device-code flow. If a step cannot run
unattended in CI, it does not belong in the automation.

The pinned value in source is the **single source of truth**. The tool *reads*
it; it never keeps a second copy to compare against. Duplicating the pin means
the two copies drift and the tool reports a value that no longer exists in the
product.

```text
# WRONG — the tool now holds a stale duplicate of the real pin
const WATCHED_VERSION = "1.4.2"   // must be kept in sync by hand, and won't be

# RIGHT — read the real constant out of the product source at run time
const source = await readFile("src/config.ts", "utf8")
const current = extractPin(/const VERSION = "([\d.]+)"/, source)
```

Back the read with a **parity guard** test: a colocated unit test that runs the
same extractor against the real source file. If someone renames the pinned
constant, the extractor stops matching and the test goes red in tooling CI —
*before* the automation can ship a bogus value. The extractor throwing on a
non-match (rather than returning empty) is what makes the guard bite.

### 2. Separate ops tooling from the product

Ops automation maintains the product; it is not shipped in it. Keep it in a
dedicated directory (`scripts/ops/` or equivalent) with its **own** test and
typecheck lane, distinct from the product's.

- Give it its own scripts, e.g. `check:ops` / `test:ops`, and its own test
  root so the product's `test` command never picks up tooling tests.
- Run the ops lane only on PRs that touch that path (a `paths:` filter on the
  tooling CI workflow). The product CI never runs tooling tests, and the
  tooling CI never runs product tests.
- Document the tooling in an ops/admin doc, not in the product architecture
  doc. It is operational surface, not product surface.

This keeps a flaky upstream fetch or a tooling refactor from reddening product
CI, and keeps product churn from triggering tooling runs.

### 3. Issue-only output, never auto-PR

When the automation detects something actionable, prefer **filing or refreshing
one idempotent labelled issue** over opening a pull request.

- One stable label (e.g. `external-drift`) identifies the issue. A run that
  finds drift creates it if absent or refreshes its body if present — never a
  second copy. A clean run **closes** the stale issue.
- Scope the body so a reconciliation PR can be derived from it directly: the
  exact file to change, the current value, the target value, an
  upstream-review link, and the acceptance step.
- Hand that scoped issue to the repo's triage / merge bot, which owns deriving
  and landing the PR. The automation detects and reports; it does not rewrite
  source.

Why issue-only beats auto-PR:

- Filing an issue needs only a plain `GITHUB_TOKEN` with `issues: write` — no
  GitHub App token, no bot identity to provision.
- It sidesteps the "a bot-authored PR does not trigger CI" fragility that an
  auto-PR path has to work around.
- It stays off require-PR rulesets entirely.
- A value is often duplicated in a coupled string (a version echoed inside a
  User-Agent, say), so a mechanical single-pin rewrite would half-update the
  source. A human-reviewed reconciliation guided by the issue body is the
  correct, reviewable gate.

Note: an issue created with the default `GITHUB_TOKEN` fires **no**
`issues.opened` event, so an event-driven triage workflow will not see it. Make
sure a poll-based triage backstop exists to pick it up, or drift goes silently
unhandled.

### 4. No product secrets — watch only public authorities

An unattended CI job must only poll **publicly verifiable** upstream
authorities: published releases, git blob SHAs, public catalogs. Anything you
can fetch without a product credential.

An endpoint that sits behind an authed product token with no public mirror is
**not** polled from CI. Putting a product credential into CI to reach it is a
posture violation — call it out and stop. Instead:

- Find a public proxy signal. If a schema only changes when a client version
  changes, watch the client's public releases and let that stand in for the
  schema.
- Where no public signal exists, document a **local fallback**: the maintainer
  diffs the authed endpoint locally with their own credentials when a related
  public watch fires. State this in the ops doc; do not automate it in CI.

### 5. Git and parallel-agent hygiene

Many agents against one repo will corrupt each other's work unless isolated.

- **Isolate parallel work in a worktree.** Give each concurrent agent its own
  checkout with `git worktree add ../work-<name> <branch>`, and tear it down
  with `git worktree remove` when done. Separate working trees cannot collide.

```text
git worktree add ../ops-fix-abc feature/ops-fix-abc
# ... agent works in ../ops-fix-abc ...
git worktree remove ../ops-fix-abc
```

- **Never `git stash pop` or `git stash apply` in a shared working tree.** A
  pop silently merges another worker's stash into your tree, and on conflict it
  leaves a mess that invites destructive cleanup — real work has been lost this
  way. If you must inspect a stash, do it **read-only**:

```text
git stash show -p stash@{0}   # inspect only — applies nothing
```

- **Never run history- or tree-destroying commands** that discard uncommitted
  work: `git reset --hard`, `git checkout -- <path>`, `git clean -fd`. To move
  a branch use `git switch`, `git merge --ff-only`, or `git reset --keep`; to
  unstage use `git reset --soft` or `git reset --mixed`.
- Always `git status` before any ref or history operation. If the tree is dirty
  with changes you did not make, stop and surface it rather than clearing it.

## Build checklist

Before you ship an ops automation, confirm each item:

- [ ] Runs unattended: no LLM call, no interactive auth, deterministic output.
- [ ] Reads the pinned source of truth; keeps no duplicate of it.
- [ ] A parity-guard test reds tooling CI if the pinned constant is renamed.
- [ ] Lives under `scripts/ops/` (or equivalent) with its own test/typecheck
      lane, gated by a `paths:` filter; product CI and tooling CI stay disjoint.
- [ ] Files/refreshes one idempotent labelled issue; a clean run closes it.
- [ ] Never opens a PR; needs only `GITHUB_TOKEN` with `issues: write`.
- [ ] A poll-based triage backstop catches token-authored issues.
- [ ] Polls only public authorities; product-secret endpoints get a documented
      local fallback, never a CI credential.
- [ ] Parallel work is isolated in worktrees; no `stash pop`/`apply`, no
      `reset --hard` / `checkout -- <path>` / `clean -fd` in a shared tree.
- [ ] A failed check is reported as actionable drift, not swallowed or crashed.

## Guidelines

- Detect and report; do not mutate product source from the automation. The
  scoped issue is the deliverable.
- Treat a failed check as drift, not a crash: surface it so a broken watcher
  cannot sit silently green. Exit 0 from the script and let the workflow decide.
- This is one step of a larger method. Load `ops-workflow` to see where it
  fits, `ops-github-hygiene` for the issue's label and identity conventions,
  and `git-workflow-skill` for the underlying git mechanics.

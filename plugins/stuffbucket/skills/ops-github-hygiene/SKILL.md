---
name: ops-github-hygiene
description: Enforce org GitHub conventions before any outward GitHub action — identity guarding, label routing, Conventional-Commit titling, and commit-message hygiene. Use before creating or editing issues, PRs, comments, labels, or commits in an org repo; when running any ops script that calls gh; when deciding which label (needs-bot vs needs-triage) an issue should carry; when writing an issue or PR title; or when a gh action may be running under the wrong logged-in account. Step 3 of the ops-workflow method.
license: MIT
metadata:
  category: ops
  domain: github-workflow
---

# Ops GitHub Hygiene

Apply these org rules BEFORE any outward GitHub action (creating or editing
issues, PRs, comments, labels, or pushing commits). This is step 3 of the
`ops-workflow` method.

For generic git mechanics — branching, rebase, conflict resolution, PR
creation flow — use the `git-workflow-skill`. This skill adds only the
org-specific identity, label, routing, titling, and message deltas.

## 1. Identity guard (do this first)

Many machines have several accounts logged into `gh`, and the active one is
often the wrong one. Acting under the wrong account leaks an unrelated
identity onto public artifacts. Confirm the active account matches the org's
intended identity, and switch if not, before any outward `gh` action.

Run the guard at the top of any ops script:

```bash
bash <skill_dir>/scripts/gh-identity-guard.sh <expected-login>
```

It checks `gh api user -q '.login'`, runs `gh auth switch --user <expected>`
when the active account is wrong, and aborts non-zero if the expected account
is not logged in — so downstream `gh` calls never run as the wrong identity.

Keep the git commit author consistent with the confirmed `gh` identity, so
commits and GitHub actions attribute to the same person:

```bash
git config user.name  "Expected Name"
git config user.email "expected@users.noreply.github.com"
```

## 2. Labels and routing

Use the org's actual labels: `bug`, `enhancement`, `documentation`.

Routing labels decide who handles the issue:

- `needs-bot` routes an issue to AUTONOMOUS handling by the repo's
  triage/merge bot. Add it ONLY to actionable, self-contained child issues
  that the bot can pick up and complete on its own.
- `needs-triage` is for everything else and is usually applied
  automatically. Pure tracking or epic issues get `needs-triage`.

Critical rule: NEVER add `needs-bot` to a tracking or epic issue. The bot
would try to autonomously act on work that is not self-contained. Epics
coordinate child issues; only the children may carry `needs-bot`.

## 3. Titling

Issue and PR titles are Conventional-Commit-prefixed and area-scoped. The
scope names the touched area:

```text
fix(models): correct token count for streamed responses
feat(ops): add gh identity guard to release script
refactor(config): collapse duplicate token-store loaders
docs(release): clarify squash-merge subject rule
test(ws): cover presence-registry reconnect path
epic(config): unify config sources
```

Squash-merge uses the PR TITLE as the commit subject, so the title must
itself be one valid Conventional Commit. Only `feat:` and `fix:` cut a
release — pick the prefix accordingly.

Add cross-references in titles and bodies to link related work:

```text
fix(models): guard null usage block (follow-up to #312)
test(ws): reproduce reconnect drop (surfaced by #298)
```

## 4. Commit-message hygiene

Org rule for all git messages:

- No assistant or tool self-references.
- No emojis.

Keep the subject a valid Conventional Commit and let the body explain the
why, not the how.

## Checklist

Before any outward GitHub action, confirm:

- Identity guard passed for the org's expected login.
- Git author matches the confirmed `gh` identity.
- Labels use real org labels; `needs-bot` only on self-contained children.
- Title is a single valid Conventional Commit, area-scoped, with the right
  release-cutting prefix and any cross-references.
- Commit messages carry no self-references and no emojis.

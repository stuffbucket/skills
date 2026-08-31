# Worked example: an external-surface drift watcher

A distilled walkthrough of a real, deterministic drift watcher, showing how the
five principles land in one tool. The subject repo impersonates several
third-party clients and mirrors an external API's wire contract. Those
upstreams live outside the repo and move on their own schedule, so a stale
hardcoded pin fails silently in production. The watcher turns "did an upstream
we mirror move?" into a deterministic, unattended check.

This is a pattern, not code to copy. Adapt the shapes to your repo.

## What it watches

Each row pairs a pin that is the single source of truth in the product with the
public upstream authority it must track.

| Pin (source of truth) | Upstream authority | Signal |
| --- | --- | --- |
| A client version constant in product source | That client's latest public release tag | Impersonated client version |
| A second client version, same file | Its own upstream release | Impersonated client version |
| A committed baseline blob SHA | An upstream spec-generated file's git blob SHA | Wire-contract change |
| Pinned API-version header date strings | A last-reviewed baseline value | Outbound header drift |

The tool reads each pin out of the real source file at run time. It never keeps
a second copy of the version — only the *baseline* values that have no
machine-readable "latest" (a blob SHA, a reviewed header date) are stored, and
those are the value being tracked, not a duplicate of a live constant.

## Principle 1 in practice: read, do not duplicate

The extractor is a pure function over the source text. It **throws** on a
non-match, which is what arms the parity guard.

```text
function extractPin(spec, source) {
  const m = source.match(spec.pattern)   // pattern captures the value in group 1
  if (!m?.[1]) {
    throw new Error(
      `pin ${spec.id}: pattern did not match ${spec.file} — was the constant renamed?`,
    )
  }
  return m[1]
}
```

The colocated test runs this same extractor against the real product file. If
someone renames the constant, the pattern stops matching, `extractPin` throws,
and the tooling CI goes red before the watcher can report a value that no
longer exists.

## Principle 4 in practice: only public authorities

- Version pins compare against the upstream project's latest **public release
  tag** — a plain GitHub API fetch, no product credential.
- The wire-contract signal watches a spec-generated file's **git blob SHA**. A
  SHA change stands in for a spec change; still fully public.
- One runtime endpoint returns schema **values** only behind an authed product
  token with no public mirror. The watcher does **not** call it. Instead it
  leans on a public proxy: that schema only changes when the client version
  changes, which the release watch already catches. The documented fallback is
  to diff the live schema locally with the maintainer's own credentials when
  that watch fires. No product secret ever enters CI.

## Principle 3 in practice: issue-only reconciliation

Detection is separated from reconciliation:

- The script computes drift and, when anything drifted, writes a **Markdown
  issue body** scoped for direct PR derivation: the exact file to change, the
  current value, the target value, an upstream-review link, and the reconcile
  step.
- The daily workflow files or refreshes **one** issue under a stable label
  (e.g. `external-drift`). A clean run closes the stale issue. The workflow
  never opens a PR — it needs only `GITHUB_TOKEN` with `issues: write`.
- A failed check is emitted as drift (with the error in the note), never
  swallowed, so a broken watcher cannot sit silently green.

Because the issue is created with the default token, it fires no
`issues.opened` event; a **poll-based triage backstop** picks it up so it is
never missed. Deriving and landing the reconciliation PR is the triage/merge
bot's job — or a maintainer's, from the labelled issue.

Why not auto-PR the bump: a version value is often duplicated in a coupled
string (e.g. echoed inside a User-Agent), so a mechanical single-pin rewrite
would half-update the source. Reconciling by hand, guided by the issue body, is
the correct reviewable gate. It also keeps the job off require-PR rulesets and
avoids bot-PR-CI fragility.

## Principle 2 in practice: separation of concerns

- **Code** lives under `scripts/ops/`, pure and deterministic, exporting its
  pure functions so the network-free logic is unit-testable.
- **Test** is colocated (`scripts/ops/*.test.ts`) and kept out of the product
  test root. It is the parity guard.
- **Tooling CI** runs the colocated test only on PRs that touch
  `scripts/ops/**`. The daily watcher also self-checks before it acts. Product
  CI never runs tooling tests.
- **Docs** live in the ops/admin area, not the product architecture doc.

## Reconciling a flag

Whoever picks up the labelled issue:

- **Version pin** — review the linked upstream release for behavioural changes,
  then bump the pin. Reconcile **every** occurrence, since the bare value may
  also appear in a coupled string.
- **Spec/blob SHA** — review the upstream file's history for new or changed
  fields, reconcile any affected product types, then bump the committed
  baseline SHA in the same change.
- **Header date pin** — read the provider changelog for breaking changes, then
  bump the last-reviewed baseline value in the same change.

## Running locally

```text
run watch:drift    # detect; writes an issue-body report if anything drifted
run test:ops       # the parity-guard tooling test, in its own lane
```

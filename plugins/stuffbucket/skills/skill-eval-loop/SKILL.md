---
name: skill-eval-loop
description: Run the observe-analyze-iterate loop on promptfoo evals for a skill collection. Promptfoo-specific — assumes promptfoo is installed, tests live in YAML, and results are in the standard SQLite DB at ~/.promptfoo/promptfoo.db. Use when the user has a promptfoo eval suite and wants to diagnose failures, fix them, and re-run targeted tests. Triggers on phrases like "eval failed", "analyze the promptfoo eval", "iterate on skills", or any request to improve skills based on promptfoo output.
metadata:
  author: stuffbucket
  version: 1.1.0
---

Run the observe → analyze → iterate loop on a **promptfoo** eval suite for a
skill collection. The goal: turn ambiguous failures into categorized,
actionable fixes, then validate the fix with a targeted re-run.

## Scope: Promptfoo Only

This skill is tightly scoped to [promptfoo](https://www.promptfoo.dev/). It
uses promptfoo's `--filter-pattern` flag, its SQLite schema
(`eval_results`, `evals` tables, `test_case`/`response`/`grading_result` JSON
columns), and its YAML test format. It will not work with other eval
harnesses (DeepEval, Vitest-based evals, bespoke Python runners, etc.).

The reasoning content — the three failure categories (skill weakness / false
positive / test design issue) and the fix recipes — is portable to any eval
framework. But every command in this skill assumes promptfoo. If the user is
on a different harness, read `references/categorization.md` and
`references/fix-patterns.md` for the portable reasoning, then adapt the
commands by hand.

## Prerequisites — Check Before Proceeding

Run these checks first. If any fail, stop and tell the user what's missing
rather than trying to work around it.

```bash
# 1. promptfoo CLI available?
command -v promptfoo >/dev/null || {
  echo "ERROR: promptfoo not on PATH. Install: npm install -g promptfoo"
  exit 1
}

# 2. promptfoo results DB exists?
test -f "${PROMPTFOO_DB:-$HOME/.promptfoo/promptfoo.db}" || {
  echo "ERROR: no promptfoo DB found. Run an eval first."
  exit 1
}

# 3. An inference endpoint is reachable?
#    Ollama: curl -s http://localhost:11434/api/tags
#    Or: check that the relevant API key env var is set.
```

Also confirm:

- A promptfoo eval config (`promptfooconfig.yaml` or similar) exists in the
  project
- The skills being evaluated are in a directory you can edit

Ask the user for the eval ID to analyze, or query for the most recent:

```bash
sqlite3 ~/.promptfoo/promptfoo.db \
  "SELECT id, created_at FROM evals ORDER BY created_at DESC LIMIT 5;"
```

## Step 1: Observe

Query the promptfoo DB for results of the eval in question:

```bash
sqlite3 ~/.promptfoo/promptfoo.db "
SELECT
  json_extract(test_case, '\$.description') as test,
  success,
  substr(json_extract(response, '\$.output'), 1, 800) as output_preview,
  json_extract(grading_result, '\$.reason') as reason
FROM eval_results
WHERE eval_id = '<EVAL_ID>'
ORDER BY success ASC, test;
"
```

Read the full output the model produced, not just the grader's reason. The
output shows what the model actually did; the reason tells you what the
assertion thought was wrong. Often they disagree — that's the interesting case.

## Step 2: Categorize Each Failure

Every failure falls into one of three buckets. Each has a different fix
location.

### Skill weakness

The model produced output that genuinely violates the skill's rules (e.g.,
recommends a banned font in the actual CSS it emits, skips a required step,
asks for confirmation instead of producing the deliverable).

**Fix**: Edit the SKILL.md.

- Inline the positive default the model should reach for
- Tighten ban language ("never name these fonts anywhere" beats "don't use Inter")
- Require the deliverable in the first response, not in a later round
- Remove bare `/other-skill` commands from workflow steps

### False positive

The model did the right thing but the assertion penalized it. Common causes:

- Substring match on a banned term that also appears in legitimate words ("Inter" in "interfaces")
- Anywhere-in-output check on a banned pattern that was correctly being criticized in prose
- JS assertion throwing because promptfoo passed `output` as an object, not a string
- LLM-rubric grader used a default provider without an API key

**Fix**: Edit the assertion.

- Word-boundary regex instead of substring (`\bInter\b`)
- CSS-declaration scoping instead of anywhere match
- Output-object unwrapping at the top of every JS assertion
- Point grader at the same local model

### Test design issue

The test asks for contradictory behavior. Example: "Do a UX audit" with no code
→ skill correctly refuses → assertion fails because there's no audit to grade.
Or: test provides partial context, skill correctly gates on missing context,
assertion expects the skill to proceed anyway.

**Fix**: Edit the test.

- Provide the inputs the skill needs inline in the message
- Split a multi-assertion test into separate focused tests
- Test the gating behavior explicitly ("correctly asks for X") as its own case

See `references/categorization.md` for detailed diagnostic questions for each
bucket.

## Step 3: Iterate

Apply the appropriate fix. Follow these principles:

- **Don't fight the model.** If the model reaches for a banned pattern, give it a better default inline.
- **Use positive framing.** Show what TO use, not just what to avoid.
- **Don't ask the model to infer what you can pre-compute.** Lookup tables beat rules.
- **Critical content lives in SKILL.md, not references/.** References get skipped.
- **Bump the skill version** on every skill change (e.g., 1.0.0 → 1.1.0).

See `references/fix-patterns.md` for specific edit recipes for each failure category.

## Step 4: Re-run Targeted Eval

Only re-run the failing tests, not the full suite. Construct a filter pattern from the test descriptions:

```bash
promptfoo eval -c <config>.yaml --no-cache \
  --filter-pattern "Test A description|Test B description"
```

Wait for completion. Note the new eval ID from the output.

## Step 5: Validate

Query the new eval ID the same way as Step 1. For each previously failing
test:

- **Passed**: Fix worked. Commit the changes.
- **Still failing**: Look at the output again. Was the diagnosis wrong? Was the fix incomplete?

If still failing, iterate once more — but no more than **two rounds total**. If
a third round is needed, the problem is deeper than surface fixes and requires
a structural rethink of the skill.

## Step 6: Report and Commit

Commit with a message that explains the failure mode and the fix, not just
what changed:

```text
Fix design-typeset eval failures: require CSS in Round 1 output

Previously the skill's "propose then wait for confirmation" workflow
meant single-turn evals never saw any CSS. Changed Round 1 to emit
working CSS on every response, with follow-up questions after the
deliverable, not before.
```

Report to the user:

- What you observed (tests with failure categories)
- What you changed (files + rationale)
- Re-run results (pass/fail count)
- Whether another iteration is warranted

## Anti-patterns

- **Don't re-run the full suite** when only a few tests failed — wastes time and tokens
- **Don't blindly trust the grader's reason** — read the full output to understand what actually happened
- **Don't "fix" a skill that's doing the right thing** — if the assertion is wrong, fix the assertion
- **Don't skip categorization** — applying a skill-weakness fix to a false-positive failure makes the skill worse
- **Don't iterate more than twice** — three iterations means the approach is wrong, not the details

## References

- `references/categorization.md` — diagnostic questions to classify each failure
- `references/fix-patterns.md` — edit recipes for each category (skill, assertion, test)
- `references/local-eval-setup.md` — Ollama provider config, LLM-as-judge setup, concurrency tuning
- `scripts/pull_failures.sh` — convenience script to dump failures from the eval DB

# Facet Checklist

The facets to sweep during the fan-out. Assign one read-only subagent per
facet you judge relevant. Skip a facet only when the scout showed it cannot
touch the problem. Each subagent returns findings in the map format from
`SKILL.md` — claim plus `file:path:line`.

## Code and dispatch paths

- Where the behavior is defined, and where it is invoked from.
- The dispatch or routing layer that selects this path over alternatives.
- Call sites, entry points, and the boundaries the value crosses.
- Tests that exercise the path — they document expected behavior.

Return: the defining symbol, its file/path:line, and each caller.

## Docs and decision records (ADRs)

- ADRs or decision records that mention the system or value.
- Specs, PRDs, and design notes stating intent.
- README or inline doc comments that explain rationale.

Return: the stated intent, and whether it matches the code found above.

## Configuration

- Pins, version constraints, and lockfile entries.
- Feature flags, environment variables, and their defaults.
- Config files that set the value under investigation.

Return: the effective value, its source file/path:line, and any override chain.

## Git history, branches, and PRs

- The commit that introduced or last changed the fact (use blame).
- The PR that merged it and its review discussion.
- Open branches or PRs that would change it again.

Return: the introducing commit or PR ref, its date, and the stated reason.
Use `git-workflow-skill` for the underlying git mechanics.

## Sweep discipline

- Keep every subagent read-only. Gather and cite; do not edit.
- Launch the whole set in one batch for concurrency.
- A facet with no findings is still a result — record "no evidence found" so
  the gap is visible to the next step.

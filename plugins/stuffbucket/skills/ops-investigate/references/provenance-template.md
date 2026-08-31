# Provenance Template

Fill one entry for each load-bearing claim. The completed block feeds the
"Verified against / learning from others" section of `ops-issue-decomposition`.

## Authority levels

Label each source with exactly one level, most authoritative first:

- `first-party` — official API or product documentation for the thing itself.
- `upstream-source` — the upstream project's source repository.
- `introducing-commit` — the exact PR or commit that introduced the fact.
- `inferred` — deduced from indirect evidence; not directly stated anywhere.
- `copied` — taken from another provider's or system's entry; NOT first-party
  for this subject. Name what it was copied from.

## Entry format

```text
CLAIM: the load-bearing fact
IN-REPO CITATION: file/path:line where the repo asserts it
SOURCE: authoritative external reference (URL, upstream path, or commit/PR ref)
AUTHORITY: first-party | upstream-source | introducing-commit | inferred | copied
VERIFIED: yes | no
NOTE: mismatch, staleness, or the origin a copied value traces back to
```

## Rules

- One authority level per entry. If two apply, use the more authoritative and
  note the other.
- In-repo agreement is not verification. A repo citing itself stays `inferred`
  until an external source confirms it.
- Trace surprising values to origin. If a value was copied from elsewhere, the
  authority is `copied` and the `NOTE` must name the source it came from.
- An unverified load-bearing claim blocks decomposition — mark `VERIFIED: no`
  and surface it rather than hiding it.

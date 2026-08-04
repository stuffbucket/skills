---
name: design-conform
description: "Reports where a rendered page's computed styles fall outside its own declared design tokens: colors off the token set, the identity/brand color used as a background (with viewport coverage), motion durations and easings, and off-stack fonts. Drives a real headless Chromium in light and dark, so it sees clamp()/var()/variable-font values that jsdom, tsc, and CSS linters miss. Report-only by design: it lists measured facts and applies no pass/fail thresholds, since what counts as drift is situational and belongs to a human or a project waiver layer. Use before shipping a UI or marketing-site change, to find token or brand drift a design system cannot see in source, or to wire a design-conformance report into CI."
metadata:
  category: design
license: MIT
---

# design-conform

A **design-token conformance reporter**. It loads a rendered page in a real
headless browser, reads the page's own `:root` custom properties as the token
set, and reports every place the *computed* styles fall outside it — with the
measured value beside each finding.

It is deliberately a **reporter, not a gate**. It sets no thresholds and exits
`0`. Different surfaces legitimately warrant different rulings (a hero may own
the brand color as a full bleed; a form field may not), so the judgment —
including whether a threshold applies at all — belongs to you, not the tool.
See `references/interpreting-findings.md`.

## Why a real browser (read once)

Source-level and DOM-only tools cannot answer "what color/size/motion actually
rendered here?". `jsdom`/`happy-dom` have no layout or cascade engine; they
cannot resolve `clamp()`, `vw`, `var(--token)`, `color-mix()`, or
`font-variation-settings`. A page built on fluid type and custom properties —
most modern design systems — is nearly invisible to them, and a static scan
returns confident nonsense (e.g. "flat type hierarchy" because it only saw the
two fixed sizes it could resolve). This skill computes real values in Chromium,
so the facts it reports are the facts a user sees. Sibling idea, aimed at layout
rather than tokens: the `ui-layout-verification` pattern.

## When to use

- Before claiming a UI or marketing-site change "done" — token/brand drift does
  not fail unit tests, `tsc`, or lint.
- To locate where a rendered color/font/motion left the design system, in a form
  the design system itself can't check (it lives in source; drift lives in the
  cascade).
- As a CI **report** step (pair with `--json`) surfacing what changed since the
  last run. Any pass/fail policy is layered on top by you — this tool does not
  impose one.

## One-time setup

Needs only a Chromium/Chrome binary — no npm dependency. If one is already
present (Playwright cache, or Chrome/Chromium installed) it is auto-detected. To
provision one explicitly:

```bash
npx playwright install chromium      # or install Google Chrome / Chromium
```

Resolution order: `$CHROME` / `$CHROME_PATH` → `--chrome <path>` → Playwright
cache (newest build) → `PATH` → macOS app bundles.

## How to run

The target must be a served **URL** (local preview server or a live site), not a
`file://` path — sites with root-absolute asset paths (`/fonts/…`) don't resolve
under `file://`. Serve your built output first, then point the script at it:

```bash
# 1) serve the built site (any static server on loopback)
( cd dist && python3 -m http.server 8901 --bind 127.0.0.1 ) &

# 2) report (light + dark), naming the identity token to track as a background
node <skill-dir>/scripts/conform.mjs \
  http://127.0.0.1:8901/ http://127.0.0.1:8901/for-design-teams/ \
  --identity-token --brand
```

Flags:

- `--identity-token <name>` — the token whose use as a *background* is reported
  with viewport coverage (default `--brand`). Marks show a tiny %, floods a large
  one; the tool ranks them and rules on none.
- `--schemes light,dark` — color schemes to emulate (default both).
- `--width N --height N` — viewport (default `1280×900`). Coverage % is
  viewport-relative, so report the viewport when you quote a number.
- `--json` — machine-readable output for diffing / CI.
- `--chrome <path>` — override the browser binary.

## What it reports

| Rule | What it measures (fact) |
| --- | --- |
| `off-token-color` | An opaque color (text/background/border/outline) not equal to any declared `:root` token. |
| `derived-alpha-color` | A translucent color not matching a token — often a `color-mix()`/alpha derivation of one. Informational. |
| `identity-color-as-background` | The identity token used as a background, with `% of viewport` and pixel box. Ranked by coverage; **not** thresholded. |
| `motion` | Elements animating ≥250ms or with overshoot easing (cubic-bezier y outside `[0,1]`), with the measured duration + timing function. |
| `transition-all` | `transition-property: all` (broad transitions the motion contract usually discourages). |
| `off-stack-font` | A computed `font-family` whose first family is outside the declared stacks (the "Inter-creep" signal). |

Every row is an observation with its measured value. The tool never says
"violation"; it says "here is what rendered, and here is the number."

## Interpreting + waivers

Read `references/interpreting-findings.md`. The short version: the token set is
the *seed*; an off-token value is a value that escaped that seed's scope. Whether
a given escape is intended (a sanctioned identity moment) or drift (the brand
color creeping onto a surface it shouldn't own) is a project ruling. Capture
those rulings in a project-side waiver/allowlist — that calibration layer, not a
hard-coded number, is where conformance policy actually lives. This is the same
closure logic as `boundary-seed-encoding` (the token file is the seed) and
`boundary-scope-escape` (an off-token value is an escape); use those when you
want to *close* the drift at the source rather than just report it.

## Limitations

- **Snapshot at load.** Styles applied later by JS (e.g. a transition set on a
  timer or on interaction) are not present when the page is measured, so
  runtime-only motion is missed. Trigger the state first if you need it.
- **No interaction/hover states, single viewport width** per run — vary
  `--width`/`--schemes` across runs for breadth.
- **Membership, not perception.** It checks whether a color equals a token, not
  whether two tokens are perceptually too close, nor contrast ratios. Those are
  separate checks.

## Examples

- "Check the marketing site for token drift before I ship — report only."
- "Where is the brand color used as a large surface across these pages?"
- "Emit a JSON conformance report of the built site for CI."

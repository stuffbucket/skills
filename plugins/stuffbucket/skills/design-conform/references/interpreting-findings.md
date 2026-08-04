# Interpreting design-conform findings

`design-conform` reports facts. It does not tell you what is wrong, because
"wrong" is a property of a design system's intent, not of a rendered page. This
note is how to turn the facts into rulings — and why the tool stops short of
doing that for you.

## The core stance: report, don't gate

The same measured fact means opposite things on different surfaces:

- The brand color painting **57% of the viewport** is *correct* on a landing
  hero whose whole job is to be the identity moment — and it is *drift* on a
  settings panel, a form, or a content card.
- A **600ms** transition is *right* for a deliberate editorial reveal and *wrong*
  for a button hover.
- An **off-token color** is a bug when it's a stray hex someone typed, and
  expected when it's a third-party embed (a Stripe iframe, an OG image) that was
  never meant to inherit the token set.

A tool that hard-codes "> 6% brand background = fail" would be right on one page
and wrong on the next, and every project would immediately be maintaining a pile
of inline suppressions to fight it. So this tool measures and ranks; **you rule.**
That keeps the policy where it belongs — in the project, versioned, reviewed —
instead of frozen into a detector's constants.

## Turning a finding into a ruling

For each observation, ask three questions in order:

1. **Is this surface allowed to do this?** The identity color as a full-bleed
   background is sanctioned on exactly the surfaces your design system names as
   identity moments. Everywhere else it is a candidate for drift. (This is why
   `identity-color-as-background` reports *coverage* — so the one flood stands out
   from the many marks, which read at a fraction of a percent.)
2. **Is the value a token, a token derivation, or foreign?** An exact token →
   fine. A `color-mix()`/alpha derivation of a token (`derived-alpha-color`) →
   usually fine, sometimes worth pinning to a named token. A fully foreign value
   → the strongest drift signal; find where it entered.
3. **Did I author this, or did it arrive?** Third-party embeds, injected
   widgets, and generated content produce off-token values you neither own nor
   should "fix". Waive them by origin, not by muting the rule.

## Where the policy lives: a waiver layer

Capture rulings as project-side data, not as edits to the detector. A minimal
shape that composes with the `--json` output:

```jsonc
// design-conform.waivers.json  (example — this tool does not read it; your
// wrapper/CI does, filtering the JSON report before deciding anything)
{
  "identity-color-as-background": [
    { "sel": "header.hero", "reason": "sanctioned identity moment (landing hero)" }
  ],
  "transition-all": [
    { "reason": "global base transition; tracked, not yet migrated to explicit props" }
  ],
  "off-token-color": [
    { "selPrefix": "iframe", "reason": "third-party embed; not in our token scope" }
  ]
}
```

The waiver file *is* the design-conformance policy for a project. It is small,
legible, and every entry carries a human reason — which is exactly what a frozen
threshold cannot give you. Reviewing the waiver file over time is how you watch
the system's real boundaries move.

## Relationship to the boundary-* family

This tool is the *detection* end of a closure loop:

- The token file (`:root` custom properties, a `theme.ts`, a `tokens.css`) is the
  **seed** in `boundary-seed-encoding` — the single source of truth every color
  should trace back to.
- An off-token value is a **scope escape** (`boundary-scope-escape`): a value
  whose identity left the seed's scope and now lives independently in the
  cascade.

`design-conform` reports the escapes at runtime. When you want to *close* one at
the source — replace a stray hex with `var(--token)`, or hoist a repeated literal
into the token file — reach for those skills. Reporting is the cheap, continuous
signal; closure is the fix.

## Reading the specific rules

- **`off-token-color`** — strongest signal. A rendered opaque color equal to no
  token. Trace it to source and either tokenize it or confirm it's foreign.
- **`derived-alpha-color`** — a translucent color off the token set. Most are
  `color-mix(... transparent)` or `rgba()` derivations of a token; benign, but a
  cluster can mean an ad-hoc tint that deserves its own token.
- **`identity-color-as-background`** — read the coverage column. Marks sit near
  0%; a surface using the identity color reads as several percent to tens of
  percent. One large number among small ones is the thing to look at.
- **`motion`** — the measured duration and easing. Long durations and overshoot
  easings (bounce/spring) are worth a glance against your motion contract; some
  are intentional editorial motion. Note the load-snapshot limitation — JS-driven
  motion may not appear.
- **`transition-all`** — `transition-property: all` casts a wide net (transitions
  properties you didn't intend, including layout). Usually a cheap tightening, but
  not itself a defect.
- **`off-stack-font`** — a first `font-family` outside the declared stacks. The
  classic "a generic font crept in" signal. Confirm the element should inherit
  your type system at all (again: embeds are exempt).

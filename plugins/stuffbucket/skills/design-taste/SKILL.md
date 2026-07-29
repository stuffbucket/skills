---
name: design-taste
description: De-sloppification gate for UI — detect and remove generic "AI slop", the machine-default tells across type, color, layout, depth, decoration, motion, copy, and page structure, with an imperative check-and-fix for each. Ships a deterministic detector (scripts/detect-slop.py) that greps the code for the mechanical tells so the model only judges what a regex can't. Run it as the FINAL step after other design skills (design-frontend, design-bolder, design-polish, design-animate) to confirm no slop was introduced, or standalone when a design "looks AI-made", generic, templated, or safe. It removes slop; it does not manufacture taste — route clean-but-timid results to design-bolder.
metadata:
  author: stuffbucket
  version: 0.1.0
  status: spike
---

# Design taste

A **de-sloppification gate**, run against one standard: taste is a design where a real decision was
made; slop is a design where every unforced choice took the machine default. This skill is
**subtractive** — it finds default choices and replaces them. It does not manufacture taste; if a
design is clean but forgettable, that is `design-bolder`'s job, not this one.

It reads tells from the code (fonts, color values, layout primitives, copy strings), so it needs no
live render. Ground it in `.design-context.md`.

## Run me last

This is the closing check of a design sequence. After building (`design-frontend`), amplifying
(`design-bolder`), animating (`design-animate`), or polishing (`design-polish`), run this before
shipping to confirm none of that work introduced slop. Any skill that generates or edits UI should
hand off here as its final step. On its own, run it whenever a design "looks AI-made."

## Procedure

1. **Run the detector.** `python3 scripts/detect-slop.py <target-paths>` (from the skill directory;
   pass the project or component dir). It returns a deterministic candidate list for every
   machine-detectable tell — fonts, pure `#000`/`#fff`, the AI gradient, glassmorphism, animated
   layout props, bounce easing, slop emoji, and the copy phrases. Do not eyeball these; the regex
   already found them. Exit code 1 = hits.
2. **Triage the hits.** Each is a candidate, not a verdict — some are legitimate in context (an
   "unlock" feature, a mandated system font). Keep the real tells; drop false positives with a
   one-line reason.
3. **Run the judgment checks by hand** — the ones a regex cannot see (below): contrast spread,
   centered/symmetric layout, card-nesting, spacing rhythm, three-of-everything, section order,
   hero-art, one-direction coherence, and the friction test (*was ANY choice argued for?*).
4. **Fast exit.** IF the detector returned nothing real AND one choice was argued for → record PASS
   in one line and stop. Do not over-audit clean work; a no-op is the right result on a design that
   already made decisions.
5. **Apply the move** for each surviving tell — the fix from the detector hit or the judgment check,
   not "make it more unique."
6. **Coherence pass.** Confirm the screen sits inside one direction (editorial, brutalist, luxury,
   industrial, soft…). IF two or more aesthetics are averaged together → pick one, remove the rest.
7. **Report** in the format below.

## Not this skill's job

IF the design is clean of tells but nothing was argued for (correct, competent, forgettable) → do
NOT invent a bold move here. Report it as "slop-free but timid" and route to `design-bolder`. This
gate removes defaults; it does not generate the one decision that makes a design memorable.

## The standard the checks enforce

"Not slop" means, in priority order:

1. **One decision pushed well past the default, with everything else deferring to it** — not ten
   timid flourishes.
2. **Deliberate contrast** — the primary element reads many times louder than the secondary, not
   1.2×. Flat contrast is the signature of "generated."
3. **One coherent direction** — not several aesthetics averaged together.
4. **Anchored to a specific reference**, not to adjectives ("modern / clean / premium" is the absence
   of a brief).

## The checks

The **fix lookup**. `detect-slop.py` (step 1) already flags the mechanical categories — Type, Color,
Depth, Motion, Decoration, and Copy — so triage its hits against these entries rather than re-scanning
by hand. **Layout & depth (alignment/cards/grid/spacing), hero-art, and Page structure are judgment
checks** a regex can't see — run those yourself (they are also listed in procedure step 3). The
exhaustive per-tell list is in `references/slop-taxonomy.md`. Format: **Check X.** IF `<condition>` →
DO `<fix>`.

### Type

- **Check the primary font.** IF Inter, Roboto, Open Sans, Helvetica Neue, or system-ui → replace with
  a distinctive display+body pairing (`design-frontend` Font Requirements); remove from fallbacks too.
- **Check the ramp.** IF one weight carries hierarchy, or steps are ~1.2× → rebuild a modular scale
  with real weight contrast.
- **Check headings.** IF gradient text → make solid.

### Color

- **Check for a purple→blue / indigo→violet / teal→cyan gradient.** IF present → remove; one hue + one
  sharp accent.
- **Check neutrals.** IF `#000` or `#fff` → near-black/near-white tinted toward the brand hue.
- **Check distribution.** IF five evenly-weighted colors, none dominant → one color owns the majority,
  one accent.
- **Check text on color.** IF gray body text on a saturated panel → fix contrast; never gray-on-color.

### Layout & depth

- **Check alignment.** IF everything centered → strong left edge; center only for effect.
- **Check cards.** IF every block is a card, or cards nest → let content sit on the page; group with
  space and type.
- **Check the feature grid.** IF symmetric equal-column three-across → asymmetric, or one item breaks
  out.
- **Check spacing.** IF uniform everywhere → tight within groups, generous between.
- **Check surfaces.** IF glassmorphism, identical drop shadows, or one border-radius on everything →
  decide depth per surface; most need none.

### Decoration

- **Check for emoji** as icons/bullets, or ✨/🚀/🔥 as "delight" → remove; one real icon set with
  intent, or nothing.
- **Check headings.** IF a large rounded icon sits above every heading → drop most.
- **Check hero art.** IF blob shapes / gradient mesh / floating abstract SVG stand in for content →
  real UI, real imagery, or type.

### Motion

- **Check entrances.** IF every element fades-and-rises, or every hover micro-bounces → one
  orchestrated load; motion only for state changes.
- **Check properties.** IF width/height/margin/padding animate, or easing is bounce/elastic →
  transform+opacity only, ease-out quart/quint/expo.

### Copy (highest-signal — text betrays the model fastest)

- **Check for adjective triads** ("powerful, simple, and beautiful") → one specific claim.
- **Check for empty verbs/adverbs** ("elevate, unlock, supercharge, seamlessly, effortlessly") → the
  concrete action.
- **Check for template openers** ("In today's fast-paced world…", "Say goodbye to…") → open on the
  reader's specific problem.
- **Check for hedged claims** ("powerful yet simple") → choose the one true emphasis.
- **Check for emoji headers and Title Case On Everything** → sentence case; headings as claims.
- Hand the rewrite to `design-clarify`.

### Page structure

- **Check section order.** IF hero → three feature cards → 3 steps → testimonial → pricing → CTA at
  equal width → reorder to the real argument; let one section break format.
- **Check cardinality.** IF everything comes in threes → use the real number.

## Report format

Output exactly:

1. **Verdict** — one line: PASS (no slop) / slop-free but timid / slop found. Include a count of
   distinct tells (weight type, color, and copy heaviest).
2. **Tells** — ranked list; each is `location — tell → fix`. Empty on PASS.
3. **Next** — the single skill to hand to, if any (`design-bolder` if timid, `design-clarify` for copy).

## Do NOT flag these

- A convention chosen for a stated reason (regulated flow, accessibility-first, a mandated design
  system). Conventional-on-purpose is a decision. Confirm intent before "fixing" it.
- A restrained interface precise in its few choices — earned minimalism, not slop.

## When NOT to use this skill

- **Generating new UI** → `design-frontend`. **Making a timid design bold** → `design-bolder`. This
  skill only removes slop.
- **UX/usability problems** → `design-critique` / `design-audit`. **Technical quality** →
  `design-check`. **Brand identity / logos / illustration** → out of scope.

## Sequence & cross-family edges

- **Runs AFTER** (as their final gate): `design-frontend`, `design-bolder`, `design-animate`,
  `design-polish`, `design-distill`, `design-colorize`.
- **Routes TO**: `design-bolder` (slop-free but timid), `design-clarify` (copy rewrite),
  `design-distill` (when the fix is restraint).
- **Pairs WITH**: `design-critique` (UX quality) and `design-check` (technical) — this skill owns the
  aesthetic-defaultness axis only.
- **Run first**: `design-context` — "slop" is undefined without an audience and a feeling.

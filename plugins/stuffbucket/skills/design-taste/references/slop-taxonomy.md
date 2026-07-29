# Slop taxonomy — the full check list

Extended checks for `design-taste`, one per known tell. Run any that the SKILL.md procedure points
you to. Format is imperative: **Check X.** IF `<condition>` → DO `<fix>`. A terse `(why)` appears
only where it changes a judgment call — otherwise just run the check and apply the fix.

Meta-rule: a default is a decision you declined to make. You are not trying to eliminate every tell;
you are ensuring one real decision exists (SKILL.md steps 2–3) and pulling the rest into line.

---

## Type

- **Check the primary face.** IF Inter / Roboto / Open Sans / Helvetica Neue / Arial / system-ui →
  replace with a distinctive display+body pairing; remove from fallbacks too.
- **Check for a lone trendy geometric** (e.g. Space Grotesk carrying the whole personality) → pair it
  with a contrasting body face, or replace.
- **Check the ramp.** IF one weight carries hierarchy, or size steps are ~1.2× → build a modular
  scale with real weight contrast.
- **Check headings.** IF gradient text → make solid.
- **Check case.** IF headings are Title Case Or Fragments → sentence case; write them as claims.
- **Check eyebrows.** IF letter-spaced all-caps micro-labels sit above every section → keep at most
  one; delete the rest.

## Color

- **Check for the gradient.** IF purple→blue / indigo→violet / teal→cyan → remove; one hue + one sharp
  accent.
- **Check neutrals.** IF `#000` or `#fff` → near-black/near-white tinted toward the brand hue (oklch /
  color-mix).
- **Check distribution.** IF five evenly-weighted colors, none dominant → one color owns ~60%+, one
  accent for ~5%.
- **Check text on color.** IF gray body text on a saturated panel → fix contrast; never gray-on-color.
- **Check dark mode.** IF near-black with glowing neon accents by default → choose light/dark for a
  reason; if dark, restrained accents, real surfaces, no glow.
- **Check for framework palettes.** IF Bootstrap/Tailwind default colors ship as the identity →
  define brand-specific scales.

## Depth & material

- **Check blur.** IF glassmorphism on more than a true overlay → remove; most surfaces need no blur.
- **Check shadows.** IF uniform drop shadows on rounded rectangles everywhere → flatten most; shadow
  only signals real elevation.
- **Check radius.** IF one border-radius on everything → vary intentionally, or commit to sharp
  corners.
- **Check callouts.** IF thick one-side colored border on rounded boxes → reconsider whether it needs
  a box.

## Layout & space

- **Check alignment.** IF everything centered → strong left edge; center only for effect.
- **Check cards.** IF every block is a card, or cards nest → let content sit on the page; group with
  space + type.
- **Check the grid.** IF symmetric equal-column three-across → asymmetric split, varied weights, or
  one item breaks out.
- **Check spacing.** IF uniform everywhere → tight within groups, generous between; clamp() for fluid.
- **Check the column.** IF one max-width center column stacking forever → break it: full-bleed moment,
  off-grid anchor, or a horizontal band.

## Decoration & iconography

- **Check emoji.** IF used as icons or bullets, or ✨/🚀/🔥 as delight → remove; one real icon set with
  intent, or nothing.
- **Check feature icons.** IF a large rounded-square icon above every heading → drop most; if kept,
  small, sharp, earned.
- **Check hero art.** IF blob shapes / gradient mesh / floating abstract SVG stand in for content →
  real UI, real imagery, or type; or commit to the abstract treatment as the whole direction.
- **Check fake data.** IF sparklines / decorative charts with no real data → show real data or remove.

## Imagery

- **Check illustration.** IF generic 3D blobs / isometric / "corporate Memphis" figures → real
  screenshots, real photography, or a committed style true to the direction.
- **Check photos.** IF Unsplash "team collaborating" / "laptop on desk" placeholders → specific,
  on-brand imagery; if none exists, say so rather than defaulting.

## Motion

- **Check entrances.** IF every element fades-and-rises on scroll → one orchestrated staggered load;
  then motion only for state changes.
- **Check hovers.** IF uniform micro-bounce/spring on everything → purposeful, varied, restrained.
- **Check properties.** IF width/height/margin/padding animate → transform + opacity only
  (grid-template-rows for height).
- **Check easing.** IF bounce/elastic → ease-out quart/quint/expo for most UI.

## Copy & voice (highest-signal — run these first on any text)

- **Check for adjective triads** ("powerful, simple, and beautiful") → one specific claim.
- **Check for empty verbs** ("elevate, unlock, supercharge, streamline, revolutionize") → the concrete
  action the product performs.
- **Check for frictionless adverbs** ("seamlessly, effortlessly, instantly, simply") → cut; let the
  design show ease.
- **Check for setup phrases** ("In today's fast-paced world…", "Say goodbye to…", "Whether you're a
  beginner or a pro…") → open on the reader's specific problem.
- **Check for hedged claims** ("powerful yet simple", "beautiful and functional") → choose the one
  true emphasis.
- **Check cadence.** IF emoji section headers, em-dash-then-restate rhythm, or "Meet [Product]" →
  rewrite in the product's actual voice; vary sentence shape.
- **Check specificity.** IF benefits are vague, no numbers, no domain nouns → concrete nouns, real
  numbers, the user's words. Hand to `design-clarify`.

## Page & section structure

- **Check order.** IF hero → 3 feature cards → 3 steps → testimonial → pricing → FAQ → CTA at equal
  width → reorder to the real argument; let one section break format.
- **Check cardinality.** IF everything comes in threes → use the real number; two strong beats three
  padded.
- **Check the footer.** IF four equal link columns → weight it to what matters.

## Meta-checks (run last; catch what the per-item checks miss)

- **Check for friction.** IF no single choice was argued for → the fix is not deleting tells; add one
  bold decision (SKILL.md step 3) and rebuild around it. (This is the root check.)
- **Check coherence.** IF two or more aesthetics are averaged in one screen (glass + brutalist +
  pastel + neon) → pick one direction, remove the rest.
- **Check contrast spread.** IF sizes, weights, colors, and spaces all sit in a narrow band → decide a
  hierarchy and push its extremes apart.
- **Check symmetry.** IF perfectly, lifelessly symmetric → introduce one intentional asymmetry.
- **Check the brief.** IF the only direction is "modern and clean" → replace with an audience, a
  feeling, and a named reference before anything else.

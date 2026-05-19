---
name: design-typeset
description: Improves typography by fixing font choices, hierarchy, sizing, weight, and readability so text feels intentional. Use when the user mentions fonts, type, readability, text hierarchy, sizing looks off, or wants more polished, intentional typography.
metadata:
  author: stuffbucket
  version: 4.1.0
---

Typography cannot be zero-shot. Propose candidates from the approved pairings table below, validate
with measurements, and refine from designer feedback. The designer is the evaluator — surface
specific decisions for their attention rather than making silent choices.

**Every response must ship working CSS.** Even Round 1 (proposal) includes the full recommended type
ramp CSS block with concrete `rem` values, `font-weight` values, `font-family`, `line-height`, and
`letter-spacing`. Do not stop at candidate names and wait for confirmation — always include the ramp
`:root` block and a sample font-family declaration for the top candidate so the designer can see and
react to actual CSS.

## Font Rules

**Recommend only fonts from the Approved Pairings table below.** Do not propose fonts from memory or
suggest "industry standards" that aren't listed. The table is the complete universe of acceptable
choices. When the designer asks for typography help, pick 2-3 pairings from the row that matches
their context.

**Never name these fonts anywhere in the response** — not as recommendations, not as comparisons,
and not in diagnostic critique of the existing code: Inter, Roboto, Arial, Open Sans, Helvetica
Neue, Space Grotesk, Comic Sans, Papyrus. If the existing code uses one of these, describe it as
"the current sans-serif" or "the existing body font" — never quote its name. Same for `system-ui` as
a primary font: critique it as "the browser default" without naming it. Replace it entirely in the
output CSS.

## Approved Pairings

Pick 2-3 candidates from the row matching the context:

| Context | Pairing | Heading | Body | Use for |
| --------- | --------- | --------- | ------ | --------- |
| **SaaS / App UI** | S1 | Plus Jakarta Sans | Plus Jakarta Sans | B2B dashboards, project management, CRM, settings |
| | S2 | Outfit | Source Sans 3 | Analytics, fintech dashboards, enterprise tools |
| | S3 | Manrope | Manrope | Developer tools, API platforms, CI/CD UIs |
| | S4 | Sora | DM Sans | Collaboration tools, HR platforms, community apps |
| | S5 | Geist Sans | Geist Sans | Dense admin panels, data tables, compact sidebars |
| **Editorial / Content** | E1 | Fraunces | Commissioner | Magazines, longform blogs, brand storytelling |
| | E2 | Newsreader | Newsreader | Long articles, newsletters, book-style layouts |
| | E3 | General Sans | Satoshi | Developer docs, help centers, knowledge bases |
| | E4 | Instrument Serif | Instrument Sans | Design portfolios, case studies, agency blogs |
| **Marketing / Landing** | M1 | Cabinet Grotesk | Switzer | SaaS landing pages, pricing pages, product launches |
| | M2 | Clash Display | Synonym | Design tool marketing, creative agency sites |
| | M3 | Bricolage Grotesque | Nunito Sans | Startup homepages, feature tours, PLG pages |
| | M4 | Darker Grotesque | Libre Franklin | Enterprise marketing, security, compliance, fintech |
| **Technical / Developer** | T1 | JetBrains Mono | Atkinson Hyperlegible Next | API docs, CLI tools, open-source project pages |
| | T2 | IBM Plex Sans | IBM Plex Sans | Infrastructure, cloud dashboards, monitoring |
| | T3 | Lexend | Lexend | Data science, research tools, statistical dashboards |
| **Expressive / Brand** | X1 | Gambarino | Chillax | Creative brand sites, lifestyle products, portfolios |
| | X2 | Zodiak | Erode | Fashion, luxury goods, premium brand sites |
| | X3 | Bebas Neue | Figtree | Event sites, music/entertainment, bold launches |

Full details (CSS imports, weights, fallback stacks, OpenType features) are in `references/font-pairings.md` and `references/font-stacks.md`. Load those when implementing.

## Type Ramps

Copy the pre-built ramp that matches the application. Don't compute ratios — use the reference.

| Application | Ramp file section | Base | Ratio |
| ------------- | ------------------- | ------ | ------- |
| Data-dense dashboard / admin | Compact SaaS | 14px | 1.125 |
| General web app / forms | Standard App | 16px | 1.200 |
| Blog / documentation | Editorial | 18px | 1.250 |
| Landing page / splash | Marketing | 18px | 1.333 |
| Metrics / KPI dashboard | Dashboard | 14px | mixed |

Full `:root` token blocks for all ramps are in `references/type-ramps.md`. The two most common ramps are inlined below — **paste the matching block directly into your response**:

### Compact SaaS Ramp (dashboards, admin, data-dense UIs)

```css
:root {
  /* ---- Compact SaaS Type Ramp (base 14px, ratio 1.125) ---- */
  --text-xs:   0.6875rem;  /* 11px — badges, timestamps */
  --text-sm:   0.75rem;    /* 12px — table cells, metadata */
  --text-base: 0.875rem;   /* 14px — body, inputs */
  --text-md:   1rem;       /* 16px — emphasized body */
  --text-lg:   1.125rem;   /* 18px — card titles */
  --text-xl:   1.25rem;    /* 20px — section headings */
  --text-2xl:  1.5rem;     /* 24px — page titles */
  --text-3xl:  1.75rem;    /* 28px — primary heading */
  --text-4xl:  2.25rem;    /* 36px — KPI hero metric */

  --weight-xs:   500;
  --weight-sm:   400;
  --weight-base: 400;
  --weight-md:   500;
  --weight-lg:   600;
  --weight-xl:   600;
  --weight-2xl:  700;
  --weight-3xl:  700;
  --weight-4xl:  700;

  --leading-xs:   1.3;
  --leading-sm:   1.4;
  --leading-base: 1.5;
  --leading-md:   1.5;
  --leading-lg:   1.3;
  --leading-xl:   1.25;
  --leading-2xl:  1.2;
  --leading-3xl:  1.15;
  --leading-4xl:  1.1;

  --tracking-xs:   0.02em;
  --tracking-sm:   0.01em;
  --tracking-base: 0em;
  --tracking-lg:  -0.005em;
  --tracking-xl:  -0.01em;
  --tracking-2xl: -0.015em;
  --tracking-3xl: -0.02em;
  --tracking-4xl: -0.025em;
}
```

### Standard App Ramp (general web apps, forms, settings)

```css
:root {
  /* ---- Standard App Type Ramp (base 16px, ratio 1.2) ---- */
  --text-xs:   0.75rem;    /* 12px */
  --text-sm:   0.875rem;   /* 14px */
  --text-base: 1rem;       /* 16px */
  --text-md:   1.125rem;   /* 18px */
  --text-lg:   1.25rem;    /* 20px */
  --text-xl:   1.5rem;     /* 24px */
  --text-2xl:  2rem;       /* 32px */
  --text-3xl:  2.5rem;     /* 40px */
  --text-4xl:  3rem;       /* 48px */

  --weight-base: 400;
  --weight-md:   500;
  --weight-lg:   600;
  --weight-xl:   600;
  --weight-2xl:  700;
  --weight-3xl:  700;
  --weight-4xl:  800;

  --leading-base: 1.6;
  --leading-lg:   1.4;
  --leading-xl:   1.3;
  --leading-2xl:  1.2;
  --leading-3xl:  1.15;
  --leading-4xl:  1.1;
}
```

## Before Starting

Check for `.design-context.md` or a **Design Context** section in loaded instructions. If missing, ask about target audience, brand personality, and application type before proceeding.

## Round 1: Propose (with CSS)

Every Round 1 response **must include working CSS**. Don't stop at candidate names and ask for confirmation — show the designer real code for the top candidate so they can react to something concrete.

1. **Identify context** from loaded instructions or by asking.
2. **Pick 2-3 pairings** from the matching row in the Approved Pairings table above. Mark one as the top recommendation.
3. **Pick a type ramp** from the Type Ramps table.
4. **For each candidate**, give a short mood/personality line and where it excels or compromises. Don't dump full CSS for every candidate — just name and description.
5. **Emit concrete CSS for the top candidate**, always including:
   - The full `:root` ramp block for the chosen ramp (paste from the inline blocks above — contains `rem` values, `font-weight` numbers, `line-height`, `letter-spacing`).
   - A `body { font-family: ...; }` declaration with the full fallback stack.
   - Specific per-element declarations that replace the user's existing CSS with ramp tokens. For every size the user supplied, show the new `font-size`, `font-weight`, and `line-height`.
   - A diagnosis line per existing rule that's flat, too small, or misweighted (e.g., "12px label
     and 13px delta are within 1px — collapse both to `--text-sm` (12px) but differentiate with
     weight and color").
6. **Then ask the designer** whether to switch to a different candidate or tweak the ramp. The question comes *after* the CSS, not instead of it.

### Required output shape for Round 1

Every Round 1 response must contain all of:

- [ ] A `:root { ... }` block with `--text-*`, `--weight-*`, `--leading-*` custom properties (rem values + weight numbers).
- [ ] At least one `font-family:` declaration using the recommended font.
- [ ] At least one `font-weight:` declaration (not just in `:root`) showing weight on a real selector.
- [ ] A `color:` declaration in hex or oklch for body text.
- [ ] Specific per-selector CSS replacing the user's problem sizes, each with `font-size`, `font-weight`, and `line-height` (or `letter-spacing`).
- [ ] Diagnosis of the flat-hierarchy problem in the existing sizes (e.g. "11/12/13/15/20 are too close — space them with the ramp").

## Round 2: Implement + Validate

1. **Apply the chosen pairing and ramp.** Copy the font stack from `references/font-stacks.md` including `@font-face`, `font-family`, and any required `font-feature-settings`.
2. **Run the validator:**

   ```bash
   echo '{"tokens":{...},"weights":{...},"line_heights":{...},"font_primary":"...","base_px":16,"context":"saas"}' | python3 scripts/validate_typography.py
   ```

   Review the output:
   - **Errors** — fix before showing the designer
   - **Warnings** — mention with your recommendation
   - **`attention_needed`** — surface directly to the designer with context
3. **Show what was applied** and flag decisions needing their eye:
   - "The heading-to-body ratio is 2.5x — strong hierarchy but may feel dramatic for a data-dense dashboard. Want it tighter?"
   - "Line height on captions is 1.3 — readable but tight. Increase to 1.4 for multi-line text."
4. **Suggest WHERE to break the grid**, don't break it silently. Flag opportunities for expressive typography (hero headings, pull quotes) and let the designer decide.

## Round 3: Refine from Feedback

Map subjective feedback to specific CSS changes:

| Designer Says | CSS Change |
| --- | --- |
| "Too heavy" | Reduce `font-weight` by 100-200, or increase `letter-spacing` 0.01-0.02em |
| "Too light" | Increase `font-weight` by 100-200, or decrease `letter-spacing` |
| "Too tight" | Increase `line-height` by 0.1-0.2, or increase spacing tokens |
| "Too loose" | Decrease `line-height` by 0.1-0.15, or tighten `margin-bottom` |
| "Headings don't pop" | Increase heading/body size ratio, or increase weight contrast |
| "Feels generic" | Try a different pairing from the same row in the Approved Pairings table |
| "Too many sizes" | Consolidate — merge tokens within 2px of each other |
| "Hard to read" | Check `line-height` ≥ 1.5, `max-width` ≤ 65ch, size ≥ 16px, contrast |
| "Doesn't match the brand" | Shift to a different row (e.g., SaaS → Expressive) |

Apply changes, re-run the validator, show what changed and why.

## Readability Guardrails (always enforce)

- Body text minimum: 16px / 1rem
- Line height: headings 1.1-1.2, body 1.5-1.7
- Line length: `max-width: 65ch` on text containers
- Use `rem` not `px` for font sizes
- Use `tabular-nums` for data tables
- Set `font-display: swap` on all web fonts
- Meet WCAG contrast ratios, zoomable to 200%

## Repeat Rounds 2-3

Continue the implement-validate-refine loop until the designer is satisfied.

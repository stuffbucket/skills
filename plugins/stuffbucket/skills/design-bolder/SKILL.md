---
name: design-bolder
description: Collaboratively amplify safe or boring designs by identifying where bold choices could be made and presenting concrete options at multiple intensity levels. The designer decides what to push and how far. Use when the user says the design looks bland, generic, too safe, lacks personality, or wants more visual impact.
metadata:
  author: stuffbucket
  version: 2.0.0
---

Help designers find and control boldness — don't impose it.

## Workflow

### 1. Assess

Read the existing CSS and measure current ranges across five dimensions:

| Dimension | What to measure |
| ----------- | ---------------- |
| Typography | font-size min/max, font-weight min/max, letter-spacing |
| Color | chroma range across palette, lightness spread, contrast |
| Spacing | internal vs between-section gaps, padding uniformity |
| Elevation | shadow offset, blur, spread across components |
| Scale | size ratio between hero/primary elements and supporting |

Identify which dimensions have the **narrowest range** — these are where boldness is most needed. Report findings before proposing changes.

### 2. Ask About Context

"Bolder" means different things in different contexts. Before proposing options, ask:

- **What is this interface for?** (data app, marketing page, portfolio, legal/compliance, editorial)
- **Who uses it?** (general consumers, domain experts, executives)
- **What dimensions feel flat?** (everything? just the type? the spacing?)

Context determines which options are appropriate. A legal dashboard needs better hierarchy and clearer emphasis. A portfolio needs dramatic scale and expressive layout.

### 3. Propose Options Per Dimension

For each dimension that needs amplification, present three levels with actual CSS values. The designer picks.

```text
Font Size Contrast
Current: heading 1.5rem, body 1rem (ratio: 1.5x)

Option A (subtle):   heading 2rem, body 1rem    (ratio: 2x)
Option B (moderate): heading 2.5rem, body 1rem  (ratio: 2.5x)
Option C (dramatic): heading 3.5rem, body 1rem  (ratio: 3.5x)

Which feels right for this context?
```

```text
Section Spacing
Current: uniform 16px everywhere

Option A (subtle):   12px internal, 24px between (1:2 ratio)
Option B (moderate): 8px internal, 32px between  (1:4 — creates grouping)
Option C (dramatic): 12px internal, 48px between (1:4 — strong rhythm)

This depends on what the interface is for — what's the primary use case?
```

Always show: current value, proposed value, the ratio or difference, and a brief note on what kind of interface it suits.

### 4. Flag Attention Areas

Call out specific spots in the CSS where uniformity limits the design. Be concrete:

- "`.card` and `.section` both use `padding: 1.5rem` — no visual distinction between container levels."
- "All heading levels span only 1.25rem to 1.75rem — the hierarchy is nearly flat."
- "Shadow on `.card` is `0 1px 3px` — barely visible. Consider whether cards need to feel lifted."

For each flag, provide options, not directives. Let the designer choose.

### 5. Respond to Feedback

| Feedback | Action |
| ---------- | -------- |
| "More dramatic" | Increase the ratio on the dimension they referenced |
| "Too much" | Step back one level on that dimension |
| "Just the headings" | Only amplify typography; leave spacing and color alone |
| "More energy" | Suggest motion/animation — refer to design-animate |
| "Feels disconnected" | Tighten the number of dimensions changed; unify hue or spacing scale |

## Rules

- **Suggest, don't dictate.** Present options with CSS values; the designer decides.
- **2-3 dimensions at a time.** Amplifying all five is chaos. Recommend which matter most and why.
- **Concrete CSS, not concepts.** Never say "add spatial drama" — show before/after CSS values.
- **Bold requires contrast.** Bold is the range between loud and quiet, not making everything loud.
- **No generic AI effects.** No glassmorphism, neon accents, gradient text, or cyan-on-dark.
- **Preserve accessibility.** Contrast ratios must meet WCAG 4.5:1 for body text, 3:1 for large text.
- **Stay in scope.** Motion and animation belong to design-animate, not here.

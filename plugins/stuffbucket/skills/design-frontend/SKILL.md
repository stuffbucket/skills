---
name: design-frontend
description: Create distinctive, production-grade frontend interfaces that avoid generic AI aesthetics. Use when building web components, pages, dashboards, applications, or when any design skill needs project context. Also triggers on requests to style, beautify, or redesign UI.
metadata:
  author: stuffbucket
  version: 1.2.0
---

Guide creation of distinctive, production-grade frontend interfaces. Implement real working code with exceptional attention to aesthetic details and creative choices.

## Context Gathering Protocol

Design skills produce generic output without project context. Confirm design context before any design work.

**Required context** — every design skill needs:

- **Target audience**: Who uses this and in what context?
- **Use cases**: What jobs are they trying to get done?
- **Brand personality/tone**: How should the interface feel?

**CRITICAL**: You cannot infer this from the codebase. Code tells you what was built, not who it's for or what it should feel like.

> **Gathering order:**

1. **Check loaded instructions**: If a **Design Context** section exists, proceed.
2. **Check .design-context.md**: Read from project root. If it has the required context, proceed.
3. **Run /design-context (REQUIRED)**: If neither source has context, run it now. Do NOT skip. Do NOT infer from codebase.

---

## Design Direction

Commit to a BOLD aesthetic direction:

- **Purpose**: What problem does this solve? Who uses it?
- **Tone**: Pick an extreme — brutally minimal, maximalist, retro-futuristic, organic, luxury,
  playful, editorial, brutalist, art deco, soft/pastel, industrial. Use as inspiration but design
  one true to the direction.
- **Constraints**: Framework, performance, accessibility requirements.
- **Differentiation**: What makes this UNFORGETTABLE?

**CRITICAL**: Choose a clear direction and execute with precision. Bold maximalism and refined minimalism both work — the key is intentionality, not intensity.

Implement working code that is production-grade, visually striking, cohesive, and meticulously refined.

## Font Requirements

When generating any UI code, pick a font pairing from the list below. **Never recommend or use**
Inter, Roboto, Arial, Open Sans, Helvetica Neue, Space Grotesk, Comic Sans, Papyrus, or system-ui as
primary — not as a fallback, not as "industry standard", not to compare against. If the user's
existing code uses one of these, replace it entirely.

| Context | Pairing | Heading | Body |
| --------- | --------- | --------- | ------ |
| SaaS / App UI | S1 | Plus Jakarta Sans | Plus Jakarta Sans |
| SaaS / App UI | S2 | Outfit | Source Sans 3 |
| SaaS / App UI | S3 | Manrope | Manrope |
| SaaS / App UI | S5 | Geist Sans | Geist Sans |
| Editorial / Content | E1 | Fraunces | Commissioner |
| Editorial / Content | E3 | General Sans | Satoshi |
| Editorial / Content | E4 | Instrument Serif | Instrument Sans |
| Marketing / Landing | M1 | Cabinet Grotesk | Switzer |
| Marketing / Landing | M2 | Clash Display | Synonym |
| Technical / Developer | T1 | JetBrains Mono | Atkinson Hyperlegible Next |
| Technical / Developer | T2 | IBM Plex Sans | IBM Plex Sans |
| Expressive / Brand | X1 | Gambarino | Chillax |
| Expressive / Brand | X2 | Zodiak | Erode |

If you need typography-specific guidance beyond font selection (type ramps, weight systems,
validation), invoke /design-typeset — it has the complete 19-pairing table, pre-built type ramps by
application, and quantitative validation scripts.

## Aesthetics Guidelines

### Typography

Choose fonts that are beautiful, unique, interesting. Pair a distinctive display font with a refined body font.

- **DO**: Modular type scale with fluid sizing (clamp). Vary weights/sizes for clear hierarchy. Choose a pairing from the Font Requirements table above.
- **DON'T**: Inter, Roboto, Arial, Helvetica Neue, Open Sans, Space Grotesk, system-ui as primary,
  or any font not in the Font Requirements table. Monospace as lazy "technical" shorthand. Large
  icons with rounded corners above every heading.

### Color & Theme

Commit to a cohesive palette. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.

- **DO**: Modern CSS color functions (oklch, color-mix, light-dark). Tint neutrals toward brand hue.
- **DON'T**: Gray text on colored backgrounds. Pure black (#000) or white (#fff). Cyan-on-dark,
  purple-to-blue gradients, neon accents on dark. Gradient text for "impact". Default dark mode with
  glowing accents.

### Layout & Space

Create visual rhythm through varied spacing. Embrace asymmetry. Break the grid intentionally for emphasis.

- **DO**: Tight groupings, generous separations. Fluid spacing with clamp(). Asymmetric compositions.
- **DON'T**: Wrap everything in cards. Nest cards inside cards. Identical card grids. Hero metric layout template. Center everything. Same spacing everywhere.

### Visual Details

- **DO**: Intentional, purposeful decorative elements reinforcing brand.
- **DON'T**: Glassmorphism everywhere. Rounded elements with thick colored border on one side.
  Sparklines as decoration. Rounded rectangles with generic drop shadows. Modals unless truly no
  alternative.

### Motion

Focus on high-impact moments: one well-orchestrated page load with staggered reveals beats scattered micro-interactions.

- **DO**: Motion for state changes. Exponential easing (ease-out-quart/quint/expo). grid-template-rows for height animations.
- **DON'T**: Animate layout properties (width, height, padding, margin) — transform and opacity only. Bounce or elastic easing.

### Interaction

- **DO**: Progressive disclosure — start simple, reveal through interaction. Design empty states that teach. Make every interactive surface intentional and responsive.
- **DON'T**: Repeat information. Make every button primary — use hierarchy.

### Responsive

- **DO**: Container queries (@container). Adapt for different contexts.
- **DON'T**: Hide critical functionality on mobile — adapt, don't amputate.

---

## The AI Slop Test

If you showed this to someone and said "AI made this," would they believe immediately? If yes, that's the problem.

A distinctive interface should make someone ask "how was this made?" not "which AI made this?"

The DON'T guidelines above are the fingerprints of AI-generated work.

---

## Implementation

Match implementation complexity to the aesthetic vision. Maximalist = elaborate code with extensive animations. Minimalist = restraint, precision, careful spacing and typography.

Interpret creatively. Make unexpected choices. No design should be the same. Vary between light/dark, different fonts, different aesthetics. NEVER converge on common choices.

For detailed guidance, read these references:

- `references/visual-foundations.md` — color systems, typography scales, spacing, layout grids, responsive patterns, visual hierarchy, data visualization
- `references/research-methods.md` — user research methods (interviews, personas, journey maps, JTBD)
- `references/design-strategy.md` — design briefs, principles, competitive analysis, metrics, stakeholder alignment

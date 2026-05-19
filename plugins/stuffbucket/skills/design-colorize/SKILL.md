---
name: design-colorize
description: Add strategic color to features that are too monochromatic or lack visual interest, making interfaces more engaging and expressive. Use when the user mentions the design looking gray, dull, lacking warmth, needing more color, or wanting a more vibrant or expressive palette.
metadata:
  author: stuffbucket
  version: 1.3.0
---

Add strategic color to monochromatic or gray interfaces. **Every response proposes both a light-mode
and a dark-mode palette, then validates both with `scripts/validate_colors.py` and reports the
results.**

## Pick the Right Hue for the Claim

Before proposing a primary color, read the user's brand language ("calming
blue", "trustworthy", "energetic", "premium"). Map that claim to a hue
range using `references/hue-angles.md` — the validator's `claimed_hue_label`
input checks the chosen hue is actually in that range. Picking 220° for
"calming blue" is a **claim mismatch**: 220° is cyan/medical-device
territory; trust blue lives at 250–265°.

## Before Starting

Check for a `.design-context.md` file or **Design Context** in loaded instructions. If missing, ask
about target audience and brand personality. Also scan the existing CSS for any brand colors already
in use.

## All Colors in OKLCH

Define every color using OKLCH. It is perceptually uniform — equal steps in lightness look equal to the human eye, unlike HSL.

```css
/* OKLCH: oklch(lightness chroma hue) */
/* lightness: 0 (black) to 1 (white) */
/* chroma: 0 (gray) to 0.4 (vivid) */
/* hue: 0-360 degrees */

:root {
  --primary: oklch(0.55 0.18 250);     /* vivid blue */
  --primary-light: oklch(0.92 0.04 250); /* tinted surface */
  --primary-dark: oklch(0.35 0.15 250);  /* pressed state */
}
```

To generate a scale from a single color, hold the hue constant and vary lightness and chroma:

```css
--blue-50:  oklch(0.97 0.02 250);
--blue-100: oklch(0.93 0.04 250);
--blue-200: oklch(0.87 0.08 250);
--blue-300: oklch(0.78 0.12 250);
--blue-400: oklch(0.67 0.16 250);
--blue-500: oklch(0.55 0.18 250);  /* base */
--blue-600: oklch(0.48 0.16 250);
--blue-700: oklch(0.40 0.14 250);
--blue-800: oklch(0.30 0.10 250);
--blue-900: oklch(0.20 0.08 250);
```

## Contrast Requirements (Validated by Script)

All color choices must meet WCAG 2.1:

- **Normal text**: 4.5:1 minimum contrast ratio against background
- **Large text** (18px+ or 14px bold): 3:1 minimum
- **UI components** (borders, icons, focus rings): 3:1 minimum
- **Never rely on color alone** to convey meaning — always pair with icons, labels, or patterns

Do **not** guess contrast ratios — compute them. Every palette proposal must
be passed through `scripts/validate_colors.py`, which computes WCAG 2.1 +
APCA Lc for every declared text/background pairing in both light and dark
modes. Report the JSON output inline so the user can verify.

## Light + Dark Mode Required

Every proposal ships both modes. The same token keys must exist in both
palettes (`background`, `surface-1`, `text-primary`, `accent-primary`,
`success`, `warning`, `error`, etc.), with lightness polarity inverted for
surface tokens and contrast preserved for text pairings. The validator
enforces this.

## Running the Validator

Pipe a JSON palette through the script:

```bash
echo '{
  "light": {
    "background": "#ffffff",
    "surface-1": "oklch(0.97 0.005 255)",
    "border":    "oklch(0.88 0.01 255)",
    "text-primary":   "#0f172a",
    "text-secondary": "#475569",
    "primary":  "oklch(0.50 0.18 258)",
    "success":  "oklch(0.58 0.16 150)",
    "warning":  "oklch(0.68 0.16 75)",
    "error":    "oklch(0.48 0.20 25)"
  },
  "dark": {
    "background": "#0a0a0a",
    "surface-1":  "#1a1a1a",
    "border":     "oklch(0.30 0.01 255)",
    "text-primary":   "#f5f5f5",
    "text-secondary": "#a1a1aa",
    "primary":  "oklch(0.72 0.18 258)",
    "success":  "oklch(0.72 0.16 150)",
    "warning":  "oklch(0.82 0.16 75)",
    "error":    "oklch(0.62 0.20 25)"
  },
  "text_pairs": [
    ["text-primary", "background"],
    ["text-primary", "surface-1"],
    ["text-secondary", "background"]
  ],
  "ui_pairs":   [["primary", "background"]],
  "semantic":   ["success","warning","error"],
  "primary_token":      "primary",
  "claimed_hue_label":  "trust blue"
}' | python3 scripts/validate_colors.py
```

The validator returns `{valid, score, issues, metrics, attention_needed}`.
It checks:

- **WCAG 2.1 + APCA contrast** for every declared pair (both modes)
- **Claimed-hue label** — primary hue must be in the canonical range
- **Scale completeness** — missing stops in `--neutral-50/100/.../900`
- **Semantic discriminability** — Δhue ≥ 60° AND/OR ΔL ≥ 0.10
- **Red-green collision** — success and error at similar luminance
- **Light/dark polarity** — surface tokens must invert
- **Required token coverage** — background, surface, text, border, primary

When `issues` contains any `severity: error`, adjust the palette (the
`suggestion` field names the OKLCH L or H to change) and re-run until
the output is clean.

## How to Colorize

### Step 1: Replace Pure Grays with Tinted Neutrals

Find every gray in the CSS. Tint it toward the brand hue.

```css
/* BEFORE: Pure grays — cold, lifeless */
--gray-50: #f9fafb;
--gray-200: #e5e7eb;
--gray-500: #6b7280;
--gray-900: #111827;

/* AFTER: Tinted toward blue (hue 250) — warm, cohesive */
--gray-50:  oklch(0.98 0.005 250);
--gray-200: oklch(0.91 0.01 250);
--gray-500: oklch(0.55 0.02 250);
--gray-900: oklch(0.15 0.02 250);
```

**The change**: Add chroma 0.005-0.02 with the brand hue to every neutral. This creates subtle warmth without visible color.

### Step 2: Define Semantic Colors

```css
:root {
  /* Success */
  --success: oklch(0.55 0.16 155);
  --success-light: oklch(0.92 0.04 155);

  /* Error */
  --error: oklch(0.55 0.20 25);
  --error-light: oklch(0.92 0.04 25);

  /* Warning */
  --warning: oklch(0.70 0.16 75);
  --warning-light: oklch(0.92 0.04 75);

  /* Info */
  --info: oklch(0.55 0.14 250);
  --info-light: oklch(0.92 0.04 250);
}
```

Apply to: status badges, form validation, toast messages, progress indicators.

### Step 3: Apply the 60-30-10 Distribution

- **60% Neutrals** — backgrounds, body text, borders (the tinted grays from Step 1)
- **30% Primary** — navigation, headers, primary buttons, active states, links
- **10% Accent** — notifications, badges, hover highlights, key data points

```css
/* Primary: used for interactive and structural elements */
.btn-primary { background: var(--primary); color: white; }
a { color: var(--primary); }
.nav-active { border-bottom: 2px solid var(--primary); }

/* Accent: used sparingly for emphasis */
.badge-new { background: var(--accent); }
.metric-highlight { color: var(--accent); }
```

### Step 4: Colorize Surfaces (Light + Dark)

Replace white-on-white card stacks with tinted surfaces at different
elevation levels. Produce both light and dark mode with matching tokens:

```css
/* LIGHT MODE */
:root {
  --background: oklch(0.97 0.005 250);
  --surface-1:  oklch(0.99 0.002 250);
  --surface-2:  oklch(1.00 0.000 0);      /* pure white on hover = lift */
  --sidebar:    oklch(0.95 0.010 250);
}

/* DARK MODE */
[data-theme="dark"] {
  --background: oklch(0.18 0.010 250);
  --surface-1:  oklch(0.22 0.015 250);
  --surface-2:  oklch(0.26 0.020 250);
  --sidebar:    oklch(0.15 0.010 250);
}
```

The token names are identical; only the L values invert. Text tokens follow
the same rule: `--text-primary` in light mode is dark; in dark mode it is
light.

### Step 5: Validate

Pipe the palette (both modes) through `scripts/validate_colors.py`. Fix any
`severity: error` issues and iterate until the validator returns
`"valid": true`. Include the validator output in the response.

## Process

1. **Read existing CSS** — list every color value (hex, rgb, hsl, or named).
2. **Identify the brand hue** — from existing accent colors, or ask the user.
3. **Apply Steps 1-4**: tint neutrals → define semantics → distribute 60/30/10 → layer surfaces (light + dark).
4. **Validate (Step 5)**: run `scripts/validate_colors.py`, report results, iterate on any errors.

## What NOT to Do

- Do not use `#3B82F6` (Tailwind default blue) — choose a brand-specific hue
- Do not add color without running `validate_colors.py`
- Do not claim a brand mood ("calming", "trustworthy", "premium") with a hue from the wrong range — see `references/hue-angles.md`
- Do not use pure black `#000` or pure white `#fff` for large areas — always tint
- Do not add purple-to-blue gradients — this is generic AI aesthetic
- Do not colorize everything — 60% of the interface should remain neutral
- Do not give success and error the same luminance — red-green colorblind users will see identical grays

## References

- `references/hue-angles.md` — OKLCH hue → brand-mood mapping with anchors
  for well-known brand primaries (IBM, LinkedIn, Spotify, HubSpot, etc.)
- `scripts/validate_colors.py` — deterministic checker for contrast,
  scale completeness, semantic discriminability, and claim/hue match

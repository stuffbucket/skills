# Font Stacks Reference

Complete CSS font-family stacks for every font used in the pairings file. Each entry includes the
variable font import, the full fallback stack with metric-compatible system fonts, required OpenType
settings, and the font-display strategy.

Use these stacks exactly. Do not guess at fallbacks. Do not omit the font-display declaration.

---

## Google Fonts — Sans Serif

### Plus Jakarta Sans

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap');

/* Or self-host: */
@font-face {
  font-family: 'Plus Jakarta Sans';
  src: url('/fonts/PlusJakartaSans-Variable.woff2') format('woff2');
  font-weight: 200 800;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-plus-jakarta: 'Plus Jakarta Sans', 'SF Pro Display', -apple-system, 'Segoe UI', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** none required (single axis: wght)
- **font-display:** swap
- **Notes:** Slightly rounded terminals. Good at 14px+.

---

### Outfit

```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap');

@font-face {
  font-family: 'Outfit';
  src: url('/fonts/Outfit-Variable.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-outfit: 'Outfit', 'SF Pro Display', -apple-system, 'Segoe UI', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** none required
- **font-display:** swap
- **Notes:** Geometric, even stroke weight. Strong at display sizes.

---

### Source Sans 3

```css
@import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,200..900;1,200..900&display=swap');

@font-face {
  font-family: 'Source Sans 3';
  src: url('/fonts/SourceSans3-Variable.woff2') format('woff2');
  font-weight: 200 900;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-source-sans: 'Source Sans 3', 'Source Sans Pro', -apple-system, 'Segoe UI', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** none required
- **font-display:** swap
- **Notes:** Humanist, excellent body text. Good numeric figures with `tabular-nums`.

---

### Manrope

```css
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap');

@font-face {
  font-family: 'Manrope';
  src: url('/fonts/Manrope-Variable.woff2') format('woff2');
  font-weight: 200 800;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-manrope: 'Manrope', 'SF Pro Display', -apple-system, 'Segoe UI', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1, 'calt' 1`
- **font-variation-settings:** none required
- **font-display:** swap
- **Notes:** Wide letterforms, good for technical UIs. No italic — use weight for emphasis.

---

### Sora

```css
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@100..800&display=swap');

@font-face {
  font-family: 'Sora';
  src: url('/fonts/Sora-Variable.woff2') format('woff2');
  font-weight: 100 800;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-sora: 'Sora', 'SF Pro Display', -apple-system, 'Segoe UI', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** none required
- **font-display:** swap
- **Notes:** Geometric with personality. Single weight axis, no italic. Use for headings or single-family systems.

---

### DM Sans

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap');

@font-face {
  font-family: 'DM Sans';
  src: url('/fonts/DMSans-Variable.woff2') format('woff2');
  font-weight: 100 1000;
  font-style: normal;
  font-display: swap;
  font-optical-sizing: auto;
}

:root {
  --font-dm-sans: 'DM Sans', 'SF Pro Text', -apple-system, 'Segoe UI', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** uses opsz axis — set `font-optical-sizing: auto`
- **font-display:** swap
- **Notes:** Geometric workhorse with optical sizing. Excellent body face. Has true italic.

---

### Commissioner

```css
@import url('https://fonts.googleapis.com/css2?family=Commissioner:wght@100..900&display=swap');

@font-face {
  font-family: 'Commissioner';
  src: url('/fonts/Commissioner-Variable.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-commissioner: 'Commissioner', 'SF Pro Text', -apple-system, 'Segoe UI', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** has FLAR (flare) and VOLM (volume) custom axes — leave at defaults unless experimenting
- **font-display:** swap
- **Notes:** Low-contrast sans with variable custom axes. Clean body text.

---

### Instrument Sans

```css
@import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&display=swap');

@font-face {
  font-family: 'Instrument Sans';
  src: url('/fonts/InstrumentSans-Variable.woff2') format('woff2');
  font-weight: 400 700;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-instrument-sans: 'Instrument Sans', 'SF Pro Text', -apple-system, 'Segoe UI', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** wght, wdth axes available
- **font-display:** swap
- **Notes:** Pairs with Instrument Serif. Crisp, neutral, professional.

---

### Bricolage Grotesque

```css
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap');

@font-face {
  font-family: 'Bricolage Grotesque';
  src: url('/fonts/BricolageGrotesque-Variable.woff2') format('woff2');
  font-weight: 200 800;
  font-style: normal;
  font-display: swap;
  font-optical-sizing: auto;
}

:root {
  --font-bricolage: 'Bricolage Grotesque', 'SF Pro Display', -apple-system, 'Segoe UI', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1, 'calt' 1`
- **font-variation-settings:** opsz axis — set `font-optical-sizing: auto`
- **font-display:** swap
- **Notes:** Optical sizing, inktraps, humanist quirks. Best at heading sizes.

---

### Nunito Sans

```css
@import url('https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wght@0,6..12,200..1000;1,6..12,200..1000&display=swap');

@font-face {
  font-family: 'Nunito Sans';
  src: url('/fonts/NunitoSans-Variable.woff2') format('woff2');
  font-weight: 200 1000;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-nunito-sans: 'Nunito Sans', 'SF Pro Text', -apple-system, 'Segoe UI', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** none required
- **font-display:** swap
- **Notes:** Soft, rounded, approachable. Good body text for friendly brands.

---

### Darker Grotesque

```css
@import url('https://fonts.googleapis.com/css2?family=Darker+Grotesque:wght@300..900&display=swap');

@font-face {
  font-family: 'Darker Grotesque';
  src: url('/fonts/DarkerGrotesque-Variable.woff2') format('woff2');
  font-weight: 300 900;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-darker-grotesque: 'Darker Grotesque', 'SF Pro Display', -apple-system, 'Segoe UI', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** none required
- **font-display:** swap
- **Notes:** Tall x-height, condensed. High impact at display sizes. Not ideal for small body text.

---

### Libre Franklin

```css
@import url('https://fonts.googleapis.com/css2?family=Libre+Franklin:ital,wght@0,200..900;1,200..900&display=swap');

@font-face {
  font-family: 'Libre Franklin';
  src: url('/fonts/LibreFranklin-Variable.woff2') format('woff2');
  font-weight: 200 900;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-libre-franklin: 'Libre Franklin', 'Franklin Gothic', -apple-system, 'Segoe UI', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** none required
- **font-display:** swap
- **Notes:** Based on Franklin Gothic. Professional, neutral, wide weight range.

---

### Lexend

```css
@import url('https://fonts.googleapis.com/css2?family=Lexend:wght@100..900&display=swap');

@font-face {
  font-family: 'Lexend';
  src: url('/fonts/Lexend-Variable.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-lexend: 'Lexend', 'SF Pro Text', -apple-system, 'Segoe UI', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** none required
- **font-display:** swap
- **Notes:** Designed for reading fluency research. Wide spacing, open counters. No italic available.

---

### Atkinson Hyperlegible Next

```css
@import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:ital,wght@0,400..800;1,400..800&display=swap');

@font-face {
  font-family: 'Atkinson Hyperlegible Next';
  src: url('/fonts/AtkinsonHyperlegibleNext-Variable.woff2') format('woff2');
  font-weight: 400 800;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-atkinson: 'Atkinson Hyperlegible Next', 'Verdana', -apple-system, 'Segoe UI', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** none required
- **font-display:** swap
- **Notes:** Maximizes character differentiation (Il1, O0). Best-in-class legibility. Designed by Braille Institute.

---

### IBM Plex Sans

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,100..700;1,100..700&display=swap');

@font-face {
  font-family: 'IBM Plex Sans';
  src: url('/fonts/IBMPlexSans-Variable.woff2') format('woff2');
  font-weight: 100 700;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-ibm-plex-sans: 'IBM Plex Sans', 'SF Pro Text', -apple-system, 'Segoe UI', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1, 'calt' 1`
- **font-variation-settings:** none required
- **font-display:** swap
- **Notes:** Shares metrics with Plex Serif and Plex Mono. Swap freely within the Plex family. Good tabular figures.

---

### Figtree

```css
@import url('https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,300..900;1,300..900&display=swap');

@font-face {
  font-family: 'Figtree';
  src: url('/fonts/Figtree-Variable.woff2') format('woff2');
  font-weight: 300 900;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-figtree: 'Figtree', 'SF Pro Text', -apple-system, 'Segoe UI', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** none required
- **font-display:** swap
- **Notes:** Friendly, geometric, open. Good body text for approachable brands. Has true italic.

---

## Google Fonts — Serif

### Fraunces

```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,100..900;1,9..144,100..900&display=swap');

@font-face {
  font-family: 'Fraunces';
  src: url('/fonts/Fraunces-Variable.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
  font-optical-sizing: auto;
}

:root {
  --font-fraunces: 'Fraunces', 'Georgia', 'Times New Roman', serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** `'SOFT' 0, 'WONK' 1` — SOFT controls serif softness (0=sharp, 100=soft); WONK enables quirky alternate forms
- **font-display:** swap
- **Notes:** 4 variable axes (wght, opsz, SOFT, WONK). Use optical sizing for automatic adjustments. WONK 1 adds character at display sizes.

---

### Newsreader

```css
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800&display=swap');

@font-face {
  font-family: 'Newsreader';
  src: url('/fonts/Newsreader-Variable.woff2') format('woff2');
  font-weight: 200 800;
  font-style: normal;
  font-display: swap;
  font-optical-sizing: auto;
}

:root {
  --font-newsreader: 'Newsreader', 'Georgia', 'Times New Roman', serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1, 'onum' 1` — old-style numerals suit editorial content
- **font-variation-settings:** uses opsz axis
- **font-display:** swap
- **Notes:** Optical sizing adapts letterforms between 6pt and 72pt. Enable `font-optical-sizing: auto`. True italic included.

---

### Instrument Serif

```css
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');

@font-face {
  font-family: 'Instrument Serif';
  src: url('/fonts/InstrumentSerif-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-instrument-serif: 'Instrument Serif', 'Georgia', 'Times New Roman', serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** none (single weight)
- **font-display:** swap
- **Notes:** Display serif only — do not use for body text. Single weight (400). Pairs exclusively with Instrument Sans.

---

## Google Fonts — Monospace

### JetBrains Mono

```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap');

@font-face {
  font-family: 'JetBrains Mono';
  src: url('/fonts/JetBrainsMono-Variable.woff2') format('woff2');
  font-weight: 100 800;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-jetbrains-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'Liberation Mono', monospace;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1, 'calt' 1` — enable coding ligatures (!=, =>, ->, ===)
- **font-variation-settings:** none required
- **font-display:** swap
- **Notes:** Coding ligatures on by default. Disable with `'liga' 0, 'calt' 0` if unwanted. 143 code-specific ligatures.

---

### IBM Plex Mono

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,100..700;1,100..700&display=swap');

@font-face {
  font-family: 'IBM Plex Mono';
  src: url('/fonts/IBMPlexMono-Variable.woff2') format('woff2');
  font-weight: 100 700;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-ibm-plex-mono: 'IBM Plex Mono', 'Consolas', 'Liberation Mono', 'Menlo', monospace;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** none required
- **font-display:** swap
- **Notes:** Shares metrics with Plex Sans and Plex Serif. No coding ligatures — use for code display where ligatures would confuse.

---

## Google Fonts — Display

### Bebas Neue

```css
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');

@font-face {
  font-family: 'Bebas Neue';
  src: url('/fonts/BebasNeue-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-bebas-neue: 'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1`
- **font-variation-settings:** none (single weight, not variable)
- **font-display:** swap
- **Notes:** All-caps display face. Single weight only. Do not use for body text. Do not apply
  text-transform: uppercase — the font is already uppercase-only. Tighten letter-spacing at large
  sizes (letter-spacing: -0.02em at 48px+).

---

## Fontshare — Sans Serif

### General Sans

```css
/* Download from: https://www.fontshare.com/fonts/general-sans */
@font-face {
  font-family: 'General Sans';
  src: url('/fonts/GeneralSans-Variable.woff2') format('woff2');
  font-weight: 200 700;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-general-sans: 'General Sans', 'SF Pro Display', -apple-system, 'Segoe UI', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** none required
- **font-display:** swap
- **Notes:** Must self-host. Tight grotesque, Swiss influenced. Good heading face.

---

### Satoshi

```css
/* Download from: https://www.fontshare.com/fonts/satoshi */
@font-face {
  font-family: 'Satoshi';
  src: url('/fonts/Satoshi-Variable.woff2') format('woff2');
  font-weight: 300 900;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-satoshi: 'Satoshi', 'SF Pro Text', -apple-system, 'Segoe UI', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** none required
- **font-display:** swap
- **Notes:** Must self-host. Modern geometric, warm personality. Excellent body text.

---

### Cabinet Grotesk

```css
/* Download from: https://www.fontshare.com/fonts/cabinet-grotesk */
@font-face {
  font-family: 'Cabinet Grotesk';
  src: url('/fonts/CabinetGrotesk-Variable.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-cabinet-grotesk: 'Cabinet Grotesk', 'SF Pro Display', -apple-system, 'Segoe UI', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** none required
- **font-display:** swap
- **Notes:** Must self-host. Punchy geometric. Best at 24px+ for headings and hero text.

---

### Switzer

```css
/* Download from: https://www.fontshare.com/fonts/switzer */
@font-face {
  font-family: 'Switzer';
  src: url('/fonts/Switzer-Variable.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-switzer: 'Switzer', 'SF Pro Text', -apple-system, 'Segoe UI', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** none required
- **font-display:** swap
- **Notes:** Must self-host. Swiss neo-grotesk, clean and neutral. Reliable body text.

---

### Clash Display

```css
/* Download from: https://www.fontshare.com/fonts/clash-display */
@font-face {
  font-family: 'Clash Display';
  src: url('/fonts/ClashDisplay-Variable.woff2') format('woff2');
  font-weight: 200 700;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-clash-display: 'Clash Display', 'SF Pro Display', -apple-system, 'Segoe UI', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** none required
- **font-display:** swap
- **Notes:** Must self-host. Display face — do not use for body text below 20px. Slightly condensed geometric forms.

---

### Synonym

```css
/* Download from: https://www.fontshare.com/fonts/synonym */
@font-face {
  font-family: 'Synonym';
  src: url('/fonts/Synonym-Variable.woff2') format('woff2');
  font-weight: 200 700;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-synonym: 'Synonym', 'SF Pro Text', -apple-system, 'Segoe UI', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** none required
- **font-display:** swap
- **Notes:** Must self-host. Clean neo-grotesk. Good body companion for display faces.

---

### Chillax

```css
/* Download from: https://www.fontshare.com/fonts/chillax */
@font-face {
  font-family: 'Chillax';
  src: url('/fonts/Chillax-Variable.woff2') format('woff2');
  font-weight: 200 700;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-chillax: 'Chillax', 'SF Pro Display', -apple-system, 'Segoe UI', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** none required
- **font-display:** swap
- **Notes:** Must self-host. Relaxed geometric, slightly retro vibe. Works for body at 16px+.

---

## Fontshare — Serif

### Gambarino

```css
/* Download from: https://www.fontshare.com/fonts/gambarino */
@font-face {
  font-family: 'Gambarino';
  src: url('/fonts/Gambarino-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-gambarino: 'Gambarino', 'Georgia', 'Times New Roman', serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** none (single weight, not variable)
- **font-display:** swap
- **Notes:** Must self-host. Display serif — single weight only. Dramatic ball terminals. Use for headings at 32px+ only.

---

### Zodiak

```css
/* Download from: https://www.fontshare.com/fonts/zodiak */
@font-face {
  font-family: 'Zodiak';
  src: url('/fonts/Zodiak-Variable.woff2') format('woff2');
  font-weight: 200 800;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-zodiak: 'Zodiak', 'Didot', 'Georgia', 'Times New Roman', serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** none required
- **font-display:** swap
- **Notes:** Must self-host. Modern didone. High stroke contrast — use at 24px+ for headings. Thin strokes may disappear at small sizes.

---

### Erode

```css
/* Download from: https://www.fontshare.com/fonts/erode */
@font-face {
  font-family: 'Erode';
  src: url('/fonts/Erode-Variable.woff2') format('woff2');
  font-weight: 300 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Erode';
  src: url('/fonts/Erode-VariableItalic.woff2') format('woff2');
  font-weight: 300 700;
  font-style: italic;
  font-display: swap;
}

:root {
  --font-erode: 'Erode', 'Georgia', 'Times New Roman', serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1`
- **font-variation-settings:** none required
- **font-display:** swap
- **Notes:** Must self-host. Text serif with subtle wedge serifs. Works for body text at 16px+. Has italic.

---

## Self-Host — Geist

### Geist Sans

```css
/* Download from: https://vercel.com/font */
@font-face {
  font-family: 'Geist';
  src: url('/fonts/GeistVF.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-geist: 'Geist', 'SF Pro Text', -apple-system, 'Segoe UI', sans-serif;
}
```

- **font-feature-settings:** `'kern' 1, 'liga' 1, 'calt' 1, 'ss01' 1` — ss01 enables alternate glyphs
- **font-variation-settings:** none required
- **font-display:** swap
- **Notes:** Must self-host (not on Google Fonts). Engineered for UI by Vercel. Clear at 11px+. Tight metrics ideal for dense layouts. Monoline strokes.

---

## Global Font Defaults

Apply these to every project regardless of which fonts are selected.

```css
/* Apply to all text */
body {
  font-kerning: normal;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  font-optical-sizing: auto;
}

/* Tabular numbers for data contexts */
.tabular-nums {
  font-variant-numeric: tabular-nums lining-nums;
}

/* Proportional numbers for running prose */
.proportional-nums {
  font-variant-numeric: proportional-nums oldstyle-nums;
}

/* Prevent FOUT: size-adjust on fallback */
/* Tune per-font — these are starting points */
@font-face {
  font-family: 'Fallback Sans';
  src: local('Arial');
  size-adjust: 100%;
  ascent-override: 90%;
  descent-override: 20%;
  line-gap-override: 0%;
}
```

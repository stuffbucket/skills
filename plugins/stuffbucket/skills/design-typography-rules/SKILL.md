---
name: design-typography-rules
description: Professional typography rules for UI design and web applications. Enforces typographic correctness (proper quotes, dashes, spacing, hierarchy, layout). Auto-apply when generating HTML/CSS/React/JSX with visible text. Audit mode when reviewing existing interfaces. Use when building UIs, creating components, designing layouts, or fixing typography.
metadata:
  author: stuffbucket
  version: 1.0.0
---

# UI Typography Rules

## Attribution

These rules are distilled from **Matthew Butterick's *Practical Typography*** (<https://practicaltypography.com>). If you find this skill valuable, consider supporting his work directly.

## Mode of Operation

These are **permanent rules** — not trends, not opinions. They come from centuries of typographic practice, validated by how the human eye reads.

**ENFORCEMENT (default):** When generating ANY UI with visible text, apply every rule automatically.
Use correct HTML entities, proper CSS. Do not ask permission. Do not explain. Just produce correct
typography.

**AUDIT:** When reviewing existing code or design, identify violations and provide before/after fixes.

**Reference files** (read when generating CSS or looking up entities):

- `references/css-templates.md` — Full CSS baseline template, responsive patterns, OpenType features
- `references/html-entities.md` — Complete entity table with all characters and codes

---

## Characters

### Quotes and Apostrophes — Always Curly

Straight quotes are typewriter artifacts. Use `&ldquo;` `&rdquo;` for double, `&lsquo;` `&rsquo;` for single.

Apostrophes always point down — identical to closing single quote `&rsquo;`. Smart-quote engines
wrongly insert opening quotes before decade abbreviations ('70s) and word-initial contractions
('n'). Fix with explicit `&rsquo;`.

The `<q>` tag auto-applies curly quotes when `<html lang="en">` is set.

### JSX/React Implementation Warning

**Unicode escape sequences (`\u2019`, `\u201C`, etc.) do NOT work in JSX text content.** They render as literal characters.

> **What works (pick one):**

1. **Actual UTF-8 characters (preferred):** Paste the real character directly into the source file.
2. **JSX expression with string literal:** Wrap in curly braces so the JS engine interprets the escape.

   ```jsx
   <p>Don{'\u2019'}t do this</p>
   ```

3. **HTML entity (HTML files only):** Use `&rsquo;` — does NOT work in JSX/React.

**In JavaScript data arrays and string literals**, `\u2019` works correctly because the JS engine processes the escape. The bug only affects JSX text content between tags.

### Dashes and Hyphens — Three Distinct Characters

| Character | HTML | Use |
| ----------- | ------ | ----- |
| - (hyphen) | `-` | Compound words (cost-effective), line breaks |
| -- (en dash) | `&ndash;` | Ranges (1--10), connections (Sarbanes--Oxley Act) |
| --- (em dash) | `&mdash;` | Sentence breaks---like this |

Never approximate with `--` or `---`. Em dash typically flush; add `&thinsp;` if crushed.

### Ellipses — One Character

Use `&hellip;`, not three periods. Spaces before and after; use `&nbsp;` on the text-adjacent side.

### Math and Measurement

Use `&times;` for multiplication, `&minus;` for subtraction. **Foot and inch marks** are the ONE exception to curly quotes — must be STRAIGHT: `&#39;` for foot, `&quot;` for inch.

### Trademark and Copyright

Use real symbols: `&copy;` `&trade;` `&reg;`, never (c) (TM) (R). "Copyright (c)" is redundant — word OR symbol, not both.

### Accented Characters

Proper names: accents are MANDATORY (Francois Truffaut, Placido Domingo).

### Other Punctuation

- **Exclamation points**: Budget ONE per long document. Never multiple in a row.
- **Ampersands**: Correct in proper names only. Write "and" in body text.

---

## Spacing

### One Space After Punctuation — Always

Exactly one space after any punctuation. Never two.

### Nonbreaking Spaces

`&nbsp;` prevents line break. Use before numeric refs (`&sect;&nbsp;42`), after copyright (`&copy;&nbsp;2025`), after honorifics (`Dr.&nbsp;Smith`).

---

## Text Formatting

### Bold and Italic

Bold OR italic. Mutually exclusive. Never combine. Use as little as possible. Sans serif: bold only — italic sans barely stands out. Never bold entire paragraphs.

### Underlining — Never

Never underline in a document or UI. For web links, use subtle styling: `text-decoration-thickness: 1px; text-underline-offset: 2px`.

### All Caps — Less Than One Line, Always Letterspaced

**ALWAYS** add 5-12% letterspacing. **ALWAYS** ensure kerning is on. **NEVER** capitalize whole paragraphs. `letter-spacing: 0.06em` in CSS.

### Small Caps — Real Only

Never fake (scaled-down regular caps). Use `font-variant-caps: small-caps` with fonts that have real small caps.

### Point Size

Print: 10-12pt. Web: 15-25px. Use `clamp()` for fluid web sizing.

### Kerning — Always On

No exceptions. `font-feature-settings: "kern" 1; text-rendering: optimizeLegibility;`

### Font Selection

1. No goofy fonts in professional work
2. No monospaced for body text — code only
3. Max 2 fonts. Each gets a consistent role.

---

## Page Layout

### Body Text First

Set body text BEFORE anything else. Four decisions determine everything: font, point size, line spacing, line length.

### Line Length — 45-90 Characters

The number one readability factor designers get wrong. CSS: `max-width: 65ch` on text containers.

### Line Spacing — 120-145% of Point Size

`line-height: 1.2` to `1.45`.

### Text Alignment

Left-align for web (default). Justified requires `hyphens: auto`. Centered: sparingly, only for short titles.

### Paragraph Separation — Indent OR Space, Never Both

**First-line indent**: `text-indent: 1.5em`. **Space between**: `margin-bottom: 0.75em`.

### Headings — Max 3 Levels

1. Do not all-caps headings (unless very short + letterspaced)
2. Do not underline headings
3. Emphasize with **space above and below**
4. Use **bold, not italic**
5. Smallest point-size increment needed
6. `hyphens: none` on headings
7. Space above > space below

### Tables — Remove Borders, Add Padding

Data creates an implied grid. Keep only thin rule under header row. `padding: 0.5em 1em`. Tabular figures for numeric columns. Right-align numbers.

---

## Responsive Web Typography

The rules do not change with screen size. Same line length, line spacing, hierarchy.

1. Scale `font-size` and container `width` together
2. Always `max-width` on text containers — never edge-to-edge text
3. `clamp()` for fluid scaling: `font-size: clamp(16px, 2.5vw, 20px)`
4. Mobile minimum: `padding: 0 1rem` on text containers

---

## Maxims of Page Layout

1. **Body text first** — its 4 properties determine everything
2. **Foreground vs background** — do not let chrome upstage body text
3. **Smallest visible increments** — half-points matter
4. **When in doubt, try both** — make samples, do not theorize
5. **Consistency** — same things look the same
6. **Relate new to existing** — each element constrains the next
7. **Keep it simple** — 3 colors and 5 fonts? Think again
8. **Imitate what you like** — emulate good typography from the wild

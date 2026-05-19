# Type Ramps Reference

Pre-computed type ramps as copy-paste CSS custom properties. Pick the ramp that matches the project context. Apply it directly. Do not recompute ratios or derive sizes.

Each ramp includes font sizes, weights, line heights, and letter spacing for every level. Responsive mobile adjustments are at the end.

---

## Compact SaaS Ramp

For data-dense dashboards, admin UIs, settings panels, and table-heavy layouts. Prioritizes density
and scannability. Uses a tight 1.125 (Major Second) ratio for functional sizes and a 1.25 step up to
structural sizes.

```css
:root {
  /* ---- Compact SaaS Type Ramp ---- */
  /* Ratio: 1.125 (Major Second) for functional, 1.25 jump for structural */
  /* Base: 14px (0.875rem) — smaller base for density */

  /* --- Font Sizes --- */
  --text-xs:   0.6875rem;  /* 11px — badges, status indicators, timestamps */
  --text-sm:   0.75rem;    /* 12px — table cells, metadata, helper text */
  --text-base: 0.875rem;   /* 14px — body text, form inputs, list items */
  --text-md:   1rem;       /* 16px — emphasized body, lead text */
  --text-lg:   1.125rem;   /* 18px — card titles, subheadings */
  --text-xl:   1.25rem;    /* 20px — section headings */
  --text-2xl:  1.5rem;     /* 24px — page titles */
  --text-3xl:  1.75rem;    /* 28px — primary page heading */
  --text-4xl:  2.25rem;    /* 36px — dashboard hero metric */

  /* --- Font Weights --- */
  --weight-xs:   500;   /* medium — small text needs weight to stay legible */
  --weight-sm:   400;   /* regular */
  --weight-base: 400;   /* regular */
  --weight-md:   500;   /* medium */
  --weight-lg:   600;   /* semibold */
  --weight-xl:   600;   /* semibold */
  --weight-2xl:  700;   /* bold */
  --weight-3xl:  700;   /* bold */
  --weight-4xl:  700;   /* bold */

  /* --- Line Heights --- */
  --leading-xs:   1.3;   /* tight for labels */
  --leading-sm:   1.4;   /* compact for metadata */
  --leading-base: 1.5;   /* readable body */
  --leading-md:   1.5;   /* readable body */
  --leading-lg:   1.3;   /* tighter for subheadings */
  --leading-xl:   1.25;  /* heading */
  --leading-2xl:  1.2;   /* heading */
  --leading-3xl:  1.15;  /* tight display */
  --leading-4xl:  1.1;   /* tight display */

  /* --- Letter Spacing --- */
  --tracking-xs:   0.02em;   /* open up small text */
  --tracking-sm:   0.01em;   /* slightly open */
  --tracking-base: 0em;      /* default */
  --tracking-md:   0em;      /* default */
  --tracking-lg:  -0.005em;  /* barely tighten subheads */
  --tracking-xl:  -0.01em;   /* tighten headings */
  --tracking-2xl: -0.015em;  /* tighten titles */
  --tracking-3xl: -0.02em;   /* tighten display */
  --tracking-4xl: -0.025em;  /* tighten large display */
}
```

---

## Standard App Ramp

For general web apps, forms, settings pages, and multi-purpose interfaces. The default choice when
nothing else is a better fit. Uses a 1.2 (Minor Third) ratio for functional sizes and a 1.25 (Major
Third) for structural.

```css
:root {
  /* ---- Standard App Type Ramp ---- */
  /* Ratio: 1.2 (Minor Third) functional, 1.25 (Major Third) structural */
  /* Base: 16px (1rem) */

  /* --- Font Sizes --- */
  --text-xs:   0.75rem;   /* 12px — captions, timestamps, badge text */
  --text-sm:   0.875rem;  /* 14px — secondary text, helper text, metadata */
  --text-base: 1rem;      /* 16px — body text, form inputs, buttons */
  --text-md:   1.125rem;  /* 18px — lead paragraphs, emphasized body */
  --text-lg:   1.25rem;   /* 20px — card titles, subheadings */
  --text-xl:   1.5rem;    /* 24px — section headings */
  --text-2xl:  2rem;      /* 32px — page titles */
  --text-3xl:  2.5rem;    /* 40px — primary page heading */
  --text-4xl:  3rem;      /* 48px — hero heading */

  /* --- Font Weights --- */
  --weight-xs:   500;   /* medium */
  --weight-sm:   400;   /* regular */
  --weight-base: 400;   /* regular */
  --weight-md:   500;   /* medium */
  --weight-lg:   600;   /* semibold */
  --weight-xl:   600;   /* semibold */
  --weight-2xl:  700;   /* bold */
  --weight-3xl:  700;   /* bold */
  --weight-4xl:  800;   /* extrabold */

  /* --- Line Heights --- */
  --leading-xs:   1.4;
  --leading-sm:   1.45;
  --leading-base: 1.5;
  --leading-md:   1.5;
  --leading-lg:   1.35;
  --leading-xl:   1.3;
  --leading-2xl:  1.2;
  --leading-3xl:  1.15;
  --leading-4xl:  1.1;

  /* --- Letter Spacing --- */
  --tracking-xs:   0.02em;
  --tracking-sm:   0.01em;
  --tracking-base: 0em;
  --tracking-md:   0em;
  --tracking-lg:  -0.005em;
  --tracking-xl:  -0.01em;
  --tracking-2xl: -0.015em;
  --tracking-3xl: -0.02em;
  --tracking-4xl: -0.025em;
}
```

---

## Editorial Ramp

For blogs, documentation, long-form reading, and content-first layouts. Prioritizes sustained
reading comfort. Larger base size, generous line height, constrained measure. Uses a 1.25 (Major
Third) ratio throughout.

```css
:root {
  /* ---- Editorial Type Ramp ---- */
  /* Ratio: 1.25 (Major Third) — clear hierarchy without drama */
  /* Base: 18px (1.125rem) — larger for sustained reading */

  /* --- Font Sizes --- */
  --text-xs:   0.75rem;    /* 12px — footnotes, legal text */
  --text-sm:   0.875rem;   /* 14px — captions, bylines, dates */
  --text-base: 1.125rem;   /* 18px — body text, running prose */
  --text-md:   1.25rem;    /* 20px — lead paragraph, blockquotes */
  --text-lg:   1.5rem;     /* 24px — subheadings (h3) */
  --text-xl:   1.875rem;   /* 30px — section headings (h2) */
  --text-2xl:  2.25rem;    /* 36px — article title (h1) */
  --text-3xl:  2.875rem;   /* 46px — feature headline */
  --text-4xl:  3.5rem;     /* 56px — cover headline */

  /* --- Font Weights --- */
  --weight-xs:   400;   /* regular — small text stays light */
  --weight-sm:   400;   /* regular */
  --weight-base: 400;   /* regular */
  --weight-md:   400;   /* regular — lead text stays same weight, bigger size does the work */
  --weight-lg:   600;   /* semibold */
  --weight-xl:   700;   /* bold */
  --weight-2xl:  700;   /* bold */
  --weight-3xl:  800;   /* extrabold */
  --weight-4xl:  800;   /* extrabold */

  /* --- Line Heights --- */
  --leading-xs:   1.4;
  --leading-sm:   1.5;
  --leading-base: 1.7;   /* generous for long reading */
  --leading-md:   1.6;
  --leading-lg:   1.35;
  --leading-xl:   1.25;
  --leading-2xl:  1.2;
  --leading-3xl:  1.15;
  --leading-4xl:  1.1;

  /* --- Letter Spacing --- */
  --tracking-xs:   0.02em;
  --tracking-sm:   0.01em;
  --tracking-base: 0em;     /* body text: default kerning is correct */
  --tracking-md:   0em;
  --tracking-lg:  -0.005em;
  --tracking-xl:  -0.01em;
  --tracking-2xl: -0.015em;
  --tracking-3xl: -0.02em;
  --tracking-4xl: -0.025em;

  /* --- Measure (line length) --- */
  --measure-body: 65ch;    /* optimal reading width for body text */
  --measure-wide: 80ch;    /* code blocks, tables */
  --measure-narrow: 45ch;  /* pull quotes, captions */
}
```

---

## Marketing Ramp

For landing pages, splash pages, hero sections, and promotional layouts. Dramatic size jumps between body and headings. Uses a 1.333 (Perfect Fourth) ratio for headings and a tighter functional range.

```css
:root {
  /* ---- Marketing Type Ramp ---- */
  /* Ratio: 1.333 (Perfect Fourth) for display, 1.2 for functional */
  /* Base: 18px (1.125rem) — slightly larger for marketing legibility */

  /* --- Font Sizes (desktop) --- */
  --text-xs:   0.75rem;    /* 12px — fine print, legal */
  --text-sm:   0.875rem;   /* 14px — nav labels, footer links */
  --text-base: 1.125rem;   /* 18px — body text, feature descriptions */
  --text-md:   1.25rem;    /* 20px — lead paragraph, subtext under hero */
  --text-lg:   1.5rem;     /* 24px — feature headings, card titles */
  --text-xl:   2rem;       /* 32px — section headings */
  --text-2xl:  2.625rem;   /* 42px — major section title */
  --text-3xl:  3.5rem;     /* 56px — hero heading */
  --text-4xl:  4.5rem;     /* 72px — display/splash headline */

  /* --- Font Weights --- */
  --weight-xs:   400;
  --weight-sm:   500;
  --weight-base: 400;
  --weight-md:   400;
  --weight-lg:   600;
  --weight-xl:   700;
  --weight-2xl:  700;
  --weight-3xl:  800;
  --weight-4xl:  800;

  /* --- Line Heights --- */
  --leading-xs:   1.4;
  --leading-sm:   1.5;
  --leading-base: 1.6;
  --leading-md:   1.5;
  --leading-lg:   1.3;
  --leading-xl:   1.2;
  --leading-2xl:  1.15;
  --leading-3xl:  1.1;
  --leading-4xl:  1.05;   /* very tight for large display */

  /* --- Letter Spacing --- */
  --tracking-xs:   0.03em;   /* extra open for fine print legibility */
  --tracking-sm:   0.02em;
  --tracking-base: 0em;
  --tracking-md:   0em;
  --tracking-lg:  -0.01em;
  --tracking-xl:  -0.015em;
  --tracking-2xl: -0.02em;
  --tracking-3xl: -0.025em;
  --tracking-4xl: -0.03em;   /* aggressive tightening at display size */
}
```

---

## Dashboard Ramp

For metrics, KPIs, data visualization, and analytics interfaces. Distinguishes between three zones:
tiny labels, normal UI text, and oversized metric values. Uses a 1.125 (Major Second) ratio for the
dense zone and a large jump to metric display sizes.

```css
:root {
  /* ---- Dashboard Type Ramp ---- */
  /* Ratio: 1.125 for dense UI zone, 1.5+ jump to metric display */
  /* Base: 14px (0.875rem) — density-first */

  /* --- Font Sizes --- */
  --text-xs:   0.625rem;   /* 10px — sparkline labels, axis ticks */
  --text-sm:   0.75rem;    /* 12px — table headers, chart legends, timestamps */
  --text-base: 0.875rem;   /* 14px — table cells, body text, descriptions */
  --text-md:   1rem;       /* 16px — card body, filter labels */
  --text-lg:   1.125rem;   /* 18px — card titles, widget headers */
  --text-xl:   1.375rem;   /* 22px — section titles */
  --text-2xl:  1.75rem;    /* 28px — secondary KPI value */
  --text-3xl:  2.25rem;    /* 36px — primary KPI value */
  --text-4xl:  3rem;       /* 48px — hero metric, single stat spotlight */

  /* --- Font Weights --- */
  --weight-xs:   500;   /* medium — must survive at 10px */
  --weight-sm:   600;   /* semibold — table headers need authority */
  --weight-base: 400;   /* regular */
  --weight-md:   400;   /* regular */
  --weight-lg:   600;   /* semibold */
  --weight-xl:   600;   /* semibold */
  --weight-2xl:  700;   /* bold — KPI values are bold */
  --weight-3xl:  700;   /* bold */
  --weight-4xl:  800;   /* extrabold — hero metric */

  /* --- Line Heights --- */
  --leading-xs:   1.2;   /* tight for axis labels */
  --leading-sm:   1.3;
  --leading-base: 1.45;
  --leading-md:   1.45;
  --leading-lg:   1.3;
  --leading-xl:   1.2;
  --leading-2xl:  1.1;   /* KPI values are single-line */
  --leading-3xl:  1.05;
  --leading-4xl:  1.0;   /* metric: no extra leading */

  /* --- Letter Spacing --- */
  --tracking-xs:   0.03em;    /* wide open for tiny labels */
  --tracking-sm:   0.02em;
  --tracking-base: 0em;
  --tracking-md:   0em;
  --tracking-lg:  -0.005em;
  --tracking-xl:  -0.01em;
  --tracking-2xl: -0.02em;
  --tracking-3xl: -0.025em;
  --tracking-4xl: -0.03em;

  /* --- Dashboard-Specific Tokens --- */
  --metric-font-variant: tabular-nums lining-nums;  /* align numbers in columns */
  --delta-positive-prefix: "+";    /* for % change indicators */
  --kpi-unit-size: 0.6em;         /* unit label relative to metric value */
  --kpi-unit-weight: 400;         /* lighter weight for unit labels */
}
```

---

## Responsive Adjustments

Apply these overrides at mobile breakpoints. They reduce heading sizes so large display text does not dominate small screens. Body sizes stay fixed — never shrink body text below 14px.

### Mobile Overrides for Standard App Ramp

```css
@media (max-width: 767px) {
  :root {
    /* Body sizes stay the same */
    /* Only structural sizes reduce */
    --text-lg:   1.125rem;  /* 18px, was 20px */
    --text-xl:   1.25rem;   /* 20px, was 24px */
    --text-2xl:  1.5rem;    /* 24px, was 32px */
    --text-3xl:  1.875rem;  /* 30px, was 40px */
    --text-4xl:  2.25rem;   /* 36px, was 48px */
  }
}
```

### Mobile Overrides for Editorial Ramp

```css
@media (max-width: 767px) {
  :root {
    --text-base: 1rem;      /* 16px, was 18px — still readable, saves space */
    --text-md:   1.125rem;  /* 18px, was 20px */
    --text-lg:   1.25rem;   /* 20px, was 24px */
    --text-xl:   1.5rem;    /* 24px, was 30px */
    --text-2xl:  1.875rem;  /* 30px, was 36px */
    --text-3xl:  2.25rem;   /* 36px, was 46px */
    --text-4xl:  2.625rem;  /* 42px, was 56px */

    --leading-base: 1.6;    /* slightly tighter on mobile */
    --measure-body: 100%;   /* full width on small screens */
  }
}
```

### Mobile Overrides for Marketing Ramp

```css
@media (max-width: 767px) {
  :root {
    --text-lg:   1.25rem;   /* 20px, was 24px */
    --text-xl:   1.5rem;    /* 24px, was 32px */
    --text-2xl:  2rem;      /* 32px, was 42px */
    --text-3xl:  2.5rem;    /* 40px, was 56px */
    --text-4xl:  3rem;      /* 48px, was 72px */

    --leading-3xl: 1.15;    /* loosen slightly at reduced size */
    --leading-4xl: 1.1;
  }
}
```

### Mobile Overrides for Dashboard Ramp

```css
@media (max-width: 767px) {
  :root {
    /* Dense zone stays the same — dashboards are dense by nature */
    /* Only KPI display sizes reduce */
    --text-2xl:  1.5rem;    /* 24px, was 28px */
    --text-3xl:  1.875rem;  /* 30px, was 36px */
    --text-4xl:  2.25rem;   /* 36px, was 48px */
  }
}
```

### Mobile Overrides for Compact SaaS Ramp

```css
@media (max-width: 767px) {
  :root {
    /* Compact ramp is already dense — minimal changes needed */
    --text-3xl:  1.5rem;    /* 24px, was 28px */
    --text-4xl:  1.875rem;  /* 30px, was 36px */
  }
}
```

---

## Fluid Typography Alternative

When a project uses marketing or editorial ramps and targets a wide viewport range, use `clamp()`
for heading sizes instead of breakpoint overrides. Apply to structural sizes only — never make body
text fluid.

```css
:root {
  /* Fluid headings — replace static --text-xl through --text-4xl */
  /* Format: clamp(mobile-min, preferred-vw, desktop-max) */
  --text-xl:   clamp(1.25rem, 1rem + 1.25vw, 2rem);       /* 20px -> 32px */
  --text-2xl:  clamp(1.5rem, 1rem + 2vw, 2.625rem);        /* 24px -> 42px */
  --text-3xl:  clamp(1.875rem, 1rem + 3.25vw, 3.5rem);     /* 30px -> 56px */
  --text-4xl:  clamp(2.25rem, 1rem + 4.5vw, 4.5rem);       /* 36px -> 72px */

  /* Body sizes stay fixed */
  --text-xs:   0.75rem;
  --text-sm:   0.875rem;
  --text-base: 1.125rem;
  --text-md:   1.25rem;
  --text-lg:   1.5rem;   /* lg can stay fixed or use a mild clamp */
}
```

---

## Usage Pattern

Apply a ramp by referencing tokens in component styles. Do not hardcode sizes.

```css
/* Example: applying the Standard App ramp */
body {
  font-size: var(--text-base);
  font-weight: var(--weight-base);
  line-height: var(--leading-base);
  letter-spacing: var(--tracking-base);
}

h1 {
  font-size: var(--text-2xl);
  font-weight: var(--weight-2xl);
  line-height: var(--leading-2xl);
  letter-spacing: var(--tracking-2xl);
}

h2 {
  font-size: var(--text-xl);
  font-weight: var(--weight-xl);
  line-height: var(--leading-xl);
  letter-spacing: var(--tracking-xl);
}

h3 {
  font-size: var(--text-lg);
  font-weight: var(--weight-lg);
  line-height: var(--leading-lg);
  letter-spacing: var(--tracking-lg);
}

.caption {
  font-size: var(--text-sm);
  font-weight: var(--weight-sm);
  line-height: var(--leading-sm);
  letter-spacing: var(--tracking-sm);
}

.label {
  font-size: var(--text-xs);
  font-weight: var(--weight-xs);
  line-height: var(--leading-xs);
  letter-spacing: var(--tracking-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;  /* override: uppercase needs extra tracking */
}
```

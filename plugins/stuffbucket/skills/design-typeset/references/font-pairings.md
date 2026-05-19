# Font Pairings Reference

Use this file as a lookup table. Pick the category that matches the project context, then select a
pairing. Each pairing is complete — copy the import, apply the fonts, move on. Do not substitute
fonts. Do not mix pairings across categories.

**Banned fonts (never use, not even as body):** Inter, Roboto, Arial, Open Sans, Helvetica Neue, Space Grotesk.

---

## SaaS / App UI

### Pairing S1: General Purpose SaaS

- **Heading:** Plus Jakarta Sans (600, 700)
- **Body:** Plus Jakarta Sans (400, 500)
- **Source:** Google Fonts (variable)
- **Import:**

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap');
```

- **Character:** Clean, friendly, slightly rounded terminals. Modern without being cold.
- **Use for:** B2B dashboards, project management tools, CRM interfaces, settings panels.

---

### Pairing S2: Premium SaaS

- **Heading:** Outfit (600, 700)
- **Body:** Source Sans 3 (400, 500, 600)
- **Source:** Google Fonts (variable)
- **Import:**

```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&family=Source+Sans+3:ital,wght@0,200..900;1,200..900&display=swap');
```

- **Character:** Geometric heading with humanist body. Polished, trustworthy.
- **Use for:** Analytics platforms, fintech dashboards, enterprise tools.

---

### Pairing S3: Developer-Facing SaaS

- **Heading:** Manrope (600, 700, 800)
- **Body:** Manrope (400, 500)
- **Source:** Google Fonts (variable)
- **Import:**

```css
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap');
```

- **Character:** Precise, technical, no-nonsense. Wide letterforms aid scanning.
- **Use for:** Developer tools, API platforms, infrastructure dashboards, CI/CD UIs.

---

### Pairing S4: Warm SaaS

- **Heading:** Sora (600, 700)
- **Body:** DM Sans (400, 500)
- **Source:** Google Fonts (variable)
- **Import:**

```css
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@100..800&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap');
```

- **Character:** Geometric but warm. Sora brings character to headings; DM Sans is a reliable workhorse body.
- **Use for:** Collaboration tools, HR platforms, community apps, onboarding flows.

---

### Pairing S5: Compact UI

- **Heading:** Geist Sans (600, 700)
- **Body:** Geist Sans (400, 500)
- **Source:** Vercel — <https://vercel.com/font> (self-host required, download .woff2)
- **Import:**

```css
@font-face {
  font-family: 'Geist';
  src: url('/fonts/GeistVF.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
```

- **Character:** Engineered for UI. Tight metrics, clear at small sizes, monoline strokes.
- **Use for:** Dense admin panels, data tables, compact sidebars, Vercel/Next.js-aligned products.

---

## Editorial / Content

### Pairing E1: Modern Editorial

- **Heading:** Fraunces (700, 800, 900)
- **Body:** Commissioner (400, 500)
- **Source:** Google Fonts (variable — Fraunces has WONK, SOFT, opsz axes)
- **Import:**

```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,100..900;1,9..144,100..900&family=Commissioner:wght@100..900&display=swap');
```

- **Character:** Fraunces is a soft-serif with old-style flavor and optical size axis. Commissioner is a variable sans with low contrast. Together: editorial authority with contemporary readability.
- **Use for:** Magazines, longform blogs, brand storytelling, editorial landing pages.

---

### Pairing E2: Classic Longform

- **Heading:** Newsreader (600, 700)
- **Body:** Newsreader (400, 400 italic)
- **Source:** Google Fonts (variable, optical size axis)
- **Import:**

```css
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800&display=swap');
```

- **Character:** A proper text face with optical sizes. Graceful, readable, suited to sustained reading.
- **Use for:** Long articles, book-style layouts, newsletters, documentation with editorial tone.

---

### Pairing E3: Documentation / Knowledge Base

- **Heading:** General Sans (600, 700)
- **Body:** Satoshi (400, 500)
- **Source:** Fontshare (self-host required)
  - <https://www.fontshare.com/fonts/general-sans>
  - <https://www.fontshare.com/fonts/satoshi>
- **Import:**

```css
@font-face {
  font-family: 'General Sans';
  src: url('/fonts/GeneralSans-Variable.woff2') format('woff2');
  font-weight: 200 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Satoshi';
  src: url('/fonts/Satoshi-Variable.woff2') format('woff2');
  font-weight: 300 900;
  font-style: normal;
  font-display: swap;
}
```

- **Character:** General Sans is a tight grotesque. Satoshi is warm and geometric. Together: approachable technical writing.
- **Use for:** Developer docs, help centers, knowledge bases, wikis.

---

### Pairing E4: Refined Editorial

- **Heading:** Instrument Serif (400)
- **Body:** Instrument Sans (400, 500, 600)
- **Source:** Google Fonts (variable for Sans)
- **Import:**

```css
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&display=swap');
```

- **Character:** A matched serif/sans pair from the same design family. Instrument Serif has sharp, elegant contrast. The sans is crisp and neutral.
- **Use for:** Design portfolios, case studies, agency blogs, product announcements.

---

## Marketing / Landing Page

### Pairing M1: Bold SaaS Marketing

- **Heading:** Cabinet Grotesk (800, 900)
- **Body:** Switzer (400, 500)
- **Source:** Fontshare (self-host required)
  - <https://www.fontshare.com/fonts/cabinet-grotesk>
  - <https://www.fontshare.com/fonts/switzer>
- **Import:**

```css
@font-face {
  font-family: 'Cabinet Grotesk';
  src: url('/fonts/CabinetGrotesk-Variable.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Switzer';
  src: url('/fonts/Switzer-Variable.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
```

- **Character:** Cabinet Grotesk is punchy and geometric at large sizes. Switzer is a Swiss-style workhorse body. Together: confident, high-contrast marketing.
- **Use for:** SaaS landing pages, pricing pages, product launches, hero sections.

---

### Pairing M2: Elegant Marketing

- **Heading:** Clash Display (600, 700)
- **Body:** Synonym (400, 500)
- **Source:** Fontshare (self-host required)
  - <https://www.fontshare.com/fonts/clash-display>
  - <https://www.fontshare.com/fonts/synonym>
- **Import:**

```css
@font-face {
  font-family: 'Clash Display';
  src: url('/fonts/ClashDisplay-Variable.woff2') format('woff2');
  font-weight: 200 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Synonym';
  src: url('/fonts/Synonym-Variable.woff2') format('woff2');
  font-weight: 200 700;
  font-style: normal;
  font-display: swap;
}
```

- **Character:** Clash Display has distinctive, slightly condensed geometric forms. Synonym is a clean neo-grotesk. Together: premium, design-aware.
- **Use for:** Design tool marketing, creative agency sites, product showcases.

---

### Pairing M3: Startup Marketing

- **Heading:** Bricolage Grotesque (700, 800)
- **Body:** Nunito Sans (400, 500, 600)
- **Source:** Google Fonts (variable)
- **Import:**

```css
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&family=Nunito+Sans:ital,opsz,wght@0,6..12,200..1000;1,6..12,200..1000&display=swap');
```

- **Character:** Bricolage Grotesque has quirky, humanist details — inktraps, asymmetric curves. Nunito Sans is soft and approachable. Together: distinctive without being alienating.
- **Use for:** Startup homepages, product-led growth pages, feature tours, onboarding marketing.

---

### Pairing M4: Authority Marketing

- **Heading:** Darker Grotesque (700, 800, 900)
- **Body:** Libre Franklin (400, 500)
- **Source:** Google Fonts (variable)
- **Import:**

```css
@import url('https://fonts.googleapis.com/css2?family=Darker+Grotesque:wght@300..900&family=Libre+Franklin:ital,wght@0,200..900;1,200..900&display=swap');
```

- **Character:** Darker Grotesque is tall, condensed, high-impact at display sizes. Libre Franklin is a solid, professional neo-grotesk. Together: authoritative, enterprise-grade.
- **Use for:** Enterprise marketing, security product pages, compliance/legal SaaS, fintech landing pages.

---

## Technical / Developer

### Pairing T1: Developer Portal

- **Heading:** JetBrains Mono (700)
- **Body:** Atkinson Hyperlegible Next (400, 700)
- **Source:** Google Fonts
- **Import:**

```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Atkinson+Hyperlegible+Next:ital,wght@0,400..800;1,400..800&display=swap');
```

- **Character:** Monospace headings signal code-first culture. Atkinson Hyperlegible is optimized for character differentiation — critical for technical content. Together: developer-native.
- **Use for:** API docs, developer portals, CLI tool sites, open-source project pages.

---

### Pairing T2: Technical Product

- **Heading:** IBM Plex Sans (600, 700)
- **Body:** IBM Plex Sans (400, 450)
- **Mono:** IBM Plex Mono (400, 600)
- **Source:** Google Fonts (variable)
- **Import:**

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,100..700;1,100..700&family=IBM+Plex+Mono:ital,wght@0,100..700;1,100..700&display=swap');
```

- **Character:** Engineered for technical clarity. The full Plex family shares metrics across sans, serif, and mono — mix freely.
- **Use for:** Infrastructure products, cloud dashboards, monitoring tools, technical documentation.

---

### Pairing T3: Data / Science

- **Heading:** Lexend (600, 700)
- **Body:** Lexend (400, 500)
- **Source:** Google Fonts (variable)
- **Import:**

```css
@import url('https://fonts.googleapis.com/css2?family=Lexend:wght@100..900&display=swap');
```

- **Character:** Designed for reading fluency. Wide spacing, open counters. Performs well in data-heavy layouts where rapid scanning matters.
- **Use for:** Data science platforms, research tools, statistical dashboards, academic SaaS.

---

## Expressive / Brand-Forward

### Pairing X1: Playful Brand

- **Heading:** Gambarino (400)
- **Body:** Chillax (400, 500)
- **Source:** Fontshare (self-host required)
  - <https://www.fontshare.com/fonts/gambarino>
  - <https://www.fontshare.com/fonts/chillax>
- **Import:**

```css
@font-face {
  font-family: 'Gambarino';
  src: url('/fonts/Gambarino-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Chillax';
  src: url('/fonts/Chillax-Variable.woff2') format('woff2');
  font-weight: 200 700;
  font-style: normal;
  font-display: swap;
}
```

- **Character:** Gambarino is a high-contrast display serif with dramatic ball terminals. Chillax is a relaxed geometric sans. Together: expressive, memorable, slightly retro.
- **Use for:** Creative brand sites, lifestyle products, event pages, portfolio splash pages.

---

### Pairing X2: Luxury / Premium

- **Heading:** Zodiak (700, 800)
- **Body:** Erode (400, 400 italic)
- **Source:** Fontshare (self-host required)
  - <https://www.fontshare.com/fonts/zodiak>
  - <https://www.fontshare.com/fonts/erode>
- **Import:**

```css
@font-face {
  font-family: 'Zodiak';
  src: url('/fonts/Zodiak-Variable.woff2') format('woff2');
  font-weight: 200 800;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Erode';
  src: url('/fonts/Erode-Variable.woff2') format('woff2');
  font-weight: 300 700;
  font-style: normal;
  font-display: swap;
}
```

- **Character:** Zodiak is a modern didone with sharp contrast. Erode is a text serif with subtle wedge serifs. Together: high-end, editorial luxury.
- **Use for:** Fashion, luxury goods, premium brand sites, art direction pieces.

---

### Pairing X3: Bold Statement

- **Heading:** Bebas Neue (400)
- **Body:** Figtree (400, 500, 600)
- **Source:** Google Fonts (variable for Figtree)
- **Import:**

```css
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Figtree:ital,wght@0,300..900;1,300..900&display=swap');
```

- **Character:** Bebas Neue is an all-caps condensed display face — instant impact. Figtree is a friendly geometric sans that keeps body text approachable. Together: high-contrast, energetic.
- **Use for:** Event sites, music/entertainment, bold product launches, conference pages.

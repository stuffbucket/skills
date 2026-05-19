# Visual Foundations Reference

## Color System

Build systematic, accessible color palettes in layers.

### Layer 1: Brand Palette

Primary, secondary, and accent colors with full tonal scales (50-950 or equivalent steps).

### Layer 2: Neutral Palette

Gray scale for text, backgrounds, borders, and surfaces.

### Layer 3: Semantic Colors

- Success (green), warning (amber), error (red), info (blue)
- Each with background, foreground, border, and icon variants

### Layer 4: Extended Palette

Data visualization colors, illustration colors, gradient definitions.

### Color Relationships

- Tint/shade scales for each hue
- Complementary pairs for contrast
- Analogous sets for harmony
- Neutral pairings for text/surface combinations

### Accessibility Contrast Requirements

| Element | Minimum Ratio |
| --------- | --------------- |
| Body text on background | 4.5:1 (AA) or 7:1 (AAA) |
| Large text (18px+ or 14px+ bold) | 3:1 |
| UI components against adjacent colors | 3:1 |

Never rely on color alone to convey meaning.

### Checklist

- [ ] Full tonal scales generated, not single swatches
- [ ] Every foreground/background combination tested for contrast
- [ ] Usage guidance documented per color
- [ ] Tested with color blindness simulators
- [ ] Dark mode mappings included from the start

---

## Dark Mode

Go beyond inversion -- redesign surfaces thoughtfully.

### Core Principles

- Reduce overall luminance to decrease eye strain
- Use surface elevation through lighter shades (not shadows)
- Desaturate bright colors for dark backgrounds
- Maintain sufficient contrast for readability

### Surface Hierarchy

| Level | Role | Example Value |
| ------- | ------ | --------------- |
| Background | Darkest | #121212 |
| Surface 1 | Elevated cards | slightly lighter |
| Surface 2 | Modals, dropdowns | lighter again |
| Surface 3 | Tooltips, menus | lightest dark |

### Color Adaptation Rules

- Primary colors: reduce saturation 10-20%
- Error/warning: adjust for dark background contrast
- Text: use off-white (#E0E0E0), not pure white (#FFFFFF)
- Borders: subtle, low-opacity white

### Images and Media

- Dim images slightly on dark backgrounds
- Provide dark-variant illustrations
- Prepare light-on-dark logo versions
- Avoid large bright areas in imagery

### Implementation

- Use semantic design tokens for effortless light/dark switching
- Respect `prefers-color-scheme` media query
- Provide manual toggle alongside auto-detection
- Ensure smooth transitions between modes

### Checklist

- [ ] Every component verified in dark mode
- [ ] Minimum 4.5:1 contrast for body text
- [ ] Tested in actual dark environments
- [ ] Screen reader mode announcements working

---

## Typography Scale

Create a modular scale ensuring readable, harmonious text.

### Size Scale (base 16px)

Common ratios: 1.25 (major third), 1.333 (perfect fourth).

| Role | Size |
| ------ | ------ |
| Caption | 12px |
| Body small | 14px |
| Body (base) | 16px |
| Subheading | 20px |
| Heading 3 | 24px |
| Heading 2 | 32px |
| Heading 1 | 40px |
| Display | 48-64px |

### Weight Scale

Regular (400), Medium (500), Semibold (600), Bold (700).

### Line Height

| Style | Ratio | Use |
| ------- | ------- | ----- |
| Tight | 1.2 | Headings |
| Normal | 1.5 | Body text |
| Relaxed | 1.75 | Long-form reading |

### Letter Spacing

| Style | Value | Use |
| ------- | ------- | ----- |
| Tight | -0.02em | Large headings |
| Normal | 0 | Body text |
| Wide | 0.05em | Uppercase labels, captions |

### Font Pairing

- **Primary**: UI and body text
- **Secondary** (optional): headings or editorial
- **Mono**: code, data, technical content

### Responsive Typography

- Scale down heading sizes on mobile
- Maintain body size at 16px minimum for readability
- Optimal line length: 45-75 characters

### Rules

- Use a mathematical ratio for harmony
- Limit to 4-5 sizes in regular use
- Test with real content, not lorem ipsum
- Document usage rules for each text style

---

## Spacing System

Build from a base unit for consistent rhythm.

### Scale (4px base)

| Token | Value |
| ------- | ------- |
| 2xs | 2px |
| xs | 4px |
| sm | 8px |
| md | 16px |
| lg | 24px |
| xl | 32px |
| 2xl | 48px |
| 3xl | 64px |

### Spacing Types

- **Inset**: padding inside containers (equal, squish, or stretch variants)
- **Stack**: vertical space between stacked elements
- **Inline**: horizontal space between inline elements
- **Grid gap**: space between grid/flex items

### Application Rules

| Context | Spacing |
| --------- | --------- |
| Related items | sm / md |
| Distinct sections | lg / xl |
| Page margins | Consistent per breakpoint |
| Component internal | Defined per component |

### Density Modes

- **Compact**: reduce spacing by one step (data-heavy views)
- **Comfortable**: default
- **Spacious**: increase spacing by one step (reading-focused)

### Rules

- Always use the scale -- never arbitrary values
- Larger gaps between unrelated groups
- Document spacing intent, not just pixel values
- Test at different viewport sizes

---

## Layout Grid

Define responsive grids with columns, gutters, margins, and breakpoint behavior.

### Grid Anatomy

| Property | Mobile | Tablet | Desktop |
| ---------- | -------- | -------- | --------- |
| Columns | 4 | 8 | 12 |
| Gutters | 16px | 24px | 24-32px |
| Margins | 16px | 24px | 24-48px |

### Standard Breakpoints

| Name | Range |
| ------ | ------- |
| Small | 375-639px |
| Medium | 640-1023px |
| Large | 1024-1439px |
| Extra large | 1440px+ |

### Grid Types

- **Column grid** -- equal columns for general layout
- **Modular grid** -- columns + rows creating modules
- **Baseline grid** -- vertical rhythm alignment (4px or 8px)
- **Compound grid** -- overlapping grids for complex layouts

### Responsive Behavior

- **Fluid**: columns stretch proportionally
- **Fixed**: max-width container, centered
- **Adaptive**: distinct layouts per breakpoint
- **Column dropping**: reduce columns at smaller sizes

### Common Layout Patterns

- Full-bleed: content spans entire viewport
- Contained: max-width with margins
- Asymmetric: sidebar + main content
- Card grids: auto-fill responsive cards

### Rules

- Align content to the grid, not arbitrarily
- Test at every breakpoint, not just extremes
- Document grid specs for developers
- Allow intentional grid-breaking for emphasis

---

## Responsive Design

Adapt layouts and interactions across screen sizes and input methods.

### Strategies

- **Fluid**: percentage-based widths, flexible within ranges
- **Adaptive**: distinct layouts at specific breakpoints
- **Mobile-first**: start smallest, enhance upward
- **Content-first**: let content needs drive breakpoints

### Responsive Patterns

| Pattern | Behavior |
| --------- | ---------- |
| Column drop | Reduce columns at smaller sizes |
| Reflow | Stack horizontal elements vertically |
| Off-canvas | Hide secondary content behind toggle |
| Priority+ | Show most important items, overflow the rest |

### Input Method Adaptation

| Input | Requirements |
| ------- | ------------- |
| Touch | 44px minimum targets, gesture support |
| Mouse | Hover states, precise targeting |
| Keyboard | Visible focus indicators, logical tab order |
| Voice | Clear labels, logical structure |

### Responsive Typography and Images

- Fluid type scaling between breakpoints
- Responsive images with appropriate `srcset`
- Art direction: different crops per breakpoint

### Rules

- Design for content, not device names
- Test on real devices, not just browser resize
- Consider both landscape and portrait
- Account for slow connections
- Run accessibility tools at each breakpoint

---

## Visual Hierarchy

Guide users through interfaces using deliberate emphasis.

### Hierarchy Tools

| Tool | Technique |
| ------ | ----------- |
| **Size** | Minimum 1.5x difference for clear distinction |
| **Weight** | Bold text, thick strokes, filled icons carry more weight |
| **Color/Contrast** | High contrast draws attention; use strategically for CTAs and status |
| **Spacing** | More whitespace = higher perceived importance |
| **Position** | Top-left seen first (LTR). F-pattern and Z-pattern scanning. |
| **Density** | Isolated elements stand out; grouped elements scan as a unit |

### Four Hierarchy Levels

1. **Primary** -- page title, primary CTA (seen first)
2. **Secondary** -- section headings, key content (scanned next)
3. **Tertiary** -- supporting text, metadata (read on demand)
4. **Quaternary** -- fine print, timestamps (available but not prominent)

### Common Hierarchy Patterns

- **Hero section**: large type + image + single CTA
- **Card layout**: image > title > description > action
- **Form**: label > input > helper text > error
- **Navigation**: current state > available > disabled

### Quick Tests

- **Squint test**: blur eyes -- hierarchy should still be clear
- **5-second test**: show screen for 5 seconds -- can users recall the primary message?
- One primary action per view; don't compete for attention

---

## Data Visualization

Choose the right chart and style it for clarity.

### Chart Selection by Purpose

| Purpose | Chart Types |
| --------- | ------------- |
| Comparison | Bar, grouped bar, bullet chart |
| Trend over time | Line, area, sparklines |
| Part of whole | Pie/donut (few categories), stacked bar, treemap |
| Distribution | Histogram, box plot, scatter |
| Relationship | Scatter, bubble, heat map |

### Design Principles

- Maximize data-ink ratio; minimize decoration
- Clear axis labels and legends
- Consistent color encoding across views
- Start y-axis at zero for bar charts
- Annotate to highlight key insights
- Label directly on the chart when possible (reduce legend dependence)

### Color in Data Visualization

| Scale Type | Use |
| ------------ | ----- |
| Sequential | Light to dark for ordered data |
| Diverging | Two-hue scale for above/below midpoint |
| Categorical | Distinct hues for unrelated categories |

Always use colorblind-safe palettes (avoid red-green only).

### Accessibility

- Don't rely on color alone -- add patterns, labels, or shapes
- Provide text alternatives for charts
- Make interactive charts keyboard-navigable
- Ensure sufficient contrast for data elements

### Responsive Data Viz

- Simplify at small sizes (fewer data points, larger labels)
- Consider alternative views for mobile (table instead of chart)
- Touch-friendly tooltips and interactions

### Rules

- Choose the simplest chart that communicates the insight
- Provide context: benchmarks, targets, trend lines
- Test with real data, not idealized samples
- Allow users to explore details on demand

---

## Illustration Style

Define a visual language for illustrations that supports brand and communication.

### Style Dimensions

| Dimension | Spectrum |
| ----------- | ---------- |
| Form | Geometric/angular ... organic/flowing |
| Depth | Flat 2D ... 2.5D isometric ... 3D |
| Detail | Minimal ... detailed |
| Representation | Abstract/symbolic ... realistic |
| Line | Define stroke weight, corners, endpoints |

### Color in Illustration

- Use a subset of the product color palette
- Define primary, secondary, and accent illustration colors
- Establish rules for gradients and shadows
- Create dark mode illustration variants

### Character Design (if applicable)

- Proportions and body style
- Level of facial detail
- Diversity and representation guidelines
- Poses and expressions library

### Illustration Types

| Type | Use |
| ------ | ----- |
| Spot | Small, inline, supporting UI elements |
| Hero | Large, featured, storytelling |
| Empty state | Guide users when no content exists |
| Onboarding | Explain features and concepts |
| Error state | Soften error messages |

### Application Rules

- Define when to use vs. when not to use illustrations
- Set size constraints per context
- Align with the layout grid system
- Specify animation guidelines for illustrated elements

### Rules

- Maintain consistent style across all illustrations
- Build reusable element libraries
- Document the creation process for contributors
- Test at intended display sizes
- Never convey information only through illustration (accessibility)

---

## System Integration

These foundations work together. When building a design system:

| Foundation | Feeds Into |
| ------------ | ------------ |
| Spacing system | Layout grid, component internals |
| Typography scale | Visual hierarchy, responsive design |
| Color system | Dark mode, data viz, illustrations |
| Layout grid | Responsive design, visual hierarchy |
| Visual hierarchy | Every surface and component |

Use design tokens to encode all values. Name tokens semantically (e.g., `color-text-primary`, not
`gray-900`) so that dark mode, density modes, and theming work through token reassignment rather
than component rewrites.

# Design Systems

## Design Tokens

### Token Categories

- **Color**: Global palette, alias tokens (surface, text, border), component tokens
- **Spacing**: Base unit (4px/8px), scale (xs through 3xl), contextual (inset, stack, inline)
- **Typography**: Font families, size scale, weights, line heights
- **Elevation**: Shadow levels, z-index scale
- **Border**: Radius scale, width scale, style options
- **Motion**: Duration scale, easing functions

### Token Tiers

1. **Global** -- Raw values (e.g., `blue-500: #3B82F6`)
2. **Alias** -- Semantic references (e.g., `color-action-primary`)
3. **Component** -- Scoped usage (e.g., `button-color-primary`)

### Naming Pattern

`{category}-{property}-{variant}-{state}`

### Rules

- Start with global tokens, then create semantic aliases
- Never reference raw values in components
- Document each token with usage context
- Version tokens alongside the design system
- Keep alias tokens abstract to support theming

## Theming System

### Architecture

- **Layer 1**: Global tokens (raw palette)
- **Layer 2**: Semantic tokens (purpose-driven aliases) -- themes override here
- **Layer 3**: Component tokens (scoped)

### Theme Types

- Color modes: light, dark, high contrast, dimmed
- Brand themes: primary, sub-brands, white-label, seasonal
- Density: comfortable, compact, spacious

### Dark Mode

- Reduce brightness thoughtfully -- don't just invert
- Use lighter surfaces for elevation (not shadows)
- Desaturate colors for dark backgrounds
- Test text legibility carefully
- Provide image/illustration variants

### Implementation

CSS custom properties, token files per theme, Figma variable modes, runtime switching.

### Rules

- Themes emerge from token overrides
- Test every component in every theme
- Respect OS theme preferences
- Document which tokens are themeable vs fixed

## Token Audit

### Audit Scope

- **Coverage**: What percentage of visual properties use tokens? Which are hard-coded?
- **Consistency**: Same tokens for same purposes? Redundant tokens? Deprecated tokens still used?
- **Gaps**: Visual values that should be tokens? Use cases not covered? Custom values suggesting missing scale steps?

### Audit Process

1. **Inventory** -- Extract all visual values from code/design files
2. **Categorize** -- Group by type (color, spacing, typography, etc.)
3. **Map** -- Match values to existing tokens
4. **Flag** -- Identify hard-coded values, mismatches, gaps
5. **Prioritize** -- Rank by frequency and impact
6. **Recommend** -- New tokens, migrations, cleanup

### Report Format

- Executive summary (adoption percentage, key findings)
- Detailed findings by category
- Hard-coded value inventory with suggested replacements
- Recommended new tokens
- Migration plan and priority

### Rules

- Audit both design files and code
- Automate detection where possible (lint rules)
- Focus on high-impact categories first (color, spacing)
- Track adoption over time

## Component Specifications

### Spec Structure

1. **Overview** -- Name, description, when to use / not use
2. **Anatomy** -- Visual breakdown, required vs optional elements
3. **Variants** -- Size (sm/md/lg), style (primary/secondary/ghost), layout
4. **Props/API** -- Name, type, default, description, required status
5. **States** -- Default, hover, focus, active, disabled, loading, error
6. **Behavior** -- Interactions, animations, responsive behavior, edge cases
7. **Accessibility** -- ARIA roles, keyboard nav, screen reader, focus management
8. **Usage Guidelines** -- Do/don't examples, content rules, related components

### Rules

- Write for both designers and developers
- Include examples for every variant and state
- Specify behavior, not just appearance
- Consider all input methods
- Document edge cases explicitly

## Pattern Library

### Pattern Entry Structure

- **Problem Statement** -- What need, what contexts
- **Solution** -- The pattern, key principles, visual/interaction description
- **Anatomy** -- Components, layout, required vs optional elements
- **Variants** -- Context-specific implementations, responsive adaptations
- **Behavior** -- User flow, state changes, error handling
- **Examples** -- Good implementations and anti-patterns with explanations
- **Accessibility** -- Inclusive design considerations, assistive tech support
- **Related Patterns** -- Similar, commonly combined, builds upon

### Categories

Navigation, input, display, feedback, onboarding.

### Rules

- Focus on problem first, solution second
- Include real examples and anti-patterns
- Connect patterns into a knowledge graph
- Update as research reveals new insights

## Naming Conventions

### Principles

Predictable. Consistent. Scalable. Scannable. Unambiguous.

### Patterns

- **Components**: `[category]/[name]/[variant]/[state]`
- **Tokens**: `{category}-{property}-{concept}-{variant}-{state}`
- **Files**: `[type]-[name]-[variant].[ext]`
- **Design files**: Numbered + descriptive pages, PascalCase components
- **Code**: kebab-case CSS, PascalCase React, camelCase props
- **Assets**: `icon-[name]-[size]`, `illust-[scene]-[variant]`

### Pitfalls

- Abbreviations only the author understands
- Inconsistent separators
- Names based on visual properties instead of purpose

### Rules

- Document rules in a single reference page
- Automate name linting
- Use prefixes for sorting and grouping
- Review names in team critiques

## Icon System

### Foundations

- **Grid**: Base size 24x24px, keylines, stroke width, corner radius
- **Sizes**: XS (12-16px), S (20px), M (24px), L (32px), XL (48px+)
- **Style**: Stroke, filled, duotone -- define when to use each

### Naming

`icon-[category]-[name]-[variant]`

Categories: action, navigation, content, communication, social, status, file, device.

### Delivery

SVG source, sprite sheets, component wrappers, Figma library.

### Accessibility

- Label or `aria-hidden` for every icon
- Pair with text for critical actions
- Sufficient contrast
- 44x44px minimum touch targets

### Rules

- Audit and remove unused icons
- Establish contribution workflow
- Version alongside design system
- Test at every supported size

## Design System Adoption

### Strategy Phases

1. **Awareness**: Launch demos, documentation site, changelogs, showcase projects
2. **Education**: Getting-started guides, usage guidelines, workshops, office hours
3. **Enablement**: Figma/Sketch libraries, code packages, templates, migration guides
4. **Incentives**: Celebrate adopters, track metrics, reduce friction, include in review criteria

### Measuring Adoption

- Component usage percentage in production
- Number of custom/override styles
- Support question volume (should decrease)
- Time to implement new features (should decrease)
- Consistency audit scores

### Common Barriers

- System doesn't cover team needs
- Documentation is incomplete or confusing
- Components too rigid to customize
- Breaking changes too frequent
- No clear contribution path

### Overcoming Resistance

- Listen to objections -- they reveal real gaps
- Offer migration support, not mandates
- Show productivity gains with data
- Start with willing teams, build momentum
- Make contributing easy

### Rules

- Treat the design system as a product with users
- Invest in documentation as much as components
- Support designers and developers equally
- Maintain a public roadmap
- Build community through contribution and feedback

## Documentation Templates

### Template Types

- **Component Docs**: Title, status, when to use, example, anatomy, variants, props, states, accessibility, content guidelines, tokens, related, changelog
- **Pattern Docs**: Problem statement, context, solution, behavior, examples (good/bad), accessibility, related patterns
- **Foundation Docs**: Purpose, principles, rules/specs, examples, exceptions, resources

### Standards

- Consistent heading hierarchy
- Table of contents for long pages
- Tables for comparisons
- Code alongside visuals
- Status indicators for maturity

### Rules

- Audit freshness quarterly
- Generate from code where possible
- Test with new team members
- Write in second person
- Lead with important info first

## Accessibility Audit

### WCAG 2.2 Principles (POUR)

- **Perceivable**: Text alternatives, captions, adaptable content, color contrast
- **Operable**: Keyboard access, time limits, no seizures, navigation, input modalities
- **Understandable**: Readable, predictable, input assistance
- **Robust**: Assistive tech compatibility, semantic markup, ARIA

### Severity Ratings

1. **Critical** -- Blocks access entirely
2. **Major** -- Significant difficulty
3. **Minor** -- Inconvenience with workarounds
4. **Enhancement** -- Beyond compliance improvement

### Issue Format

Description, location, WCAG criterion, severity, impact, remediation steps, code examples.

### Rules

- Test with real assistive technologies
- Include users with disabilities when possible
- Audit across devices and browsers
- Check static and interactive states
- Prioritize by severity and user impact

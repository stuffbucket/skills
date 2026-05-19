---
name: design-normalize
description: Audit and realign UI to match design system standards, spacing, tokens, and patterns. Use when asked about consistency, design drift, mismatched styles, tokens, or bringing a feature back in line with the system.
metadata:
  author: stuffbucket
  version: 1.0.0
---

Analyze and redesign the feature to perfectly match design system standards, aesthetics, and established patterns.

## Mandatory Preparation

Invoke /design-frontend — it contains design principles, anti-patterns, and the Context Gathering
Protocol. Follow the protocol before proceeding. If no design context exists yet, run
/design-context first.

---

## Plan

Before making changes, deeply understand the context:

1. **Discover the design system**: Search for design system documentation, UI guidelines, component libraries, or style guides. Study it thoroughly until you understand:
   - Core design principles and aesthetic direction
   - Target audience and personas
   - Component patterns and conventions
   - Design tokens (colors, typography, spacing)

   If something is not clear, ask. Do not guess at design system principles.

2. **Analyze the current feature**: Assess what works and what does not:
   - Where does it deviate from design system patterns?
   - Which inconsistencies are cosmetic vs functional?
   - What is the root cause — missing tokens, one-off implementations, or conceptual misalignment?

3. **Create a normalization plan**: Define specific changes that will align the feature with the design system:
   - Which components can be replaced with design system equivalents?
   - Which styles need to use design tokens instead of hard-coded values?
   - How can UX patterns match established user flows?

   Great design is effective design. Prioritize UX consistency and usability over visual polish alone.

## Execute

Systematically address all inconsistencies across these dimensions:

- **Typography**: Use design system fonts, sizes, weights, line heights. Replace hard-coded values with tokens.
- **Color and Theme**: Apply design system color tokens. Remove one-off color choices.
- **Spacing and Layout**: Use spacing tokens. Align with grid systems.
- **Components**: Replace custom implementations with design system components.
- **Motion and Interaction**: Match animation timing and easing to other features.
- **Responsive Behavior**: Ensure breakpoints align with design system standards.
- **Accessibility**: Verify contrast ratios, focus states, ARIA labels.
- **Progressive Disclosure**: Match information hierarchy to established patterns.

**NEVER**:

- Create new one-off components when design system equivalents exist
- Hard-code values that should use design tokens
- Introduce new patterns that diverge from the design system
- Compromise accessibility for visual consistency

## Clean Up

After normalization, ensure code quality:

- Consolidate reusable components into the design system or shared UI path.
- Remove orphaned code made obsolete by normalization.
- Verify quality: lint, type-check, test. Ensure no regressions.
- Ensure DRYness: consolidate duplication from refactoring.

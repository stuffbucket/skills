---
name: design-audit
description: Evaluate and improve usability of existing front-end interfaces — local source code or live websites by URL. Use when reviewing UI, auditing interfaces, checking accessibility, evaluating designs, improving UX, or when users describe symptoms like "something feels off", "users keep abandoning this form", "conversion dropped after redesign", or "people say it's confusing".
metadata:
  author: stuffbucket
  version: 1.0.0
allowed-tools: WebFetch Read Glob Grep
---

# Design Audit

Audit and improve front-end interfaces using 15 established usability principles.

## What This Skill Does

Perform a comprehensive design audit — thinking like a senior UX designer reviewing an interface
end-to-end. Inspect existing code against 15 established design principles, identify problems at
component and system level, rate severity, and provide concrete fixes.

This is not a surface-level lint. Evaluate the full picture: component issues, cross-page
consistency, design system coherence, interaction patterns, information architecture, and the
holistic user journey.

---

## Who This Is For

Anyone with front-end code to improve. Adjust language to the user:

- Most users won't know UX jargon — explain *why* each principle matters
- If user seems UX-savvy, be concise and reference principles by name
- When in doubt, explain. Educational value is part of the skill's purpose.

---

## The 15 Usability Principles

| # | Principle |
| --- | ----------- |
| 1 | Visibility of System Status |
| 2 | Match Between System and Real World |
| 3 | User Control and Freedom |
| 4 | Consistency and Standards |
| 5 | Error Prevention |
| 6 | Recognition Over Recall |
| 7 | Flexibility and Efficiency |
| 8 | Aesthetic and Minimalist Design |
| 9 | Error Recovery |
| 10 | Help and Documentation |
| 11 | Affordances and Signifiers |
| 12 | Structure |
| 13 | Accessibility |
| 14 | Perceptibility |
| 15 | Tolerance and Forgiveness |

For detailed definitions, violation patterns, and fix guidance: read `references/heuristics.md`.

---

## Severity Scale

| Rating | Label | Action |
| -------- | ------- | -------- |
| **4** | Catastrophe | Must fix — users cannot complete tasks |
| **3** | Major | High priority — users struggle significantly |
| **2** | Minor | Low priority — users notice but work around |
| **1** | Cosmetic | Fix if time — aesthetic issue only |

**Three factors:** Frequency (rare/occasional/frequent) x Impact (workaround/struggle/blocked) x Persistence (one-time/recurring). Rate by **user impact**, not fix difficulty.

---

## Two Input Modes

**Local Project (source code)** — Full access to read, evaluate, and implement fixes.

**Live Website (URL)** — Report-only. Use WebFetch. Note limitations: evaluating served HTML, not source; JS behavior, loading states, dynamic content may not be observable.

---

## Workflow

### Discussion Mode (Default)

1. **Discover** — Read front-end code (local) or fetch page (URL). Identify interface type, stack, primary flows.
2. **Evaluate** — Read `references/heuristics.md`. Systematically inspect against all 15 principles at component, hidden UI, visual design, and system levels.
3. **Report** — Present structured findings grouped by severity (see format below).
4. **Discuss** — Walk user through findings. Explain *why* each matters. Let user decide what to skip.
5. **Implement** — Fix all findings by default through the design system. Read
   `references/patterns.md` for code examples. Three phases: establish design foundation (tokens),
   apply fixes, design coherence pass. *(Local only.)*
6. **Verify** — Post-implementation review. Not "confirm you did it" — focused second look for fix-introduced issues and first-pass misses. Typically catches 3-8 additional findings.

### Quick Mode

1. Discover → 2. Evaluate → 3. Summary → 4. Implement all → 5. Verify → 6. Report changes.

---

## Evaluation Process

### Step 1: Discover

**Local:** Read ALL front-end files. Include application shell (index.html, global CSS, layout). Multi-page projects: read every page — different pages have different issues.

**URL:** Fetch key pages (up to 5). Extract: document structure, semantic landmarks, accessibility attributes, link/button patterns, stylesheets.

### Step 2: Evaluate

Read `references/heuristics.md` first.

Walk through every principle, one by one. For each, ask: "Does this interface violate this principle anywhere?"

> **Evaluate at these levels:**

- **Component level** — HTML structure, CSS styling, JS behavior, accessibility attributes, responsive behavior
- **Hidden/dynamic UI** — Modals, dropdowns, drawers, tooltips, accordions, tabs, form validation
  states, empty/loading/error states, confirmation dialogs. These get the least design attention and
  contain the worst issues.
- **Visual design** — Typography hierarchy, spacing/proximity, visual weight, color purpose, information density, alignment, interactive state visibility
- **System level** — Cross-page consistency, interaction patterns, design system coherence, navigation, meta/SEO

**Important:** If finding fewer than 10 issues, go back through "clean" principles and look harder —
especially visual design, hidden UI, cross-page patterns, and edge cases. If all findings are ARIA
labels and semantic HTML, you're missing the visual design layer.

**Principle Coverage Verification:** Before writing the report, confirm every one of the 15 principles was consciously assessed.

### Step 3: Report

```text
## UX Design Audit Report

**Scope:** [what was evaluated]
**Source:** [all files or URLs reviewed]
**Interface type:** [dashboard / form / e-commerce / etc.]

### Summary
| Severity | Count |
|----------|-------|
| 4 - Catastrophe | X |
| 3 - Major | X |
| 2 - Minor | X |
| 1 - Cosmetic | X |

### Quick Wins
1. [Finding] (Severity X) — [one-line fix]

### Findings
#### [Severity 4] Finding title
- **Principle:** [which principle violated]
- **Location:** `file.tsx:42`
- **Issue:** [what's wrong]
- **User impact:** [what real users experience]
- **Fix:** [specific, actionable recommendation]

### Strengths
[At least 3 things done well. A report that's only negative is demoralizing.]
```

### Step 5: Implement

Read `references/patterns.md` for concrete code examples.

**Phase 1: Design Foundation** — Extract and consolidate implicit design system. Define CSS custom properties for spacing scale, type scale, color palette, shadows, radii, transitions.

**Phase 2: Apply Fixes** — Through the design system, not with ad-hoc values. Be confidently visible — if type scale is flat, establish clear hierarchy.

**Phase 3: Coherence Pass** — Review holistically. Check spacing rhythm, typography consistency,
color discipline, icon consistency, component patterns, interactive states, transitions, alignment,
semantic-visual sync.

### Step 6: Verify

Check for fix-introduced issues: semantic-visual sync, specificity conflicts, token leaks, visual
balance shifts. Check for first-pass misses: complex components, state combinations, content edge
cases.

---

## Anti-Patterns

- Trending color sameness (indigo/purple/blue defaults)
- Cards for everything
- Competing CTAs — one primary per region
- Equal visual weight everywhere
- Padding as whitespace
- System structure instead of user tasks
- Low contrast text (never below 4.5:1)

---

## Commands

- `/design-audit` — Full evaluation with discussion
- `/design-audit:evaluate` — Report only, no implementation
- `/design-audit:improve` — Jump to implementation from existing evaluation
- `/design-audit:quick` — Auto-accept: evaluate and implement without discussion

## References

- `references/heuristics.md` — Read during evaluation. Definitions, violation patterns, severity guidance for all 15 principles.
- `references/patterns.md` — Read during implementation only. Code examples for common fixes.
- `references/testing-methods.md` — Usability testing, A/B testing, accessibility testing methods.

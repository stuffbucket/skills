---
name: design
description: Root index for the design-* family — UI/UX design review, refinement, and production polish across foundation (project context, design system, frontend scaffolding), visual treatment (color, typography, layout, motion), UX content and flow (clarity, onboarding, adaptation), and review/quality (audit, critique, check, polish, harden). Use when the user asks to design, review, improve, polish, animate, simplify, or audit a UI; or mentions visual hierarchy, design system drift, accessibility, or "make this look better". Routes to specific design-* sub-skills.
---

# Design

Family of opinionated design skills for reviewing and improving real frontend code. Most paths
start by establishing project context (`design-context`), then branch into a transformation
(animate, bolder, polish) or a review (critique, audit, check).

## One-time setup

- `design-context` — gathers project-specific design context (brand, audience, design system) and
  writes `.design-context.md`. Run this first; almost every other design-* skill produces generic
  output without it.

## Routing table

### Foundation

- `design-context` — first-run setup, project priming (see above).
- `design-frontend` — build distinctive production-grade UI; avoid generic AI aesthetics; entry point for new components/pages/dashboards.
- `design-extract` — pull repeated UI into reusable components / tokens / patterns; grow the design system.
- `design-normalize` — re-align drifted UI back to design-system tokens and patterns.

### Visual treatment

- `design-colorize` — strategic color for monochrome / gray / dull interfaces.
- `design-quieter` — tone down loud / aggressive / overstimulating designs.
- `design-bolder` — amplify safe / generic designs with concrete intensity options.
- `design-typeset` — fix font choice, hierarchy, sizing, weight, readability.
- `design-typography-rules` — enforce typographic correctness (quotes, dashes, spacing); auto-applies when generating UI with text.
- `design-arrange` — layout, spacing, rhythm, visual hierarchy.
- `design-animate` — purposeful animation, micro-interactions, motion.
- `design-delight` — moments of joy, personality, memorable touches.
- `design-overdrive` — push past conventional limits (shaders, physics, scroll-driven, 60fps).
- `design-distill` — strip to essence; remove unnecessary complexity.

### UX content and flow

- `design-clarify` — improve UX copy, labels, error messages, microcopy.
- `design-onboard` — first-run experience, empty states, activation.
- `design-adapt` — responsive layouts, breakpoints, touch targets, cross-device.
- `design-harden` — resilience: error states, i18n, overflow, edge cases.
- `design-optimize` — performance: loading, rendering, bundle size, animation FPS.

### Review and quality

- `design-audit` — usability eval of existing source or live URL; for symptoms like "users keep abandoning this form".
- `design-critique` — UX critique with scoring, persona testing, actionable feedback.
- `design-check` — technical quality report (a11y, perf, theming, responsive, anti-patterns) with P0–P3 ratings.
- `design-polish` — final pre-ship pass: alignment, spacing, micro-detail.

## Cross-family edges

- `figma-make-to-vite` — when the user wants to take a Figma Make export and turn it into a working Vite app; pair with `design-frontend` and `design-context`.
- `react-composition` — when extracting components in `design-extract`, the React API design lives here.
- `react-best-practices` — pairs with `design-optimize` for render-perf root causes.
- `pages-prepare-vite` and the rest of `pages-*` — when shipping the resulting design as a static site.
- `tauri-windows-custom-titlebar` / `tauri-windows-transparency-vibrancy` — when the surface is a Tauri WebView, not a plain browser page.
- `code-review-cycle` — to land design changes through review.

## Decision flow

1. No `.design-context.md` in repo → start with `design-context` regardless of the immediate ask.
2. Building something new → `design-frontend`.
3. User describes a symptom ("feels off", "users confused") → `design-audit` or `design-critique`.
4. User names a specific lever (color / type / motion / layout / copy) → jump directly to that sibling.
5. User says "ship-ready" / "final pass" → `design-polish`, then `design-check`, then `design-harden`.
6. User wants a design system out of repeated UI → `design-extract`, then `design-normalize` to retrofit usages.

## When NOT to use this skill

- Pure CSS/HTML syntax questions with no design judgment involved — go to MDN.
- Logo, illustration, or brand-identity work — these skills assume application UI.
- Pure performance engineering with no visible UI symptom — use a perf profiler workflow.
- Brand strategy / marketing copy — `design-clarify` handles UX microcopy only.

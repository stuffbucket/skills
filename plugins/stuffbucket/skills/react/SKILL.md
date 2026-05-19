---
name: react
description: Root index for the react-* family — performance best practices (Vercel Engineering guidelines for React + Next.js) and composition patterns (compound components, render props, context, React 19 API changes). Use when the user asks about React or Next.js patterns, component API design, render performance, bundle optimization, or refactoring boolean-prop proliferation.
---

# React

Small family with two complementary skills — one for runtime/build performance, one for component API design.

## Routing table

| Skill | When to use |
| --- | --- |
| `react-best-practices` | Performance optimization for React + Next.js per Vercel Engineering — render cost, data fetching, Suspense, server components, bundle size, image/font handling. Use when writing, reviewing, or refactoring code for performance. |
| `react-composition` | API design that scales — compound components, render props, context providers, slot patterns, React 19 changes. Use when a component has too many boolean props, when building a reusable library, or when designing a flexible component API. |

## Cross-family edges

- `tauri` (and especially `tauri-setup-vite`, `tauri-commands`, `tauri-events`) — when React is the frontend of a Tauri app; the React-side patterns live here while the Rust-side patterns live there.
- `figma-make-to-vite` — turn a Figma Make export into a Vite + React app; pair with `react-composition` when extracting reusable components.
- `design-frontend`, `design-extract`, `design-polish` — design judgment paired with React implementation.
- `design-optimize` — when slow UI is symptom-first; `react-best-practices` is the root-cause counterpart.
- `boundary-domain-closure` — close component prop domains with discriminated unions instead of boolean proliferation.
- `pages-build-vite` — bundle size shows up here.

## Decision flow

1. "Feels slow / re-renders too much / bundle too big / waterfall" → `react-best-practices`.
2. "Too many props / boolean explosion / can't compose this" → `react-composition`.
3. Both at once (large library refactor) → start with `react-composition` to fix the API, then `react-best-practices` for runtime cost.
4. React 19 upgrade questions → `react-composition` (covers API changes).

## When NOT to use this skill

- Plain JS / TS language questions with no React surface.
- CSS-in-JS / styling library selection — see `design-frontend`.
- Routing-specific questions (React Router, Next.js App Router internals) — these skills assume the router is already chosen.
- State management library selection — neither skill takes a position on Redux vs Zustand vs Jotai.

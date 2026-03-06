---
name: figma-make-to-vite
description: Initializes a Vite + React + TypeScript project and integrates a Figma Make exported ZIP prototype into it so it runs locally via `npm run dev`. Use when a user has a Figma Make export ZIP and wants to run it or merge it into an existing project.
---

# figma-make-to-vite

Sets up a Vite + React + TypeScript project in the current directory and
integrates a Figma Make prototype export (ZIP) into it so it runs locally via
`npm run dev` as if it had been created as part of the project.

## Figma Make Export Structure

Figma Make exports a self-contained ZIP that is **already a complete Vite
project**. Observed layout from real exports:

```text
index.html                          ← Vite entry HTML, mounts #root
package.json                        ← all deps pinned, name "@figma/my-make-file"
vite.config.ts                      ← React + Tailwind v4 vite plugins, @ alias
postcss.config.mjs                  ← empty by default (Tailwind v4 needs no config)
README.md
ATTRIBUTIONS.md
guidelines/Guidelines.md

src/
  main.tsx                          ← createRoot entry, imports styles/index.css
  styles/
    index.css                       ← @import chain: fonts → tailwind → theme
    tailwind.css                    ← @import "tailwindcss"
    fonts.css                       ← Google Fonts or local font-face rules
    theme.css                       ← CSS custom properties (Figma design tokens)
  app/
    App.tsx                         ← RouterProvider + DndProvider root wrapper
    routes.ts                       ← react-router createBrowserRouter definitions
    context/
      AppContext.tsx
      DocumentContext.tsx
    data/
      documentStore.ts
      indexedDBService.ts
      navigationStructure.ts
    components/
      Root.tsx                      ← layout shell, renders <Outlet />
      ui/                           ← shadcn/radix-ui primitives (40+ files)
      figma/
        ImageWithFallback.tsx       ← img with onerror fallback for Figma assets
      FloatingMenu.tsx
      EditableContent.tsx
      DocumentView.tsx
      RightNavPanel.tsx
      ImageAnnotation.tsx
  imports/                          ← ★ Figma frames as TSX components (unique per export)
    *.tsx                           ← one file per exported Figma frame
    svg-*.ts                        ← inline SVG data modules (base64 or path data)
```

### Key observations

- `vite.config.ts` requires **both** `@vitejs/plugin-react` and
  `@tailwindcss/vite` (Tailwind v4 vite plugin). Removing either breaks the
  build. There is no `tailwind.config.js` — Tailwind v4 is config-file-free.
- Path alias `@` → `src/` is set in `vite.config.ts` and used throughout all
  source files. Do not omit this alias when merging into an existing project.
- `src/imports/` is the **unique content** per Figma Make export — these are
  the Figma frames converted to TSX. Everything else is reusable boilerplate.
- `src/styles/theme.css` contains CSS custom properties that are the Figma
  design tokens. Preserve it exactly from the ZIP.
- `src/styles/index.css` is the CSS entry: it imports fonts → tailwind →
  theme in that order.
- `package.json` lists React 18 in both `dependencies` (pinned) and
  `peerDependencies` (optional). `npm install` handles this correctly as-is.
- The `pnpm.overrides` field pins `vite`; npm ignores this harmlessly.
- `postcss.config.mjs` is intentionally empty — Tailwind v4's vite plugin
  injects PostCSS transforms automatically.

## When to Use This Skill

Use when:

- A user has a Figma Make export ZIP in `./contrib/` or `./` and wants to run
  it locally with Vite.
- A user says "integrate my Figma Make prototype", "set up vite for my Figma
  export", "apply my Figma Make zip", or similar.
- The current directory is empty/fresh (contains only `contrib/`).
- The current directory already has a Vite/React project and the user wants to
  merge a new Figma Make export into it without destroying existing work.

## How to Use

Run the integration script:

```bash
# Auto-detect ZIP in ./contrib/ or ./ (errors if ambiguous)
python3 skills/figma-make-to-vite/scripts/apply_figma_make.py

# Explicit ZIP path
python3 skills/figma-make-to-vite/scripts/apply_figma_make.py --zip contrib/MyPrototype.zip

# Force overwrite of existing src/app/ files (use when re-applying an export)
python3 skills/figma-make-to-vite/scripts/apply_figma_make.py --force
```

To fix type errors on an already-integrated project (without re-importing):

```bash
python3 skills/figma-make-to-vite/scripts/fix_figma_type_errors.py

# Preview changes without writing files
python3 skills/figma-make-to-vite/scripts/fix_figma_type_errors.py --dry-run
```

### What the script does (in order)

1. **Locate ZIP** — searches `./contrib/*.zip` then `./*.zip` when `--zip` is
   not given. Errors clearly if zero or more than one are found.
2. **Extract** — unpacks to `/tmp/figma-<slug>-<epoch>/` (never pollutes `./`
   during the process). Validates the extract contains `src/main.tsx` and
   `vite.config.ts` to confirm it is a Figma Make export.
3. **Scaffold if needed** — if no `./package.json` exists, the entire extracted
   tree is copied to `./` directly (the ZIP is already a valid, runnable Vite
   project).
4. **Merge if existing project** — if `./package.json` already exists:
   - Merges all `dependencies` and `devDependencies` from the ZIP's
     `package.json` into the existing one, keeping the higher version string
     where there is a conflict.
   - Copies `vite.config.ts`, `postcss.config.mjs`, and `index.html` only if
     those files do not already exist in `./`.
   - Always overwrites `src/styles/` and `src/imports/` (design tokens and
     Figma frames must come from the export).
   - Copies `src/app/` files only if they do not already exist, or if `--force`
     is passed (protects user customisations).
5. **Install** — detects `pnpm-lock.yaml` and runs `pnpm install`, otherwise
   runs `npm install`. Before installing, adds `typescript@5`, `@types/react@18`,
   `@types/react-dom@18`, and `@types/node` to `devDependencies` if absent
   (Figma Make omits these), and creates `tsconfig.json` if missing (Vite
   bundler-mode, with the `@` alias wired to `src/`).
6. **Fix type errors** — runs `fix_figma_type_errors.py`, which automatically
   resolves the four TypeScript error patterns Figma Make consistently generates
   (see below), then re-runs `tsc --noEmit` to verify. Non-fatal if errors
   remain after fixing — `npm run dev` still works; fix residual errors before
   deploying.
7. **Report** — prints a summary of what was changed and the command to start
   the dev server.

### Figma Make type error patterns (auto-fixed by `fix_figma_type_errors.py`)

These are code generation bugs consistently produced by Figma Make's AI across
different exports. All four are safe to run via `npm run dev`; only `tsc` and
strict type-checking surface them.

| Pattern | tsc error | Description | Auto-fix |
| ------- | --------- | ----------- | -------- |
| **HREF_ON_SPAN** | TS2322 | Figma generates `<a href="url"><span href="url">` where the inner `<span>` redundantly gets the same `href`. `href` is not a valid attribute on `<span>`. | Remove `href` from all `<span>` elements |
| **VENDOR_CSS** | TS2353 | Vendor-prefixed CSS properties (`WebkitUserDrag`, `WebkitUserSelect`, etc.) appear in inline `style` objects. `React.CSSProperties` excludes vendor prefixes. | Cast the style object `as React.CSSProperties` |
| **ORPHAN_REF** | TS2304 | A `useRef` variable is read via `.current` in a component but never declared in that scope. Common in Figma-generated debounce, animation, and timer patterns. | Insert `const X = useRef<ReturnType<typeof setTimeout> \| null>(null)` after the last `useRef` call in the same scope |
| **ELEMENT_HANDLER** | TS2322 | An event handler is typed for a specific HTML element (e.g. `MouseEvent<HTMLButtonElement>`) but also assigned to a more generic element (e.g. a `<div>`). Figma Make generates handlers and then applies them across element types without widening. | Widen parameter type to `React.MouseEvent<Element>` |

## Examples

- "I have a Figma Make export in contrib/, set it up with Vite"
- "Apply my Figma prototype ZIP to this project"
- "Initialize from my Figma Make zip and make sure it runs"
- "Merge my new Figma Make export into the existing project"
- "I downloaded a Figma Make zip, how do I get it running with npm run dev?"

## Guidelines

- **Never delete** existing `src/app/` files unless `--force` is passed — the
  user may have customised them after a previous import.
- **Always preserve `src/imports/` from the ZIP** — this is the primary output
  of Figma Make (the exported frames). Never merge or patch it; always replace.
- **Tailwind v4 constraint** — do not create `tailwind.config.js`. Tailwind v4
  configures itself through CSS (`@theme` in `theme.css`) and the vite plugin.
- **`@` alias is required** — if merging into an existing project that lacks
  the `@` alias in `vite.config.ts`, add it. Without it all Figma Make imports
  fail at build time.
- **Warn before overwriting router config** — if the target project has its own
  `src/app/routes.ts`, warn the user and skip unless `--force` is passed.
- **Style chain order matters** — `index.css` must import in the order:
  fonts → tailwind → theme. Reversing this breaks CSS variable resolution.
- Keep main content under 500 lines for optimal context management.

## References

- `references/figma-make-export-anatomy.md` — detailed breakdown of every file
  in a Figma Make export and its role.
- `scripts/apply_figma_make.py` — the integration script (steps 1–7 above).
- `scripts/fix_figma_type_errors.py` — standalone type error fixer; also called
  by `apply_figma_make.py` as step 6. Run directly after re-applying an export
  or when type errors appear: `python3 skills/figma-make-to-vite/scripts/fix_figma_type_errors.py`

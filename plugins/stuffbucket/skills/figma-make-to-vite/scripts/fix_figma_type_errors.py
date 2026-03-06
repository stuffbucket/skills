#!/usr/bin/env python3
"""
fix_figma_type_errors.py

Auto-fix the four TypeScript error patterns that Figma Make's code generator
consistently produces. Run after apply_figma_make.py, or standalone on any
Figma Make project.

Four patterns addressed:

  HREF_ON_SPAN    (TS2322) — Figma generates <a href="url"><span href="url">
                  where the inner <span> redundantly gets the same href.
                  href is not a valid attribute on <span>.
                  Fix: remove href from all <span> elements.

  VENDOR_CSS      (TS2353) — Vendor-prefixed CSS properties (WebkitUserDrag,
                  WebkitUserSelect, etc.) in inline style objects. TypeScript's
                  CSSProperties type excludes vendor prefixes.
                  Fix: cast the style object as React.CSSProperties.

  ORPHAN_REF      (TS2304) — A useRef variable is accessed via .current in a
                  component but was never declared in that scope. Common in
                  Figma-generated debounce, timer, and animation patterns.
                  Fix: insert const X = useRef<ReturnType<typeof setTimeout>
                  | null>(null) after the last useRef call in the same scope.

  ELEMENT_HANDLER (TS2322) — An event handler is typed for a specific HTML
                  element (e.g. MouseEvent<HTMLButtonElement>) but also assigned
                  to a more generic element (e.g. a <div>). Figma Make generates
                  handlers and then applies them to both specific and generic
                  elements without widening the type.
                  Fix: widen the parameter type to React.MouseEvent<Element>.

Usage:
    python3 skills/figma-make-to-vite/scripts/fix_figma_type_errors.py
    python3 skills/figma-make-to-vite/scripts/fix_figma_type_errors.py --dry-run
    python3 skills/figma-make-to-vite/scripts/fix_figma_type_errors.py --dir ./src
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Patterns
# ---------------------------------------------------------------------------

# href on a <span> tag — always invalid, always safe to remove
HREF_ON_SPAN_RE = re.compile(r'(<span\b(?:[^>"]|"[^"]*")*?) href="[^"]*"')

# Inline style object containing a Webkit-prefixed property, not yet cast
VENDOR_CSS_RE = re.compile(
    r'(style=\{\{)([^{}]*Webkit[A-Z][^{}]*)(\}\})(?!\s*as\s)'
)

# Event handler typed for a specific HTML subtype (any element kind)
ELEMENT_HANDLER_RE = re.compile(r'React\.MouseEvent<HTML\w+Element>')

# tsc TS2304 — "Cannot find name 'X'"
TS2304_RE = re.compile(
    r'^(.+\.tsx)\((\d+),\d+\): error TS2304: Cannot find name \'(\w+)\'',
    re.MULTILINE,
)

# tsc TS2322 — handler type mismatch involving MouseEvent<HTMLXxxElement>
TS2322_HANDLER_RE = re.compile(
    r'^(.+\.tsx)\(\d+,\d+\): error TS2322: Type \'.*React\.MouseEvent<HTML\w+Element>.*\' is not assignable',
    re.MULTILINE,
)

# ---------------------------------------------------------------------------
# IO helpers
# ---------------------------------------------------------------------------

def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, content: str, dry_run: bool) -> None:
    if not dry_run:
        path.write_text(content, encoding="utf-8")


def run_tsc(project_root: Path) -> tuple[int, str]:
    tsc_bin = project_root / "node_modules" / ".bin" / "tsc"
    if not tsc_bin.exists():
        return -1, ""
    result = subprocess.run(
        [str(tsc_bin), "--noEmit"],
        cwd=project_root,
        capture_output=True,
        text=True,
    )
    return result.returncode, result.stdout + result.stderr


# ---------------------------------------------------------------------------
# Fix A — HREF_ON_SPAN
# ---------------------------------------------------------------------------

def fix_href_on_span(content: str) -> tuple[str, int]:
    """
    Remove href attributes from <span> elements. The href is always a copy of
    the enclosing <a> href and is invalid on <span>.
    """
    new, count = HREF_ON_SPAN_RE.subn(r'\1', content)
    return new, count


# ---------------------------------------------------------------------------
# Fix B — VENDOR_CSS
# ---------------------------------------------------------------------------

def fix_vendor_css(content: str) -> tuple[str, int]:
    """
    Cast inline style objects that contain vendor-prefixed CSS properties
    (Webkit*, Moz*, Ms*) as React.CSSProperties so TypeScript accepts them.

    Transforms:
        style={{ WebkitUserDrag: 'none', userSelect: 'none' }}
    Into:
        style={{ WebkitUserDrag: 'none', userSelect: 'none' } as React.CSSProperties}
    """
    new, count = VENDOR_CSS_RE.subn(r'\1\2} as React.CSSProperties}', content)
    return new, count


# ---------------------------------------------------------------------------
# Fix C — ORPHAN_REF
# ---------------------------------------------------------------------------

def fix_orphan_ref(content: str, varname: str, error_line: int) -> tuple[str, int]:
    """
    Declare a missing useRef variable that a component reads via .current.

    Strategy: find the last useRef() call before the error line and insert the
    new declaration immediately after it, matching its indentation. Falls back
    to the last useState/useContext call if no useRef is present.

    The declared type is ReturnType<typeof setTimeout> | null, which covers the
    most common Figma Make pattern (debounced saves, animation timers).
    """
    lines = content.splitlines(keepends=True)
    limit = min(error_line - 1, len(lines))

    insert_after = -1
    for i in range(limit - 1, -1, -1):
        if "useRef(" in lines[i]:
            insert_after = i
            break

    if insert_after == -1:
        for i in range(limit - 1, -1, -1):
            if "useState(" in lines[i] or "useContext(" in lines[i]:
                insert_after = i
                break

    if insert_after == -1:
        return content, 0

    ref_line = lines[insert_after]
    indent = len(ref_line) - len(ref_line.lstrip())
    indent_str = ref_line[:indent]

    new_line = (
        f"{indent_str}const {varname} = "
        f"useRef<ReturnType<typeof setTimeout> | null>(null);\n"
    )
    lines.insert(insert_after + 1, new_line)
    return "".join(lines), 1


# ---------------------------------------------------------------------------
# Fix D — ELEMENT_HANDLER
# ---------------------------------------------------------------------------

def fix_element_handler(content: str) -> tuple[str, int]:
    """
    Widen event handler parameter types from a specific HTML element subtype
    (e.g. HTMLButtonElement) to the base Element interface.

    This allows the same handler to be passed to both specific elements (button,
    input) and generic ones (div, span) without separate definitions.

    React.MouseEvent<HTMLButtonElement> → React.MouseEvent<Element>
    React.MouseEvent<HTMLDivElement>    → React.MouseEvent<Element>
    """
    new, count = ELEMENT_HANDLER_RE.subn("React.MouseEvent<Element>", content)
    return new, count


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def apply_preemptive_fixes(src_dir: Path, dry_run: bool) -> dict[str, int]:
    """
    Apply HREF_ON_SPAN and VENDOR_CSS across all TSX files. These fixes are
    pre-emptive — they are always correct regardless of what tsc reports.
    """
    counts = {"href_on_span": 0, "vendor_css": 0}
    for tsx in sorted(src_dir.rglob("*.tsx")):
        original = read(tsx)
        content = original

        content, n = fix_href_on_span(content)
        counts["href_on_span"] += n

        content, n = fix_vendor_css(content)
        counts["vendor_css"] += n

        if content != original:
            write(tsx, content, dry_run)
            rel = tsx.relative_to(src_dir.parent)
            print(f"  fixed: {rel}")

    return counts


def apply_tsc_driven_fixes(
    project_root: Path,
    tsc_output: str,
    dry_run: bool,
) -> dict[str, int]:
    """
    Apply ORPHAN_REF and ELEMENT_HANDLER fixes guided by tsc --noEmit output.
    """
    counts = {"orphan_ref": 0, "element_handler": 0}
    modified: dict[Path, str] = {}

    def get(path: Path) -> str:
        if path not in modified:
            modified[path] = read(path)
        return modified[path]

    def put(path: Path, content: str) -> None:
        modified[path] = content

    # Fix C — ORPHAN_REF
    for m in TS2304_RE.finditer(tsc_output):
        rel_path, line_str, varname = m.group(1), m.group(2), m.group(3)
        # Only handle camelCase variable names (not type/interface names)
        if not varname[0].islower():
            continue
        filepath = (project_root / rel_path).resolve()
        if not filepath.exists():
            continue
        content, n = fix_orphan_ref(get(filepath), varname, int(line_str))
        if n:
            put(filepath, content)
            counts["orphan_ref"] += n
            print(f"  fixed ORPHAN_REF '{varname}' in {rel_path}")

    # Fix D — ELEMENT_HANDLER
    seen: set[Path] = set()
    for m in TS2322_HANDLER_RE.finditer(tsc_output):
        rel_path = m.group(1)
        filepath = (project_root / rel_path).resolve()
        if not filepath.exists() or filepath in seen:
            continue
        seen.add(filepath)
        content, n = fix_element_handler(get(filepath))
        if n:
            put(filepath, content)
            counts["element_handler"] += n
            print(f"  fixed ELEMENT_HANDLER ({n} handler(s)) in {rel_path}")

    for path, content in modified.items():
        write(path, content, dry_run)

    return counts


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Auto-fix Figma Make TypeScript error patterns: "
            "HREF_ON_SPAN, VENDOR_CSS, ORPHAN_REF, ELEMENT_HANDLER."
        )
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would be changed without writing files.",
    )
    parser.add_argument(
        "--dir",
        default="./src",
        metavar="PATH",
        help="Source directory to scan (default: ./src).",
    )
    args = parser.parse_args()

    project_root = Path.cwd()
    src_dir = (project_root / args.dir).resolve()

    if not src_dir.exists():
        print(f"ERROR: Source directory not found: {src_dir}", file=sys.stderr)
        sys.exit(1)

    dry_label = " (dry run)" if args.dry_run else ""
    print(f"\nfigma type error fixer{dry_label}")
    print(f"source: {src_dir}\n")

    # Phase 1 — pre-emptive fixes (no tsc required)
    print("[1/3] Pre-emptive fixes (HREF_ON_SPAN, VENDOR_CSS)…")
    pre = apply_preemptive_fixes(src_dir, args.dry_run)
    print(f"  href-on-span: {pre['href_on_span']} fix(es)")
    print(f"  vendor-css:   {pre['vendor_css']} fix(es)")

    # Phase 2 — tsc-output driven fixes
    tsc_bin = project_root / "node_modules" / ".bin" / "tsc"
    if not tsc_bin.exists():
        print("\n[2/3] SKIP: node_modules/.bin/tsc not found — run npm install first.")
        sys.exit(0)

    print("\n[2/3] tsc-driven fixes (ORPHAN_REF, ELEMENT_HANDLER)…")
    rc, tsc_output = run_tsc(project_root)
    if rc == 0:
        print("  tsc: clean — nothing to fix.")
    else:
        driven = apply_tsc_driven_fixes(project_root, tsc_output, args.dry_run)
        print(f"  orphan-ref:      {driven['orphan_ref']} fix(es)")
        print(f"  element-handler: {driven['element_handler']} fix(es)")

    total = sum(pre.values()) + (sum(driven.values()) if rc != 0 else 0)

    # Phase 3 — verify
    if not args.dry_run and total > 0:
        print("\n[3/3] Verifying with tsc…")
        rc2, remaining = run_tsc(project_root)
        if rc2 == 0:
            print("  tsc: clean.")
        else:
            lines = remaining.strip().splitlines()
            print(f"  tsc: {len(lines)} line(s) of output remain (manual fixes needed).")
            for line in lines[:20]:
                print(f"    {line}")
            if len(lines) > 20:
                print(f"    … and {len(lines) - 20} more")
    elif args.dry_run:
        print("\n[3/3] Dry run — skipping final tsc check.")
    else:
        print("\n[3/3] No fixes applied — tsc output (if any) requires manual review.")

    print(f"\nDone. {total} fix(es) applied.")
    sys.exit(0 if total > 0 or rc == 0 else 1)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""detect-slop.py — deterministic first pass for the design-taste skill.

Greps a frontend codebase for the machine-detectable "AI slop" tells so the model
does not spend inference measuring what a regex can measure. Judgment tells
(contrast, asymmetry, coherence, "was any choice argued for") are NOT covered
here on purpose — those need the model. This tool only flags the mechanical ones.

Output is a flag LIST, not a verdict: each hit is a candidate the skill triages.
Some hits are legitimate in context (an "unlock" feature, a mandated system font);
the skill decides. Deterministic in, deterministic out — no network, stdlib only.

Usage:
  detect-slop.py [PATH ...]        # default: current directory
  detect-slop.py --json [PATH ...] # machine-readable
Exit code: 0 = no hits, 1 = hits found (so it can gate a script).
"""

from __future__ import annotations

import json
import os
import re
import sys

SCAN_EXTS = {
    ".css", ".scss", ".sass", ".less",
    ".html", ".htm", ".astro", ".vue", ".svelte",
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
    ".md", ".mdx", ".mdoc", ".json",
}
SKIP_DIRS = {
    "node_modules", ".git", "dist", "build", "target", "out",
    ".next", ".astro", ".svelte-kit", "coverage", "vendor", ".cache",
}

# Slop emoji commonly used as icons / bullets / "delight".
SLOP_EMOJI = "✨🚀🔥🎉💡⚡🌟💪🎯🙌👇🔒🔓📈🎨🧠✅"

# Each rule: (category, compiled regex, fix hint). Rules are intentionally a bit
# broad — false positives are cheap (the skill triages); misses are not.
RULES: list[tuple[str, re.Pattern[str], str]] = [
    # --- Type ---
    ("type/font",
     re.compile(r"""(?ix)
        (?: font-family \s* : [^;{}\n]* | family= | fontFamily \s* [:=] [^;\n]* )
        \b (Inter|Roboto|Open\ Sans|Helvetica\ Neue|Arial|system-ui|Space\ Grotesk) \b
     """),
     "replace with a distinctive display+body pairing (design-frontend Font Requirements)"),
    ("type/gradient-text",
     re.compile(r"(?i)-webkit-background-clip\s*:\s*text|background-clip\s*:\s*text"),
     "gradient text on headings → make it solid; earn impact from size/weight"),

    # --- Color ---
    ("color/pure-neutral",
     re.compile(r"(?i)(?<![0-9a-f])#(?:000|fff|000000|ffffff)(?![0-9a-f])"),
     "pure #000/#fff → near-black/near-white tinted toward the brand hue"),
    ("color/ai-gradient",
     re.compile(r"""(?ix)
        (?:linear|radial|conic)-gradient\( [^)]*
        (?: (purple|violet|indigo) [^)]* (blue|indigo|violet|cyan|teal)
          | (blue|cyan|teal) [^)]* (purple|violet|indigo)
          | \#(?:8b5cf6|7c3aed|6366f1|a855f7|818cf6|4f46e5) )
     """),
     "purple→blue 'AI' gradient → commit to one hue + one sharp accent"),

    # --- Depth / material ---
    ("depth/glassmorphism",
     re.compile(r"(?i)backdrop-filter\s*:\s*[^;]*blur"),
     "glassmorphism → keep blur only for a true overlay; most surfaces need none"),

    # --- Motion ---
    ("motion/animated-layout-prop",
     re.compile(r"(?i)transition\s*:\s*[^;{}\n]*\b(width|height|margin|padding)\b"),
     "animating layout props → transform + opacity only (grid-template-rows for height)"),
    ("motion/bounce-easing",
     re.compile(r"(?i)cubic-bezier\(\s*[^)]*-[0-9.]+[^)]*\)|(?<![a-z])(bounce|elastic)(?:In|Out)?(?![a-z])"),
     "bounce/elastic easing → ease-out quart/quint/expo"),

    # --- Decoration ---
    ("decoration/slop-emoji",
     re.compile("[" + re.escape(SLOP_EMOJI) + "]"),
     "emoji as icon/bullet/'delight' → remove; one real icon set with intent, or nothing"),

    # --- Copy / voice (highest-signal; text betrays the model fastest) ---
    ("copy/empty-verb",
     re.compile(r"(?i)\b(elevate|unlock|supercharge|streamline|revolutioni[sz]e|unleash|"
                r"empower|turbocharge|level up|game[- ]?chang(?:er|ing))\b"),
     "empty power verb → state the concrete action the product performs"),
    ("copy/frictionless-adverb",
     re.compile(r"(?i)\b(seamless(?:ly)?|effortless(?:ly)?|instantly|simply put|"
                r"lightning[- ]fast)\b"),
     "frictionless adverb → cut; let the design show ease"),
    ("copy/setup-phrase",
     re.compile(r"(?i)(in today'?s (?:fast[- ]?paced )?world|say goodbye to|"
                r"whether you'?re a? ?\w+ or a? ?\w+|take your \w+ to the next level|"
                r"meet \w+[.,]|say hello to)"),
     "template opener → open on the reader's specific problem"),
    ("copy/hedged-claim",
     re.compile(r"(?i)\b(powerful yet simple|simple yet powerful|beautiful and functional|"
                r"powerful (?:and|&) (?:simple|intuitive|easy))\b"),
     "hedged both-sides claim → choose the one true emphasis"),
]

# Copy rules only make sense in text-y files (avoid flagging identifiers in code).
COPY_TEXT_EXTS = {".md", ".mdx", ".mdoc", ".html", ".htm", ".astro", ".vue", ".svelte", ".jsx", ".tsx"}


def iter_files(paths: list[str]):
    for p in paths:
        if os.path.isfile(p):
            yield p
            continue
        for root, dirs, files in os.walk(p):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
            for f in files:
                if os.path.splitext(f)[1].lower() in SCAN_EXTS:
                    yield os.path.join(root, f)


def scan(paths: list[str]) -> list[dict]:
    hits: list[dict] = []
    for path in iter_files(paths):
        ext = os.path.splitext(path)[1].lower()
        try:
            with open(path, encoding="utf-8", errors="replace") as fh:
                lines = fh.readlines()
        except OSError:
            continue
        for lineno, line in enumerate(lines, 1):
            for category, rx, hint in RULES:
                if category.startswith("copy/") and ext not in COPY_TEXT_EXTS:
                    continue
                m = rx.search(line)
                if m:
                    hits.append({
                        "file": path, "line": lineno, "category": category,
                        "match": m.group(0).strip()[:80], "fix": hint,
                    })
    return hits


def main(argv: list[str]) -> int:
    as_json = "--json" in argv
    paths = [a for a in argv if not a.startswith("-")] or ["."]
    hits = scan(paths)

    if as_json:
        print(json.dumps({"hits": hits, "count": len(hits)}, indent=2))
        return 1 if hits else 0

    if not hits:
        print("detect-slop: no machine-detectable tells found. "
              "Run the judgment checks (contrast, asymmetry, coherence, 'argued-for') by hand.")
        return 0

    by_cat: dict[str, list[dict]] = {}
    for h in hits:
        by_cat.setdefault(h["category"], []).append(h)

    print(f"detect-slop: {len(hits)} candidate tell(s) across {len(by_cat)} categor(y/ies).")
    print("These are CANDIDATES — triage each; some are legitimate in context.\n")
    for cat in sorted(by_cat):
        group = by_cat[cat]
        print(f"[{cat}]  ({len(group)})  fix: {group[0]['fix']}")
        for h in group[:20]:
            print(f"  {h['file']}:{h['line']}: {h['match']}")
        if len(group) > 20:
            print(f"  … and {len(group) - 20} more")
        print()
    print("Not covered here (need judgment — do these by hand): contrast spread, centered/"
          "symmetric layout, card-nesting, one-direction coherence, and whether ANY choice was "
          "argued for. See SKILL.md.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

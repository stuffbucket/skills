#!/usr/bin/env python3
"""
validate_typography.py — Quantitative typography CSS validator.

Accepts a JSON object on stdin describing a typography scale (CSS custom
properties, weights, line-heights, font choices, and context) and emits a
JSON report on stdout with a score, issues, metrics, and attention items.

Exit codes:
  0  — validation ran successfully (check "valid" in output)
  1  — malformed input or unexpected runtime error

Example usage:

  echo '{
    "tokens": {
      "--text-xs": "0.75rem",
      "--text-sm": "0.875rem",
      "--text-base": "1rem",
      "--text-lg": "1.25rem",
      "--text-xl": "1.5rem",
      "--text-2xl": "2rem",
      "--text-3xl": "2.5rem"
    },
    "weights": {
      "--text-xs": 400,
      "--text-base": 400,
      "--text-lg": 600,
      "--text-2xl": 700
    },
    "line_heights": {
      "--text-xs": 1.4,
      "--text-base": 1.6,
      "--text-lg": 1.3,
      "--text-2xl": 1.1
    },
    "font_primary": "Plus Jakarta Sans",
    "font_secondary": "Source Serif 4",
    "base_px": 16,
    "context": "saas"
  }' | python3 validate_typography.py

  # Or pipe a file:
  python3 validate_typography.py < typography.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from typing import Any

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BANNED_FONTS = {
    "inter",
    "roboto",
    "arial",
    "open sans",
    "helvetica neue",
    "space grotesk",
    "comic sans",
    "comic sans ms",
    "papyrus",
}

# Tokens whose names suggest "heading" sizes.  We treat anything with xl,
# 2xl, 3xl, display, hero, or title in the name as a heading level.
_HEADING_PATTERN = re.compile(
    r"--(text|heading|display|title)-(lg|xl|\d*xl|\d{2,}|display|hero)", re.I
)

# Context-specific minimum body sizes (px).
_MIN_BODY_PX: dict[str, int] = {
    "saas": 14,
    "dashboard": 14,
    "editorial": 16,
    "marketing": 16,
}

_DEFAULT_MIN_BODY_PX = 15  # sensible middle ground for unknown contexts

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_size_to_px(value: str, base_px: float) -> float | None:
    """Convert a CSS size string (rem / px / em) to pixels."""
    value = value.strip().lower()
    m = re.match(r"^([0-9]*\.?[0-9]+)\s*(rem|em|px)$", value)
    if not m:
        return None
    number = float(m.group(1))
    unit = m.group(2)
    if unit in ("rem", "em"):
        return number * base_px
    return number


def _is_heading_token(name: str) -> bool:
    """Heuristic: is this token likely a heading size?"""
    if _HEADING_PATTERN.search(name):
        return True
    lower = name.lower()
    for tag in ("xl", "2xl", "3xl", "4xl", "5xl", "6xl", "display", "hero", "title"):
        if tag in lower:
            return True
    return False


def _median(values: list[float]) -> float:
    s = sorted(values)
    n = len(s)
    if n % 2 == 1:
        return s[n // 2]
    return (s[n // 2 - 1] + s[n // 2]) / 2


# ---------------------------------------------------------------------------
# Core validation
# ---------------------------------------------------------------------------


def validate(data: dict[str, Any]) -> dict[str, Any]:
    """Run all checks and return the report dict."""

    issues: list[dict[str, str]] = []
    attention: list[str] = []

    tokens: dict[str, str] = data.get("tokens", {})
    weights: dict[str, int] = data.get("weights", {})
    line_heights: dict[str, float] = data.get("line_heights", {})
    font_primary: str = data.get("font_primary", "")
    font_secondary: str = data.get("font_secondary", "")
    base_px: float = data.get("base_px", 16)
    context: str = data.get("context", "saas").lower()

    # -- Resolve every token to px ----------------------------------------
    sizes_px: dict[str, float] = {}
    for token, raw in tokens.items():
        px = _parse_size_to_px(raw, base_px)
        if px is None:
            issues.append({
                "severity": "error",
                "property": token,
                "message": f"Could not parse size value '{raw}'.",
                "suggestion": "Use a value like '1rem', '16px', or '1.25em'.",
            })
        else:
            sizes_px[token] = px

    if not sizes_px:
        return {
            "valid": False,
            "score": 0.0,
            "issues": issues,
            "metrics": {},
            "attention_needed": ["No parseable size tokens found."],
        }

    # Sort tokens small-to-large by resolved px value.
    sorted_tokens = sorted(sizes_px.items(), key=lambda kv: kv[1])
    sorted_names = [t[0] for t in sorted_tokens]
    sorted_px = [t[1] for t in sorted_tokens]

    # -- Metrics ----------------------------------------------------------
    min_size_px = sorted_px[0]
    max_size_px = sorted_px[-1]
    levels_count = len(sorted_px)

    # Adjacent ratios
    ratios: list[float] = []
    for i in range(1, len(sorted_px)):
        if sorted_px[i - 1] > 0:
            ratios.append(sorted_px[i] / sorted_px[i - 1])

    if ratios:
        median_ratio = _median(ratios)
        # Scale consistency: how close each ratio is to the median ratio.
        deviations = [abs(r - median_ratio) / median_ratio for r in ratios]
        scale_consistency = max(0.0, 1.0 - (sum(deviations) / len(deviations)))
    else:
        median_ratio = 1.0
        scale_consistency = 1.0

    # Identify body & heading tokens
    base_token = None
    base_size_px = base_px  # fallback
    for name, px in sorted_tokens:
        if "base" in name.lower():
            base_token = name
            base_size_px = px
            break
    if base_token is None:
        # Pick the token closest to base_px
        base_token = min(sizes_px, key=lambda k: abs(sizes_px[k] - base_px))
        base_size_px = sizes_px[base_token]

    heading_body_ratio = max_size_px / base_size_px if base_size_px > 0 else 0

    # Weight range
    weight_values = list(weights.values()) if weights else []
    weight_range = (max(weight_values) - min(weight_values)) if len(weight_values) >= 2 else 0

    # Line-height range
    lh_values = list(line_heights.values()) if line_heights else []
    lh_range = [min(lh_values), max(lh_values)] if lh_values else [0, 0]

    metrics = {
        "scale_ratio": round(median_ratio, 4),
        "scale_consistency": round(scale_consistency, 4),
        "min_size_px": round(min_size_px, 2),
        "max_size_px": round(max_size_px, 2),
        "heading_body_ratio": round(heading_body_ratio, 4),
        "weight_range": weight_range,
        "line_height_range": [round(v, 3) for v in lh_range],
        "levels_count": levels_count,
    }

    # =====================================================================
    # Checks
    # =====================================================================

    penalty = 0.0  # accumulated score penalty (subtracted from 1.0)

    # 1. Scale consistency --------------------------------------------------
    if len(ratios) >= 2:
        for i, r in enumerate(ratios):
            deviation = abs(r - median_ratio) / median_ratio
            if deviation > 0.15:
                prev_name = sorted_names[i]
                curr_name = sorted_names[i + 1]
                attention.append(
                    f"The jump from {prev_name} to {curr_name} is "
                    f"{r:.3g}x but the median scale ratio is {median_ratio:.3g}x. "
                    f"This may be intentional for your context, or it may be a "
                    f"gap worth evening out."
                )
                penalty += 0.02
            elif deviation > 0.08:
                prev_name = sorted_names[i]
                curr_name = sorted_names[i + 1]
                issues.append({
                    "severity": "info",
                    "property": curr_name,
                    "message": (
                        f"Ratio {prev_name} -> {curr_name} is {r:.3g}x vs "
                        f"median {median_ratio:.3g}x (deviation {deviation:.0%})."
                    ),
                    "suggestion": "Minor inconsistency -- likely fine, but review if unintended.",
                })

    # 2. Minimum size -------------------------------------------------------
    for name, px in sorted_tokens:
        if px < 11:
            issues.append({
                "severity": "error",
                "property": name,
                "message": f"Size is {px:.1f}px -- below the 11px hard floor.",
                "suggestion": "Increase to at least 12px (0.75rem at 16px base).",
            })
            penalty += 0.15
        elif px < 12:
            issues.append({
                "severity": "warning",
                "property": name,
                "message": f"Size is {px:.1f}px -- below 12px. May be unreadable at some resolutions.",
                "suggestion": "Consider raising to 12px (0.75rem at 16px base).",
            })
            penalty += 0.05

    # 3. Body size for context -----------------------------------------------
    min_body_for_context = _MIN_BODY_PX.get(context, _DEFAULT_MIN_BODY_PX)
    if base_size_px < min_body_for_context:
        issues.append({
            "severity": "warning",
            "property": base_token,
            "message": (
                f"Body size is {base_size_px:.1f}px but the recommended "
                f"minimum for '{context}' context is {min_body_for_context}px."
            ),
            "suggestion": f"Increase base size to at least {min_body_for_context}px.",
        })
        penalty += 0.08

    # 4. Heading / body ratio ------------------------------------------------
    if heading_body_ratio < 1.5:
        issues.append({
            "severity": "warning",
            "property": sorted_names[-1],
            "message": (
                f"Largest heading ({max_size_px:.1f}px) is only "
                f"{heading_body_ratio:.2f}x the body size -- the scale may feel flat."
            ),
            "suggestion": "Consider increasing the largest heading for more visual hierarchy.",
        })
        penalty += 0.08
    elif heading_body_ratio > 6:
        issues.append({
            "severity": "warning",
            "property": sorted_names[-1],
            "message": (
                f"Largest heading ({max_size_px:.1f}px) is "
                f"{heading_body_ratio:.2f}x the body size -- quite extreme."
            ),
            "suggestion": "Verify this range is intentional. Most contexts work well at 2x-5x.",
        })
        penalty += 0.06
        attention.append(
            f"Heading-to-body ratio is {heading_body_ratio:.2f}x. "
            f"This is uncommon -- make sure the largest size has a clear use case."
        )

    # 5. Weight contrast -----------------------------------------------------
    heading_weights = [w for tok, w in weights.items() if _is_heading_token(tok)]
    body_weights = [w for tok, w in weights.items() if not _is_heading_token(tok)]
    if heading_weights and body_weights:
        max_heading_w = max(heading_weights)
        min_body_w = min(body_weights)
        diff = max_heading_w - min_body_w
        if diff < 200:
            issues.append({
                "severity": "warning",
                "property": "weights",
                "message": (
                    f"Heading/body weight contrast is only {diff} "
                    f"(heading max {max_heading_w}, body min {min_body_w}). "
                    f"Headings may not stand out enough."
                ),
                "suggestion": "Aim for at least 200 weight difference (e.g. 400 body / 600 heading).",
            })
            penalty += 0.06
    elif not weights:
        issues.append({
            "severity": "info",
            "property": "weights",
            "message": "No weight information provided -- unable to check weight contrast.",
            "suggestion": "Consider supplying a weights map for richer validation.",
        })

    # 6. Line height ---------------------------------------------------------
    for tok, lh in line_heights.items():
        is_heading = _is_heading_token(tok)
        if is_heading:
            if lh > 1.4:
                issues.append({
                    "severity": "warning",
                    "property": tok,
                    "message": (
                        f"Heading line-height is {lh} -- above 1.4 is often too loose for headings."
                    ),
                    "suggestion": "Heading line-heights of 1.0-1.3 usually feel tighter and more polished.",
                })
                penalty += 0.03
        else:
            if lh < 1.4:
                issues.append({
                    "severity": "warning",
                    "property": tok,
                    "message": (
                        f"Body line-height is {lh} -- below 1.4 can hurt readability."
                    ),
                    "suggestion": "Body text usually works best at 1.4-1.75.",
                })
                penalty += 0.04
            elif lh > 2.0:
                issues.append({
                    "severity": "warning",
                    "property": tok,
                    "message": (
                        f"Body line-height is {lh} -- above 2.0 may feel too spacious."
                    ),
                    "suggestion": "Consider bringing it down to 1.5-1.8 for a tighter feel.",
                })
                penalty += 0.02

    # 7. Level count ---------------------------------------------------------
    if levels_count > 8:
        issues.append({
            "severity": "info",
            "property": "tokens",
            "message": (
                f"Scale has {levels_count} levels -- more than 8 is unusual "
                f"and may be hard to use consistently."
            ),
            "suggestion": "Consider whether every level has a distinct role in the design system.",
        })
        penalty += 0.02
        attention.append(
            f"{levels_count} type levels is a lot. Review whether each level has "
            f"a clear, distinct purpose -- collapsing a level or two often simplifies usage."
        )
    elif levels_count < 4:
        issues.append({
            "severity": "info",
            "property": "tokens",
            "message": f"Scale has only {levels_count} levels -- you might need more for a full UI.",
            "suggestion": "Most design systems use 5-8 levels (xs through 3xl or similar).",
        })
        penalty += 0.01

    # 8. Banned fonts --------------------------------------------------------
    for label, font_name in [("font_primary", font_primary), ("font_secondary", font_secondary)]:
        if not font_name:
            continue
        if font_name.strip().lower() in BANNED_FONTS:
            issues.append({
                "severity": "error",
                "property": label,
                "message": f"'{font_name}' is on the banned list.",
                "suggestion": "Choose a more distinctive typeface. See Google Fonts for alternatives.",
            })
            penalty += 0.20

    # 9. Context-specific checks --------------------------------------------
    if context == "editorial":
        body_lh = line_heights.get(base_token)
        if body_lh is not None and body_lh < 1.5:
            attention.append(
                f"Editorial context typically benefits from a body line-height "
                f"of 1.5 or more for long-form reading comfort (currently {body_lh})."
            )
        if font_secondary and not font_primary:
            attention.append(
                "For editorial contexts, having a strong primary typeface matters. "
                "Consider whether the primary font supports the reading experience."
            )
    elif context == "dashboard":
        if heading_body_ratio > 4:
            attention.append(
                f"Dashboard context usually favours compact type scales. "
                f"A heading/body ratio of {heading_body_ratio:.2f}x is on the large side."
            )
        xs_tokens = [t for t in sorted_tokens if "xs" in t[0].lower() or "sm" in t[0].lower()]
        for tok_name, tok_px in xs_tokens:
            if tok_px < 12.5:
                attention.append(
                    f"In a dashboard, '{tok_name}' at {tok_px:.1f}px will appear in "
                    f"dense data views -- make sure it remains legible on low-DPI screens."
                )
    elif context == "marketing":
        if heading_body_ratio < 2.0:
            attention.append(
                f"Marketing pages often benefit from more dramatic heading sizes. "
                f"A heading/body ratio of {heading_body_ratio:.2f}x may feel understated."
            )

    # =====================================================================
    # Score
    # =====================================================================
    has_errors = any(i["severity"] == "error" for i in issues)
    score = max(0.0, min(1.0, 1.0 - penalty))
    valid = not has_errors

    return {
        "valid": valid,
        "score": round(score, 3),
        "issues": issues,
        "metrics": metrics,
        "attention_needed": attention,
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

_HELP_EPILOG = """\
examples:
  # Validate from a JSON file:
  python3 validate_typography.py < my_scale.json

  # Pipe from another command:
  generate_scale --preset modern | python3 validate_typography.py

  # Quick inline test:
  echo '{"tokens":{"--text-base":"1rem","--text-lg":"1.5rem"},"base_px":16}' \\
    | python3 validate_typography.py

input shape (all fields optional except tokens):
  {
    "tokens":        { "--text-base": "1rem", ... },
    "weights":       { "--text-base": 400, ... },
    "line_heights":  { "--text-base": 1.6, ... },
    "font_primary":  "Plus Jakarta Sans",
    "font_secondary": "Source Serif 4",
    "base_px":       16,
    "context":       "saas"   // saas | editorial | marketing | dashboard
  }
"""


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="validate_typography",
        description=(
            "Quantitative typography CSS validator. "
            "Reads JSON on stdin, writes a report to stdout."
        ),
        epilog=_HELP_EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    # No positional args -- everything comes from stdin.
    parser.parse_args()

    raw = sys.stdin.read()
    if not raw.strip():
        print(
            json.dumps({"error": "No input provided on stdin. Pipe a JSON object."}),
            file=sys.stderr,
        )
        sys.exit(1)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(json.dumps({"error": f"Invalid JSON: {exc}"}), file=sys.stderr)
        sys.exit(1)

    if not isinstance(data, dict):
        print(
            json.dumps({"error": "Input must be a JSON object (dict)."}),
            file=sys.stderr,
        )
        sys.exit(1)

    report = validate(data)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

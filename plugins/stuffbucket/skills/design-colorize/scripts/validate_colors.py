#!/usr/bin/env python3
"""
validate_colors.py — Quantitative palette validator (WCAG + APCA + light/dark).

Accepts a JSON palette on stdin and emits a JSON report on stdout. Checks:

  1. WCAG 2.1 contrast ratios for every declared text/background pairing
     (AA: 4.5:1 for body text, 3:1 for large text and UI).
  2. APCA Lc values (the perceptually-tuned successor to WCAG 2 contrast).
  3. Light/dark mode consistency — same token set in both, contrast holds
     in both, luminance polarity inverts as expected.
  4. Color-alone signaling risk — flags semantic colors that are too close
     in hue or luminance to be distinguishable without icons/labels.

Stdlib-only (math, re, json, argparse).

Example:

  echo '{
    "light": {
      "background": "#ffffff",
      "surface-1": "oklch(0.97 0.005 250)",
      "text-primary": "#111827",
      "text-secondary": "#6b7280",
      "accent-primary": "oklch(0.55 0.18 250)",
      "success": "oklch(0.55 0.16 155)",
      "warning": "oklch(0.72 0.16 75)",
      "error":   "oklch(0.55 0.20 25)"
    },
    "dark": {
      "background": "#0a0a0a",
      "surface-1": "#1a1a1a",
      "text-primary": "#f5f5f5",
      "text-secondary": "#a1a1aa",
      "accent-primary": "oklch(0.72 0.18 250)",
      "success": "oklch(0.72 0.16 155)",
      "warning": "oklch(0.82 0.16 75)",
      "error":   "oklch(0.70 0.20 25)"
    },
    "text_pairs": [
      ["text-primary", "background"],
      ["text-primary", "surface-1"],
      ["text-secondary", "background"]
    ],
    "ui_pairs":   [["accent-primary", "background"]],
    "semantic":   ["success", "warning", "error"]
  }' | python3 validate_colors.py
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from typing import Any

# ---------------------------------------------------------------------------
# Color parsing
# ---------------------------------------------------------------------------

_HEX_RE = re.compile(r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
_RGB_RE = re.compile(
    r"^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+[\d.]+%?)?\s*\)$"
)
_OKLCH_RE = re.compile(
    r"^oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+)(?:\s*/\s*[\d.]+%?)?\s*\)$"
)


def parse_color(value: str) -> tuple[float, float, float] | None:
    """Parse a CSS color value into linear 0-1 sRGB.

    Returns None if the value cannot be parsed.
    """
    s = value.strip().lower()

    if m := _HEX_RE.match(s):
        h = m.group(1)
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        return (r / 255.0, g / 255.0, b / 255.0)

    if m := _RGB_RE.match(s):
        r, g, b = (float(m.group(i)) for i in (1, 2, 3))
        if max(r, g, b) > 1.0:
            return (r / 255.0, g / 255.0, b / 255.0)
        return (r, g, b)

    if m := _OKLCH_RE.match(s):
        l_raw = m.group(1)
        c_raw = m.group(2)
        h = float(m.group(3))
        l = float(l_raw.rstrip("%"))
        c = float(c_raw.rstrip("%"))
        if l_raw.endswith("%"):
            l /= 100.0
        if c_raw.endswith("%"):
            c = c * 0.4 / 100.0
        return oklch_to_srgb(l, c, h)

    return None


# ---------------------------------------------------------------------------
# OKLCH → sRGB (per https://bottosson.github.io/posts/oklab/)
# ---------------------------------------------------------------------------


def oklch_to_srgb(L: float, C: float, H: float) -> tuple[float, float, float]:
    h_rad = math.radians(H)
    a = C * math.cos(h_rad)
    b = C * math.sin(h_rad)

    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b

    l3 = l_ ** 3
    m3 = m_ ** 3
    s3 = s_ ** 3

    r_lin = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
    g_lin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
    b_lin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3

    return (_linear_to_srgb(r_lin), _linear_to_srgb(g_lin), _linear_to_srgb(b_lin))


def _linear_to_srgb(x: float) -> float:
    x = max(0.0, min(1.0, x))
    if x <= 0.0031308:
        return 12.92 * x
    return 1.055 * (x ** (1.0 / 2.4)) - 0.055


# ---------------------------------------------------------------------------
# Luminance + contrast metrics
# ---------------------------------------------------------------------------


def _srgb_to_linear(c: float) -> float:
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def wcag_luminance(rgb: tuple[float, float, float]) -> float:
    r, g, b = (_srgb_to_linear(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def wcag_contrast(
    fg: tuple[float, float, float], bg: tuple[float, float, float]
) -> float:
    l_fg = wcag_luminance(fg)
    l_bg = wcag_luminance(bg)
    lighter, darker = max(l_fg, l_bg), min(l_fg, l_bg)
    return (lighter + 0.05) / (darker + 0.05)


def _apca_y(rgb: tuple[float, float, float]) -> float:
    # APCA uses a simple 2.4 power weighted sum — not the WCAG linearization.
    r, g, b = rgb
    return 0.2126729 * r ** 2.4 + 0.7151522 * g ** 2.4 + 0.0721750 * b ** 2.4


def apca_lc(
    text_rgb: tuple[float, float, float], bg_rgb: tuple[float, float, float]
) -> float:
    """Return APCA Lc (signed). |Lc| is the contrast magnitude."""
    ytxt = _apca_y(text_rgb)
    ybg = _apca_y(bg_rgb)

    # Soft-clamp very dark values (APCA uses 0.022 as the black-threshold).
    ytxt = ytxt if ytxt >= 0.022 else ytxt + (0.022 - ytxt) ** 1.414
    ybg = ybg if ybg >= 0.022 else ybg + (0.022 - ybg) ** 1.414

    if ybg > ytxt:  # dark text on light bg
        sapc = (ybg ** 0.56 - ytxt ** 0.57) * 1.14
    else:  # light text on dark bg
        sapc = (ybg ** 0.65 - ytxt ** 0.62) * 1.14

    if abs(sapc) < 0.1:
        return 0.0
    lc = sapc * 100.0
    return lc - 2.7 if lc > 0 else lc + 2.7


# ---------------------------------------------------------------------------
# Perceptual distance (ΔH, ΔL) — for semantic-color discriminability
# ---------------------------------------------------------------------------


def srgb_to_oklch(rgb: tuple[float, float, float]) -> tuple[float, float, float]:
    r_lin, g_lin, b_lin = (_srgb_to_linear(c) for c in rgb)
    l = 0.4122214708 * r_lin + 0.5363325363 * g_lin + 0.0514459929 * b_lin
    m = 0.2119034982 * r_lin + 0.6806995451 * g_lin + 0.1073969566 * b_lin
    s = 0.0883024619 * r_lin + 0.2817188376 * g_lin + 0.6299787005 * b_lin

    l_ = l ** (1 / 3) if l >= 0 else -((-l) ** (1 / 3))
    m_ = m ** (1 / 3) if m >= 0 else -((-m) ** (1 / 3))
    s_ = s ** (1 / 3) if s >= 0 else -((-s) ** (1 / 3))

    L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    b_ok = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_

    C = math.hypot(a, b_ok)
    H = math.degrees(math.atan2(b_ok, a)) % 360.0
    return (L, C, H)


def hue_distance(h1: float, h2: float) -> float:
    d = abs(h1 - h2) % 360.0
    return min(d, 360.0 - d)


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


AA_NORMAL = 4.5
AA_LARGE_OR_UI = 3.0
APCA_BODY_MIN = 60.0
APCA_UI_MIN = 45.0

# Hue label → expected OKLCH hue range (inclusive). Keep in sync with
# references/hue-angles.md.
HUE_LABEL_RANGES: dict[str, tuple[float, float]] = {
    # Blue family
    "trust blue": (250, 268),
    "trustworthy blue": (250, 268),
    "corporate blue": (250, 268),
    "calming blue": (250, 268),
    "financial blue": (250, 268),
    "fresh blue": (225, 250),
    "consumer blue": (225, 250),
    "social blue": (225, 250),
    "cyan": (200, 225),
    "tech blue": (200, 225),
    "azure": (200, 225),
    "medical blue": (200, 225),
    # Indigo / violet
    "indigo": (268, 285),
    "premium blue": (268, 285),
    "blurple": (268, 285),
    "violet": (285, 310),
    "purple": (285, 310),
    "luxury purple": (285, 310),
    # Green family
    "success green": (140, 165),
    "brand green": (130, 165),
    "nature green": (140, 165),
    "growth green": (130, 165),
    "wellness green": (150, 175),
    "lime": (110, 140),
    # Teal family
    "teal": (170, 200),
    "medical teal": (170, 200),
    # Warm
    "amber": (60, 85),
    "warning amber": (60, 85),
    "gold": (70, 90),
    "orange": (35, 65),
    "coral": (15, 35),
    "red": (15, 30),
    "error red": (15, 30),
    "warm red": (15, 30),
    "pink": (330, 360),
    "magenta": (310, 340),
}

# Minimum required token categories for a production palette. Each entry
# is (display_name, match_predicates) — a token matches if any predicate
# is a substring of the token's lowercased name.
REQUIRED_CATEGORIES: list[tuple[str, tuple[str, ...]]] = [
    ("background / base surface", ("background", "bg-base", "canvas")),
    ("elevated surface", ("surface", "card", "panel")),
    ("primary text", ("text-primary", "text-1", "text-default", "body-text")),
    ("secondary text", ("text-secondary", "text-2", "text-muted")),
    ("border / divider", ("border", "divider", "rule")),
    ("primary / brand accent", ("primary", "brand", "accent")),
]

# Neutral scale stops we expect if ANY numeric neutral tokens are present.
EXPECTED_SCALE_STOPS = (50, 100, 200, 300, 400, 500, 600, 700, 800, 900)


def _resolve_palette(
    palette: dict[str, str], issues: list[dict[str, str]], mode: str
) -> dict[str, tuple[float, float, float]]:
    resolved: dict[str, tuple[float, float, float]] = {}
    for name, value in palette.items():
        rgb = parse_color(value)
        if rgb is None:
            issues.append({
                "severity": "error",
                "mode": mode,
                "token": name,
                "message": f"Could not parse color value '{value}'.",
                "suggestion": "Use hex (#rrggbb), rgb(r g b), or oklch(L C H).",
            })
            continue
        resolved[name] = rgb
    return resolved


def _check_pair(
    resolved: dict[str, tuple[float, float, float]],
    fg_name: str,
    bg_name: str,
    mode: str,
    kind: str,
    issues: list[dict[str, str]],
    metrics: list[dict[str, Any]],
) -> None:
    fg = resolved.get(fg_name)
    bg = resolved.get(bg_name)
    if fg is None or bg is None:
        issues.append({
            "severity": "error",
            "mode": mode,
            "pair": f"{fg_name} on {bg_name}",
            "message": "Referenced token missing or unparseable.",
            "suggestion": f"Declare '{fg_name}' and '{bg_name}' in the '{mode}' palette.",
        })
        return

    ratio = wcag_contrast(fg, bg)
    lc = apca_lc(fg, bg)
    wcag_threshold = AA_NORMAL if kind == "text" else AA_LARGE_OR_UI
    apca_threshold = APCA_BODY_MIN if kind == "text" else APCA_UI_MIN

    metrics.append({
        "mode": mode,
        "pair": f"{fg_name} on {bg_name}",
        "kind": kind,
        "wcag_ratio": round(ratio, 2),
        "apca_lc": round(lc, 1),
        "wcag_pass_aa": ratio >= wcag_threshold,
        "apca_pass": abs(lc) >= apca_threshold,
    })

    if ratio < wcag_threshold:
        issues.append({
            "severity": "error",
            "mode": mode,
            "pair": f"{fg_name} on {bg_name}",
            "message": (
                f"WCAG contrast {ratio:.2f}:1 (need ≥{wcag_threshold}:1 for {kind})."
            ),
            "suggestion": _contrast_suggestion(fg_name, bg_name, fg, bg, ratio, wcag_threshold),
        })

    if abs(lc) < apca_threshold:
        issues.append({
            "severity": "warning",
            "mode": mode,
            "pair": f"{fg_name} on {bg_name}",
            "message": (
                f"APCA Lc {lc:.1f} (need ≥{apca_threshold} for {kind})."
            ),
            "suggestion": (
                "APCA models perceptual readability; adjust lightness of the "
                "text token to widen separation from the background."
            ),
        })


def _contrast_suggestion(
    fg_name: str,
    bg_name: str,
    fg: tuple[float, float, float],
    bg: tuple[float, float, float],
    ratio: float,
    needed: float,
) -> str:
    fg_l = srgb_to_oklch(fg)[0]
    bg_l = srgb_to_oklch(bg)[0]
    if fg_l < bg_l:
        return (
            f"Darken '{fg_name}' (currently OKLCH L={fg_l:.2f}) or lighten "
            f"'{bg_name}' (L={bg_l:.2f}) until contrast reaches {needed}:1."
        )
    return (
        f"Lighten '{fg_name}' (currently OKLCH L={fg_l:.2f}) or darken "
        f"'{bg_name}' (L={bg_l:.2f}) until contrast reaches {needed}:1."
    )


def _check_light_dark_consistency(
    light: dict[str, tuple[float, float, float]],
    dark: dict[str, tuple[float, float, float]],
    issues: list[dict[str, str]],
    attention: list[str],
) -> None:
    light_keys = set(light)
    dark_keys = set(dark)
    missing_in_dark = sorted(light_keys - dark_keys)
    missing_in_light = sorted(dark_keys - light_keys)
    if missing_in_dark:
        issues.append({
            "severity": "error",
            "scope": "light/dark",
            "message": (
                f"Tokens present in light but missing in dark: {', '.join(missing_in_dark)}"
            ),
            "suggestion": "Both palettes must share the same token keys.",
        })
    if missing_in_light:
        issues.append({
            "severity": "error",
            "scope": "light/dark",
            "message": (
                f"Tokens present in dark but missing in light: {', '.join(missing_in_light)}"
            ),
            "suggestion": "Both palettes must share the same token keys.",
        })

    # For any background/surface token, lightness should invert between modes.
    for token in sorted(light_keys & dark_keys):
        if not _looks_like_surface(token):
            continue
        l_light = srgb_to_oklch(light[token])[0]
        l_dark = srgb_to_oklch(dark[token])[0]
        if l_light < 0.5 and l_dark < 0.5:
            attention.append(
                f"Surface token '{token}' is dark in both modes "
                f"(L={l_light:.2f} light, L={l_dark:.2f} dark) — expected inversion."
            )
        elif l_light > 0.5 and l_dark > 0.5:
            attention.append(
                f"Surface token '{token}' is light in both modes "
                f"(L={l_light:.2f} light, L={l_dark:.2f} dark) — expected inversion."
            )


def _looks_like_surface(token: str) -> bool:
    t = token.lower()
    return any(k in t for k in ("background", "surface", "card", "canvas", "nav", "sidebar"))


def _check_semantic_discriminability(
    resolved: dict[str, tuple[float, float, float]],
    semantic: list[str],
    mode: str,
    issues: list[dict[str, str]],
    attention: list[str],
) -> None:
    points = []
    for name in semantic:
        rgb = resolved.get(name)
        if rgb is None:
            continue
        points.append((name, srgb_to_oklch(rgb)))

    if len(points) < 2:
        return

    # Deuteranopia/protanopia collapses the red/green channel. When two
    # semantic colors cross the red↔green axis (roughly H=25° vs H=155°)
    # they can look identical if both luminance and chroma match. The
    # thresholds below come from hue-angles.md's semantic-triad rules:
    # minimum 60° hue separation OR minimum 0.10 luminance delta.
    for i in range(len(points)):
        for j in range(i + 1, len(points)):
            (n1, (l1, c1, h1)) = points[i]
            (n2, (l2, c2, h2)) = points[j]
            d_hue = hue_distance(h1, h2)
            d_L = abs(l1 - l2)
            if c1 < 0.03 and c2 < 0.03:
                continue

            # Both axes tight — almost certainly indistinguishable.
            if d_hue < 40 and d_L < 0.06:
                issues.append({
                    "severity": "error",
                    "mode": mode,
                    "pair": f"{n1} vs {n2}",
                    "message": (
                        f"Semantic colors too similar — Δhue {d_hue:.0f}°, "
                        f"ΔL {d_L:.2f}. Indistinguishable under color blindness."
                    ),
                    "suggestion": (
                        "Widen hue separation to ≥60° AND/OR luminance "
                        "separation to ≥0.10."
                    ),
                })
                continue

            # One axis tight — warn so the model compensates on the other.
            if d_hue < 60 and d_L < 0.10:
                issues.append({
                    "severity": "warning",
                    "mode": mode,
                    "pair": f"{n1} vs {n2}",
                    "message": (
                        f"Semantic colors rely on a single axis to differ "
                        f"— Δhue {d_hue:.0f}°, ΔL {d_L:.2f}."
                    ),
                    "suggestion": (
                        "For safer red-green colorblind behavior, target "
                        "Δhue ≥60° AND ΔL ≥0.10 between adjacent semantics."
                    ),
                })

    # Specific red-green collision check for success/error
    red_green_pairs = [
        (n1, n2, p1, p2)
        for (n1, p1) in points
        for (n2, p2) in points
        if n1 != n2
        and ("success" in n1.lower() or "green" in n1.lower() or 130 <= p1[2] <= 170)
        and ("error" in n2.lower() or "red" in n2.lower() or p2[2] <= 30 or p2[2] >= 340)
    ]
    seen: set[tuple[str, str]] = set()
    for n1, n2, (l1, _, _), (l2, _, _) in red_green_pairs:
        key = tuple(sorted((n1, n2)))
        if key in seen:
            continue
        seen.add(key)
        if abs(l1 - l2) < 0.10:
            issues.append({
                "severity": "warning",
                "mode": mode,
                "pair": f"{n1} vs {n2}",
                "message": (
                    f"Success (green) and error (red) share near-identical "
                    f"luminance ({l1:.2f} vs {l2:.2f}). Deuteranope/"
                    f"protanope users will see near-identical grays."
                ),
                "suggestion": (
                    "Shift one token's L by ≥0.10 (e.g., success L=0.55, "
                    "error L=0.45) so luminance distinguishes them when "
                    "hue channel collapses."
                ),
            })

    attention.append(
        f"Semantic colors defined ({', '.join(semantic)}). Pair every status "
        f"with an icon or text label — never convey status by color alone."
    )


def _check_claimed_hue_label(
    resolved: dict[str, tuple[float, float, float]],
    primary_token: str,
    claimed_label: str,
    mode: str,
    issues: list[dict[str, str]],
) -> None:
    rgb = resolved.get(primary_token)
    if rgb is None:
        return
    key = claimed_label.strip().lower()
    if key not in HUE_LABEL_RANGES:
        return
    low, high = HUE_LABEL_RANGES[key]
    actual_hue = srgb_to_oklch(rgb)[2]
    if low <= actual_hue <= high:
        return
    # Offer the canonical center of the claimed range as a remedy.
    canonical_center = (low + high) / 2
    issues.append({
        "severity": "error",
        "mode": mode,
        "token": primary_token,
        "message": (
            f"'{primary_token}' hue is {actual_hue:.0f}°, outside the "
            f"canonical range for '{claimed_label}' ({low}–{high}°)."
        ),
        "suggestion": (
            f"Shift hue toward {canonical_center:.0f}° to match the claim, "
            f"or rename the label — see references/hue-angles.md."
        ),
    })


def _check_scale_completeness(
    palette: dict[str, str],
    mode: str,
    issues: list[dict[str, str]],
) -> None:
    # Group numeric-stop tokens by prefix: --neutral-50, --neutral-500 → "neutral".
    prefix_to_stops: dict[str, set[int]] = {}
    for name in palette:
        m = re.match(r"^(?:-{0,2})([a-z][a-z\-]*?)-(\d{2,3})$", name)
        if not m:
            continue
        prefix, stop = m.group(1), int(m.group(2))
        if stop not in EXPECTED_SCALE_STOPS:
            continue
        prefix_to_stops.setdefault(prefix, set()).add(stop)

    for prefix, present in prefix_to_stops.items():
        if len(present) < 3:
            continue  # not a real scale, just one or two named tokens
        missing = [s for s in EXPECTED_SCALE_STOPS if s not in present]
        if missing:
            issues.append({
                "severity": "warning",
                "mode": mode,
                "token": f"{prefix} scale",
                "message": (
                    f"'{prefix}' scale is missing stops: "
                    f"{', '.join(str(s) for s in missing)}."
                ),
                "suggestion": (
                    "Provide all 9 stops (50/100/200/300/400/500/600/700/"
                    "800/900) so the scale is usable across backgrounds, "
                    "borders, and text hierarchies."
                ),
            })


def _check_required_tokens(
    light: dict[str, tuple[float, float, float]],
    attention: list[str],
) -> None:
    all_names = " ".join(light).lower()
    missing = []
    for display, predicates in REQUIRED_CATEGORIES:
        if not any(p in all_names for p in predicates):
            missing.append(display)
    if missing:
        attention.append(
            "Palette missing tokens for: "
            + ", ".join(missing)
            + ". A production palette needs all of these roles covered."
        )


def validate(data: dict[str, Any]) -> dict[str, Any]:
    issues: list[dict[str, str]] = []
    attention: list[str] = []
    metrics: list[dict[str, Any]] = []

    light_raw = data.get("light")
    dark_raw = data.get("dark")
    text_pairs = data.get("text_pairs", [])
    ui_pairs = data.get("ui_pairs", [])
    semantic = data.get("semantic", [])
    primary_token = data.get("primary_token", "primary")
    claimed_hue_label = data.get("claimed_hue_label")

    if not isinstance(light_raw, dict) or not isinstance(dark_raw, dict):
        return {
            "valid": False,
            "score": 0.0,
            "issues": [{
                "severity": "error",
                "message": "Input must include 'light' and 'dark' palette objects.",
                "suggestion": "Provide both modes as {token: color-value} dicts.",
            }],
            "metrics": [],
            "attention_needed": [],
        }

    light = _resolve_palette(light_raw, issues, "light")
    dark = _resolve_palette(dark_raw, issues, "dark")

    for fg, bg in text_pairs:
        _check_pair(light, fg, bg, "light", "text", issues, metrics)
        _check_pair(dark, fg, bg, "dark", "text", issues, metrics)

    for fg, bg in ui_pairs:
        _check_pair(light, fg, bg, "light", "ui", issues, metrics)
        _check_pair(dark, fg, bg, "dark", "ui", issues, metrics)

    _check_light_dark_consistency(light, dark, issues, attention)

    _check_scale_completeness(light_raw, "light", issues)
    _check_scale_completeness(dark_raw, "dark", issues)

    _check_required_tokens(light, attention)

    if claimed_hue_label:
        _check_claimed_hue_label(light, primary_token, claimed_hue_label, "light", issues)
        _check_claimed_hue_label(dark, primary_token, claimed_hue_label, "dark", issues)

    if semantic:
        _check_semantic_discriminability(light, semantic, "light", issues, attention)
        _check_semantic_discriminability(dark, semantic, "dark", issues, attention)
        # Dedupe: the semantic-label reminder is identical per mode.
        attention = list(dict.fromkeys(attention))

    # Scoring: fraction of WCAG-text pairs passing, penalized by errors.
    text_metrics = [m for m in metrics if m["kind"] == "text"]
    pass_frac = (
        sum(1 for m in text_metrics if m["wcag_pass_aa"]) / len(text_metrics)
        if text_metrics else 1.0
    )
    error_count = sum(1 for i in issues if i.get("severity") == "error")
    penalty = min(0.3, 0.05 * error_count)
    score = max(0.0, round(pass_frac - penalty, 3))
    valid = error_count == 0

    return {
        "valid": valid,
        "score": score,
        "issues": issues,
        "metrics": metrics,
        "attention_needed": attention,
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

_HELP_EPILOG = """\
input shape:
  {
    "light": { token: color, ... },     // required
    "dark":  { token: color, ... },     // required
    "text_pairs": [[fg, bg], ...],      // WCAG AA 4.5:1, APCA Lc ≥60
    "ui_pairs":   [[fg, bg], ...],      // WCAG AA 3.0:1,  APCA Lc ≥45
    "semantic":   ["success", "error", "warning", ...],
    "primary_token":      "primary",    // which token is the brand primary
    "claimed_hue_label":  "trust blue"  // validated against hue-angles.md
  }

color values:
  #rrggbb | #rgb | rgb(r g b) | oklch(L C H)

checks performed:
  • WCAG 2.1 + APCA contrast for every declared pair
  • Light/dark polarity inversion for surface tokens
  • Scale completeness (missing stops in numeric scales like 50/100/.../900)
  • Semantic discriminability (Δhue ≥60° AND/OR ΔL ≥0.10)
  • Red/green collision (same-luminance success vs error)
  • Claimed hue-label vs actual OKLCH hue (uses references/hue-angles.md)
  • Required token coverage (background, surface, text, border, primary)
"""


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="validate_colors",
        description=(
            "Quantitative palette validator: WCAG 2.1 + APCA + light/dark "
            "consistency + semantic discriminability. Reads JSON on stdin."
        ),
        epilog=_HELP_EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
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

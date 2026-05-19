# OKLCH Hue Angles — Canonical Ranges and Brand Anchors

When a user asks for a "calming blue" or "trustworthy blue" or "energetic
orange", the correct hue is not negotiable. Each color family lives in a
specific arc of the OKLCH hue circle. Picking the wrong arc makes the
brand claim false: a "calming blue" at hue 220° is actually cyan/azure
and reads as "medical device," not "trustworthy human brand."

Always verify the hue matches the claim. Use this reference when proposing
a primary color, and pass the claimed label into
`scripts/validate_colors.py` via `claimed_hue_label` to get an automated
check.

## Hue → Category Map (OKLCH)

| Hue arc | Category | Mood / connotation | Typical uses |
| ------- | -------- | ------------------ | ------------ |
| 0–15° | Red-pink | Bold, passionate, urgent | Error states, bold brands |
| 15–35° | Red-orange / coral | Energetic, warm, human | Error, alerts, warm brands |
| 35–55° | Orange / amber | Warmth, energy, action | CTAs, accents, warm semantic |
| 55–85° | Amber / gold / yellow-orange | Warning, attention, optimism | Warning states, highlight |
| 85–110° | Yellow / chartreuse | Attention, caution, youth | Highlight, playful brands |
| 110–140° | Yellow-green / lime | Freshness, new, growth | Success-adjacent, eco brands |
| 140–170° | Green | Success, growth, nature, health | Success states, nature/wellness |
| 170–200° | Teal / cyan-green | Calm, clean, medical, fresh | Healthcare, wellness, finance |
| 200–225° | Cyan / azure | Tech, clean, cool, airy | SaaS tools, dev platforms |
| 225–250° | Blue — light/fresh | Fresh, approachable, modern | Consumer tech, social |
| 250–268° | Blue — trust / corporate | Trust, reliability, stability | Finance, enterprise, healthcare |
| 268–285° | Indigo / blue-violet | Premium, refined, focused | Premium SaaS, productivity |
| 285–310° | Violet / purple | Creative, playful, luxury | Creative tools, luxury |
| 310–330° | Magenta / purple-pink | Bold, modern, distinctive | Modern brands, creative |
| 330–360° | Pink / red-pink | Warm, energetic, humane | Consumer, lifestyle, beauty |

## Brand Anchors

Use these converted references when you need to place the proposed primary
on the hue wheel. Hues are in OKLCH degrees.

### "Trust / corporate blue" — 250–265°

| Brand | Hex | OKLCH hue | Notes |
| ----- | --- | --------- | ----- |
| IBM Carbon primary | `#0F62FE` | ~262° | High-chroma trust blue |
| LinkedIn primary | `#0A66C2` | ~255° | Darker trust blue |
| Facebook blue | `#1877F2` | ~260° | Classic social blue |
| PayPal blue | `#003087` | ~260° | Deep financial blue |
| Visa blue | `#1A1F71` | ~265° | Indigo-leaning trust |
| Zoom blue | `#2D8CFF` | ~253° | Lighter trust blue |

### "Fresh / consumer blue" — 225–250°

| Brand | Hex | OKLCH hue | Notes |
| ----- | --- | --------- | ----- |
| Twitter / X legacy | `#1DA1F2` | ~235° | Fresh sky blue |
| Dropbox blue | `#0061FF` | ~258° | Corporate-leaning |
| Figma blue | `#0D99FF` | ~240° | Cool tool blue |

### "Cyan / tech / medical-device" — 200–225°

| Brand | Hex | OKLCH hue | Notes |
| ----- | --- | --------- | ----- |
| Twilio cyan-blue | `#F22F46` varies — primary is red | — | (Twilio uses red, not blue) |
| Default "tech blue" | `#06B6D4` | ~215° | Tailwind cyan-500 |
| IBM Watson cyan | `#1192E8` | ~230° | Tech/data accent |

**Warning**: Hues 200–225° sit in "cyan/tech" territory, NOT in "trust".
Claiming "calming/trustworthy blue" and picking 220° is a mismatch. Use
250–265° for trust claims.

### "Indigo / premium" — 268–285°

| Brand | Hex | OKLCH hue | Notes |
| ----- | --- | --------- | ----- |
| Stripe indigo | `#635BFF` | ~278° | Premium SaaS |
| Discord blurple | `#5865F2` | ~275° | Community platform |
| Linear indigo | `#5E6AD2` | ~280° | Productivity tool |

### Greens (success, growth) — 130–165°

| Brand | Hex | OKLCH hue | Notes |
| ----- | --- | --------- | ----- |
| Spotify green | `#1DB954` | ~145° | Brand green |
| GitHub success | `#2DA44E` | ~150° | UI success |
| WhatsApp green | `#25D366` | ~150° | Comms green |
| Starbucks green | `#006241` | ~160° | Deeper, trusted |

For status *success*, target 140–160°. Outside that range, the color
starts feeling like lime (~115°, feels synthetic) or teal (~175°, feels
medical rather than celebratory).

### Oranges / warnings — 35–85°

| Brand | Hex | OKLCH hue | Notes |
| ----- | --- | --------- | ----- |
| HubSpot orange | `#FF7A59` | ~35° | Warm coral |
| Amazon orange | `#FF9900` | ~70° | Classic amber |
| Home Depot | `#F96302` | ~45° | Strong orange |
| Material warning | `#FF9800` | ~70° | UI warning amber |

For status *warning*, target 60–85° (amber/gold). Lower hues (35–55°)
bleed into "error" territory visually; higher hues (90–110°) become
yellow and lose urgency.

### Reds / errors — 10–30°

| Brand | Hex | OKLCH hue | Notes |
| ----- | --- | --------- | ----- |
| YouTube red | `#FF0000` | ~29° | Bold brand red |
| Airbnb coral | `#FF5A5F` | ~20° | Warm humane red |
| Material error | `#D32F2F` | ~25° | UI error red |
| Netflix red | `#E50914` | ~27° | Dramatic brand red |

For status *error*, target 15–30°. Below 15° trends pink; above 30°
starts looking like warning-orange and confuses users.

## Semantic Triad Rules

For the success / warning / error trio, enforce:

- **Minimum hue separation**: 60° between any two adjacent semantics
  - Good: success 150°, warning 75°, error 25° → 75° / 50°. Warning/error are thin — compensate with ΔL.
  - Better: success 150°, warning 85°, error 25° → 65° / 60°. Clear.
- **Minimum luminance delta**: 0.10 between success (often dark green) and error (often mid red). If
  both are L=0.55, color-blind users will see near-identical gray. The validator warns when ΔL <
  0.10 even with good hue separation.
- **Always pair with icon or label**. Color alone is never sufficient.

## Red-Green Colorblind Safety

Deuteranopia + protanopia (~5% of men combined) collapse the red/green
channel. Same-luminance success vs error is the classic failure. Guard
rails:

1. **Differentiate by lightness**: success at L=0.55, error at L=0.45 — even a small delta helps
2. **Differentiate by chroma**: high-chroma error (C=0.22) vs lower-chroma success (C=0.14) adds visual weight asymmetry
3. **Always pair with shape**: ✓ for success, ⚠ for warning, ✗ for error — color is secondary
4. **Use non-red/green as primary signals when possible**: blue for info, gray for neutral, reserve red for destructive actions

## How to Pick the Right Hue

1. **Read the brand claim**: "calming" / "trustworthy" / "energetic" / "fresh" / "premium"
2. **Look up the claim in the Hue → Category Map above**
3. **Pick an anchor from the Brand Anchors table** in that range
4. **Propose OKLCH values** with L appropriate for the role (primary body text: L≤0.50; UI/button: L=0.50–0.60; large display: L=0.55–0.70)
5. **Run `validate_colors.py`** with `claimed_hue_label` set — it will flag a range mismatch

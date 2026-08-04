// In-page conformance analyzer. Runs in the page via CDP Runtime.evaluate and
// returns FACTS, not verdicts. It reads the page's OWN declared :root custom
// properties as the token set, then reports where computed styles fall outside
// that set — plus measured values (viewport coverage, durations, easings) so a
// human or a project-specific waiver layer can decide what, if anything, is
// "too much". It deliberately hard-codes no pass/fail thresholds: different
// surfaces legitimately warrant different rulings.
//
// Returns: { url, media, tokenColors, observations: [{ rule, sel, measure }] }
/* global document, window, getComputedStyle, matchMedia, location */
// eslint-disable-next-line no-unused-vars -- serialized and injected into the page by conform.mjs
async function designConform(opts) {
  const identityToken = (opts && opts.identityToken) || "--brand"
  const fontStacks = (opts && opts.fontStacks) || [
    "fraunces",
    "commissioner",
    "ui-monospace",
    "sfmono-regular",
    "sf mono",
    "menlo",
    "consolas",
    "monospace",
    "system-ui",
    "-apple-system",
  ]

  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready
    } catch {
      /* the fonts API is optional; proceed without waiting */
    }
  }

  const probe = document.createElement("span")
  probe.style.display = "none"
  document.body.appendChild(probe)
  const toRGB = (v) => {
    if (!v) return null
    probe.style.color = "rgb(1,2,3)"
    probe.style.color = v
    return getComputedStyle(probe).color
  }
  const parseRGB = (s) => {
    const m = /rgba?\(([^)]+)\)/.exec(s || "")
    if (!m) return null
    const p = m[1].split(/[ ,/]+/).map((x) => parseFloat(x)).filter((x) => !Number.isNaN(x))
    if (p.length < 3) return null
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }
  }
  const key = (o) => (o ? `${Math.round(o.r)},${Math.round(o.g)},${Math.round(o.b)}` : null)
  const toMs = (d) => {
    d = (d || "").trim()
    if (d.endsWith("ms")) return parseFloat(d)
    if (d.endsWith("s")) return parseFloat(d) * 1000
    return parseFloat(d) || 0
  }

  // --- token set: resolve every color-valued :root custom property ---
  const cs = getComputedStyle(document.documentElement)
  const tokens = {}
  const allowed = new Set()
  for (const name of cs) {
    if (!name.startsWith("--")) continue
    const val = cs.getPropertyValue(name).trim()
    if (!val) continue
    const rgb = parseRGB(toRGB(val))
    if (rgb && rgb.a === 1) {
      tokens[name] = key(rgb)
      allowed.add(key(rgb))
    }
  }
  const IDENTITY = tokens[identityToken] || null

  const shortSel = (el) => {
    let s = el.tagName.toLowerCase()
    if (el.id) s += "#" + el.id
    else if (el.classList.length) s += "." + [...el.classList].slice(0, 2).join(".")
    return s
  }
  const hasOwnText = (el) =>
    [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())

  const vp = window.innerWidth * window.innerHeight
  const observations = []
  const seen = new Set()
  const report = (rule, sel, measure) => {
    const k = rule + "|" + sel + "|" + measure
    if (seen.has(k)) return
    seen.add(k)
    observations.push({ rule, sel, measure })
  }

  const COLOR_PROPS = [
    "color",
    "background-color",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "outline-color",
    "text-decoration-color",
  ]

  for (const el of document.querySelectorAll("body *")) {
    const st = getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    const area = rect.width * rect.height
    const visible =
      st.display !== "none" && st.visibility !== "hidden" && rect.width > 0 && rect.height > 0

    // Colors outside the declared token set (membership is a fact; no threshold)
    for (const prop of COLOR_PROPS) {
      const raw = st.getPropertyValue(prop)
      const rgb = parseRGB(raw)
      if (!rgb || rgb.a === 0) continue
      if (prop.startsWith("border")) {
        const w = parseFloat(st.getPropertyValue(prop.replace("-color", "-width")))
        if (!w) continue
      }
      if (prop === "outline-color" && st.outlineStyle === "none") continue
      if (prop === "text-decoration-color" && st.textDecorationLine === "none") continue
      if (allowed.has(key(rgb))) continue
      report(rgb.a < 1 ? "derived-alpha-color" : "off-token-color", shortSel(el), `${prop}: ${raw}`)
    }

    // Identity color used as a background — reported WITH coverage, never gated.
    // A mark shows a tiny %, a flood shows a large one; the reader decides.
    if (visible && IDENTITY) {
      const bg = parseRGB(st.backgroundColor)
      if (bg && bg.a > 0.9 && key(bg) === IDENTITY) {
        report(
          "identity-color-as-background",
          shortSel(el),
          `${((100 * area) / vp).toFixed(1)}% of viewport · ${Math.round(rect.width)}×${Math.round(rect.height)}px`,
        )
      }
    }

    // Motion — report measured durations/easings; impose no "too slow" cutoff.
    const durs = [...st.transitionDuration.split(","), ...st.animationDuration.split(",")].map(toMs)
    const maxDur = durs.length ? Math.max(...durs) : 0
    if (maxDur > 0) {
      const eases = st.transitionTimingFunction + " " + st.animationTimingFunction
      const bez = /cubic-bezier\(\s*[-\d.]+\s*,\s*([-\d.]+)\s*,\s*[-\d.]+\s*,\s*([-\d.]+)\s*\)/g
      let overshoot = false
      let m
      while ((m = bez.exec(eases))) {
        const y1 = parseFloat(m[1]), y2 = parseFloat(m[2])
        if (y1 < -0.1 || y1 > 1.1 || y2 < -0.1 || y2 > 1.1) overshoot = true
      }
      if (maxDur >= 250 || overshoot) {
        report("motion", shortSel(el), `${maxDur}ms ${eases.trim()}${overshoot ? " ⟵ overshoot" : ""}`)
      }
    }
    if (st.transitionProperty === "all") {
      report("transition-all", shortSel(el), "transition-property: all")
    }

    // Type family outside the declared stacks (the Inter-creep signal)
    if (visible && hasOwnText(el)) {
      const fam = st.fontFamily.split(",")[0].replace(/["']/g, "").trim().toLowerCase()
      if (fam && !fontStacks.includes(fam)) {
        report("off-stack-font", shortSel(el), st.fontFamily)
      }
    }
  }

  probe.remove()
  return {
    url: location.pathname,
    media: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    tokenColors: Object.keys(tokens).length,
    observations,
  }
}

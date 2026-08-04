#!/usr/bin/env node
// design-conform — a report-only design-token conformance reporter.
//
// Loads each URL in a headless Chromium (resolved from the environment — no npm
// dependency), under each requested color scheme, runs the in-page analyzer,
// and prints the FACTS it measured: colors outside the page's declared token
// set, the identity color used as a background (with viewport coverage), motion
// durations/easings, and off-stack fonts. It sets NO pass/fail thresholds and
// exits 0 by default — what counts as "too much" is situational; that ruling
// belongs to a human or a project waiver layer, not this tool.
//
// Usage:
//   node conform.mjs <url...> [--identity-token --brand] [--schemes light,dark]
//                    [--width 1280] [--height 900] [--json] [--chrome /path]
//
// Requires only a Chromium/Chrome binary. Resolution order:
//   $CHROME / $CHROME_PATH → Playwright cache → PATH → macOS app bundles.
/* global process, console, fetch, WebSocket, URL, setTimeout */
import { readFileSync, existsSync, readdirSync, mkdtempSync, rmSync } from "node:fs"
import { spawn } from "node:child_process"
import { tmpdir, homedir } from "node:os"
import { join } from "node:path"

// ---- args ----
const argv = process.argv.slice(2)
const flag = (name, def) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : def
}
const has = (name) => argv.includes(name)
const urls = argv.filter((a) => /^https?:\/\//i.test(a))
if (!urls.length) {
  console.error(
    "usage: node conform.mjs <url...> [--identity-token --brand] [--schemes light,dark] [--width N] [--height N] [--json] [--chrome /path]",
  )
  process.exit(2)
}
const identityToken = flag("--identity-token", "--brand")
const schemes = flag("--schemes", "light,dark").split(",").map((s) => s.trim()).filter(Boolean)
const width = parseInt(flag("--width", "1280"), 10)
const height = parseInt(flag("--height", "900"), 10)
const asJson = has("--json")

// ---- resolve a chromium binary ----
function resolveChrome() {
  const explicit = flag("--chrome", process.env.CHROME || process.env.CHROME_PATH)
  if (explicit && existsSync(explicit)) return explicit
  const caches = [
    join(homedir(), "Library/Caches/ms-playwright"),
    join(homedir(), ".cache/ms-playwright"),
  ]
  const candidates = []
  for (const cache of caches) {
    if (!existsSync(cache)) continue
    for (const dir of readdirSync(cache).filter((d) => d.startsWith("chromium")).sort().reverse()) {
      candidates.push(
        join(cache, dir, "chrome-headless-shell-mac-arm64/chrome-headless-shell"),
        join(cache, dir, "chrome-headless-shell-linux64/chrome-headless-shell"),
        join(cache, dir, "chrome-mac/Chromium.app/Contents/MacOS/Chromium"),
        join(cache, dir, "chrome-linux/chrome"),
      )
    }
  }
  candidates.push(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  )
  for (const c of candidates) if (existsSync(c)) return c
  return null
}
const chromePath = resolveChrome()
if (!chromePath) {
  console.error(
    "No Chromium found. Set $CHROME, pass --chrome <path>, or run `npx playwright install chromium`.",
  )
  process.exit(3)
}

// ---- launch chrome, discover its CDP port via DevToolsActivePort ----
const profile = mkdtempSync(join(tmpdir(), "design-conform-"))
const chrome = spawn(
  chromePath,
  [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
)
const cleanup = () => {
  try {
    chrome.kill()
  } catch {
    /* already gone */
  }
  try {
    rmSync(profile, { recursive: true, force: true })
  } catch {
    /* best-effort temp cleanup */
  }
}
process.on("exit", cleanup)
process.on("SIGINT", () => {
  cleanup()
  process.exit(130)
})

async function cdpEndpoint() {
  const portFile = join(profile, "DevToolsActivePort")
  for (let i = 0; i < 100; i++) {
    if (existsSync(portFile)) {
      const port = readFileSync(portFile, "utf8").split("\n")[0].trim()
      if (port) return `http://127.0.0.1:${port}`
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error("chrome did not expose a DevTools port")
}

// ---- minimal CDP client (one browser WS, flattened sessions) ----
async function connect(httpBase) {
  const { webSocketDebuggerUrl } = await (await fetch(`${httpBase}/json/version`)).json()
  const ws = new WebSocket(webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.onopen = res
    ws.onerror = () => rej(new Error("ws error"))
  })
  let id = 0
  const pending = new Map()
  const waiters = []
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)
    } else if (msg.method) {
      for (let i = waiters.length - 1; i >= 0; i--)
        if (waiters[i].match(msg)) waiters.splice(i, 1)[0].resolve(msg)
    }
  }
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const mid = ++id
      pending.set(mid, { resolve, reject })
      ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }))
    })
  const waitFor = (match, ms = 20000) =>
    new Promise((resolve, reject) => {
      const w = { match, resolve }
      waiters.push(w)
      setTimeout(() => {
        const i = waiters.indexOf(w)
        if (i >= 0) waiters.splice(i, 1)
        reject(new Error("timeout waiting for CDP event"))
      }, ms)
    })
  return { send, waitFor, close: () => ws.close() }
}

// ---- run ----
const analyzerSrc = readFileSync(new URL("./analyzer.js", import.meta.url), "utf8")
const expr = (o) =>
  `(async () => { ${analyzerSrc}\n return await designConform(${JSON.stringify(o)}); })()`

const cdp = await connect(await cdpEndpoint())
const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" })
const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true })
await cdp.send("Page.enable", {}, sessionId)
await cdp.send("Runtime.enable", {}, sessionId)
await cdp.send(
  "Emulation.setDeviceMetricsOverride",
  { width, height, deviceScaleFactor: 1, mobile: false },
  sessionId,
)

const results = []
for (const media of schemes) {
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: media }] }, sessionId)
  for (const url of urls) {
    const loaded = cdp.waitFor((m) => m.sessionId === sessionId && m.method === "Page.loadEventFired")
    await cdp.send("Page.navigate", { url }, sessionId)
    await loaded
    const { result } = await cdp.send(
      "Runtime.evaluate",
      { expression: expr({ identityToken }), returnByValue: true, awaitPromise: true },
      sessionId,
    )
    results.push(result.value)
  }
}
cdp.close()
cleanup()

if (asJson) {
  console.log(JSON.stringify(results, null, 2))
  process.exit(0)
}

// ---- report (facts only; sorted for legibility, never gated) ----
for (const r of results) {
  console.log(`\n\x1b[1m${r.url}\x1b[0m  [${r.media}]  ${r.tokenColors} token colors declared`)
  if (!r.observations.length) {
    console.log("  (nothing outside the declared token set)")
    continue
  }
  const byRule = {}
  for (const o of r.observations) (byRule[o.rule] ??= []).push(o)
  // identity-color rows sort by coverage desc so the flood floats above the marks
  if (byRule["identity-color-as-background"])
    byRule["identity-color-as-background"].sort((a, b) => parseFloat(b.measure) - parseFloat(a.measure))
  for (const [rule, obs] of Object.entries(byRule).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  \x1b[36m${rule}\x1b[0m (${obs.length})`)
    for (const o of obs.slice(0, 8)) console.log(`      ${o.sel} — ${o.measure}`)
    if (obs.length > 8) console.log(`      …and ${obs.length - 8} more`)
  }
}
const total = results.reduce((n, r) => n + r.observations.length, 0)
console.log(`\n${total} observation(s) across ${results.length} page/scheme run(s). Report only — no thresholds applied.`)

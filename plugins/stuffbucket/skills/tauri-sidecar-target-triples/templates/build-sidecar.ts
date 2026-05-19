#!/usr/bin/env bun
/**
 * Generalised sidecar build script. Compiles `<entry>` for the host triple
 * (or one passed via `--target=`) and writes to
 * `src-tauri/binaries/<basename>-<triple>[.exe]` atomically.
 *
 * Supports three compilers out of the box; pick one via COMPILER env or
 * the `kind` arg below:
 *   - "bun"   : `bun build --compile --target=bun-<os>-<arch>`
 *   - "cargo" : `cargo build --release --target <triple>`
 *   - "go"    : `GOOS=<os> GOARCH=<arch> go build -o ...`
 *
 * Drop into scripts/ and call from `package.json` before `tauri build`.
 */
import { spawnSync } from "node:child_process"
import { mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

type Kind = "bun" | "cargo" | "go"

const REPO = resolve(import.meta.dir, "..")
const ENTRY = join(REPO, "src/main.ts")          // adjust per project
const BASENAME = "myproxy"                        // matches externalBin
const OUT_DIR = join(REPO, "src-tauri/binaries")
const KIND: Kind = (process.env.COMPILER as Kind) ?? "bun"
const FORCE =
  process.argv.includes("--force") || process.env.SIDECAR_FORCE === "1"

const targetFlag = process.argv.find((a) => a.startsWith("--target="))
const triple = targetFlag ? targetFlag.slice("--target=".length) : hostTriple()
const isWindows = triple.includes("pc-windows")
const ext = isWindows ? ".exe" : ""
const outfile = join(OUT_DIR, `${BASENAME}-${triple}${ext}`)
const tmpfile = `${outfile}.tmp`

cleanTemps(OUT_DIR)

if (!FORCE && upToDate(outfile, [join(REPO, "src"), join(REPO, "package.json")])) {
  console.error(`[sidecar] up to date: ${outfile}`)
  process.exit(0)
}

mkdirSync(OUT_DIR, { recursive: true })
console.error(`[sidecar] triple=${triple} kind=${KIND} out=${outfile}`)

let status = 1
if (KIND === "bun") status = buildBun(triple, tmpfile)
else if (KIND === "cargo") status = buildCargo(triple, tmpfile)
else if (KIND === "go") status = buildGo(triple, tmpfile)

if (status !== 0) {
  rmSync(tmpfile, { force: true })
  console.error(`[sidecar] compiler exited ${status}`)
  process.exit(status)
}

// Sanity-check: refuse to ship a stub. Catches `bun build --compile` exit-0
// failures that produce an 800-byte file.
const size = statSync(tmpfile).size
if (size < 1024) {
  rmSync(tmpfile, { force: true })
  throw new Error(`[sidecar] output suspiciously small (${size} B); aborting`)
}

if (!isWindows) spawnSync("chmod", ["+x", tmpfile])
renameSync(tmpfile, outfile)
console.error(`[sidecar] wrote ${outfile} (${size} bytes)`)

// ─── helpers ────────────────────────────────────────────────────────────────

function buildBun(triple: string, out: string): number {
  const target = bunTarget(triple)
  return spawnSync(
    "bun",
    ["build", "--compile", `--target=${target}`, ENTRY, `--outfile=${out}`],
    { stdio: "inherit", cwd: REPO },
  ).status ?? 1
}

function buildCargo(triple: string, out: string): number {
  const r = spawnSync(
    "cargo",
    ["build", "--release", "--target", triple, "--bin", BASENAME],
    { stdio: "inherit", cwd: REPO },
  )
  if (r.status !== 0) return r.status ?? 1
  const built = join(
    REPO,
    "target",
    triple,
    "release",
    BASENAME + (triple.includes("pc-windows") ? ".exe" : ""),
  )
  renameSync(built, out)
  return 0
}

function buildGo(triple: string, out: string): number {
  const [arch, os] = goTarget(triple)
  return spawnSync("go", ["build", "-o", out, "./cmd/" + BASENAME], {
    stdio: "inherit",
    cwd: REPO,
    env: { ...process.env, GOOS: os, GOARCH: arch, CGO_ENABLED: "0" },
  }).status ?? 1
}

function hostTriple(): string {
  const r = spawnSync("rustc", ["-vV"], { encoding: "utf8" })
  const m = r.stdout?.match(/^host:\s*(.+)$/m)
  if (m) return m[1].trim()
  throw new Error("rustc not on PATH; pass --target=<triple> explicitly")
}

function bunTarget(triple: string): string {
  const map: Record<string, string> = {
    "aarch64-apple-darwin": "bun-darwin-arm64",
    "x86_64-apple-darwin": "bun-darwin-x64",
    "aarch64-unknown-linux-gnu": "bun-linux-arm64",
    "x86_64-unknown-linux-gnu": "bun-linux-x64",
    "x86_64-pc-windows-msvc": "bun-windows-x64",
  }
  const v = map[triple]
  if (!v) throw new Error(`No bun target for triple ${triple}`)
  return v
}

function goTarget(triple: string): [string, string] {
  if (triple === "aarch64-apple-darwin") return ["arm64", "darwin"]
  if (triple === "x86_64-apple-darwin") return ["amd64", "darwin"]
  if (triple === "x86_64-pc-windows-msvc") return ["amd64", "windows"]
  if (triple === "aarch64-unknown-linux-gnu") return ["arm64", "linux"]
  if (triple === "x86_64-unknown-linux-gnu") return ["amd64", "linux"]
  throw new Error(`No Go GOARCH/GOOS for triple ${triple}`)
}

function upToDate(out: string, watched: Array<string>): boolean {
  let mtime: number
  try { mtime = statSync(out).mtimeMs } catch { return false }
  for (const p of watched) if (newerThan(p, mtime)) return false
  return true
}

function newerThan(path: string, threshold: number): boolean {
  const st = statSync(path)
  if (st.isFile()) return st.mtimeMs > threshold
  if (!st.isDirectory()) return false
  for (const e of readdirSync(path, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue
    if (newerThan(join(path, e.name), threshold)) return true
  }
  return false
}

function cleanTemps(dir: string): void {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (!e.isFile()) continue
    if (e.name.endsWith(".tmp") || /^\.[0-9a-f]+-\d+\.bun-build$/.test(e.name)) {
      rmSync(join(dir, e.name), { force: true })
    }
  }
}

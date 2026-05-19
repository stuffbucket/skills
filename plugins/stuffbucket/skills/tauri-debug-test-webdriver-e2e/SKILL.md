---
name: tauri-debug-test-webdriver-e2e
description: Use when adding end-to-end tests to a Tauri v2 app via WebDriver — installing `tauri-driver` (cargo install), the Linux `WebKitWebDriver` + `xvfb-run` headless setup, the Windows `msedgedriver` version-must-match-Edge dance via `msedgedriver-tool`, the macOS-desktop gap (no WKWebView driver), WebdriverIO vs Selenium config (`capabilities: [{ 'tauri:options': { application } }]`, port 4444), spawning `tauri-driver` from `beforeSession`/`before` and killing it on shutdown, and the GitHub Actions matrix that runs the suite headless on `ubuntu-latest` + `windows-latest`.
---

# Tauri v2 — WebDriver End-to-End Testing

WebDriver drives the real shipped binary. Unlike `mockIPC` (see
[[tauri-debug-test-mock-ipc]]) the Rust process is running for real and the
test interacts through the platform's native WebDriver server.

See [[tauri-debug-test]] for the top-level testing/debugging landscape.

## What `tauri-driver` actually is

A cross-platform proxy. Real WebDriver clients (Selenium, WebdriverIO) talk
to `tauri-driver` on `127.0.0.1:4444`; `tauri-driver` forwards to:

- **Linux:** `WebKitWebDriver` (WebKitGTK).
- **Windows:** `msedgedriver.exe` (Edge / WebView2).
- **macOS desktop:** *unsupported* — Apple ships no WKWebView driver.
  Run e2e on Linux CI; smoke macOS builds by hand.
- **iOS / Android:** via Appium 2, not streamlined.

Install/update:

```sh
cargo install tauri-driver --locked
```

## Platform prerequisites

### Linux

```sh
sudo apt-get install -y libwebkit2gtk-4.1-dev webkit2gtk-driver xvfb
which WebKitWebDriver   # must resolve
```

`xvfb-run yarn test` creates a fake X display so the app can render
headlessly without code changes.

### Windows

The Edge driver version must exactly match the Edge build on the machine
(checks via `edge://version`). Mismatch → the test hangs forever on
session start. Automate via [`msedgedriver-tool`]:

```pwsh
cargo install --git https://github.com/chippers/msedgedriver-tool
& "$HOME/.cargo/bin/msedgedriver-tool.exe"
# Put $PWD on $PATH so tauri-driver picks up the new msedgedriver.exe.
```

Override the lookup path with `tauri-driver --native-driver "<path>"`.

### macOS

Don't try. There is no WKWebView WebDriver. Use mock-ipc unit tests for
logic and a manual checklist for visuals. Track upstream
<https://github.com/tauri-apps/tauri/issues> if you need this.

## WebdriverIO setup (recommended)

`wdio.conf.ts` lives in `e2e-tests/`. The core moving parts:

```ts
capabilities: [{ 'tauri:options': { application: '../src-tauri/target/debug/tauri-app' } }],
host: '127.0.0.1',
port: 4444,
```

Build the binary once in `onPrepare` (`tauri build --debug --no-bundle` —
skip installer creation, keep symbols), spawn `tauri-driver` in
`beforeSession`, kill it in `afterSession` **and** on every shutdown
signal so a Ctrl-C from a flaky test doesn't leak a 4444-bound process.

Full template: `templates/wdio.conf.ts`.

## Selenium variant

Same shape, no test framework included. You drive the lifecycle from
Mocha's `before()` / `after()` and build the capabilities object by hand:

```ts
const caps = new Capabilities()
caps.set('tauri:options', { application })
caps.setBrowserName('wry')
driver = await new Builder().withCapabilities(caps).usingServer('http://127.0.0.1:4444/').build()
```

Use Selenium only if you need Python/Java clients or have an existing
suite. WebdriverIO is friendlier and the official examples target it.

## Spec / page-object patterns

Specs use the WebdriverIO `$`/`$$` selectors and assertion helpers
(`expect-webdriverio`):

```ts
const header = await $('body > h1')
expect(await header.getText()).toMatch(/^hello/i)
```

For anything beyond a handful of selectors, wrap in a page object:

```ts
class SettingsPage {
  get apiKeyInput() { return $('[data-test="api-key"]') }
  async save() { await $('[data-test="save"]').click() }
}
```

This pays off the moment a CSS refactor moves selectors.

## Screenshots on failure

Add to `wdio.conf.ts`:

```ts
afterTest: async (test, _ctx, { passed }) => {
  if (!passed) await browser.saveScreenshot(`./screenshots/${test.title}.png`)
}
```

Critical on CI — without it, "intermittent failure on ubuntu-latest" is
unfixable.

## CI matrix

Minimal GitHub Actions (full file in `templates/github-actions-e2e.yml`):

- `ubuntu-latest` — apt-get the gtk + xvfb deps, `xvfb-run yarn test`.
- `windows-latest` — `msedgedriver-tool`, then plain `yarn test`.
- `macos-latest` — skip or restrict to non-WebView jobs.

Always `cargo install tauri-driver --locked` after the Rust toolchain
step; cache the cargo registry with `Swatinem/rust-cache@v2` for
~minute-saving rebuilds.

## Templates

- `templates/wdio.conf.ts` — full WebdriverIO config with tauri-driver
  lifecycle + screenshot-on-fail.
- `templates/example.e2e.ts` — sample spec with selectors + page object.
- `templates/github-actions-e2e.yml` — Linux+Windows matrix.

## Anti-patterns

- **`cargo install tauri-driver` without `--locked`.** Picks up
  incompatible deps; lock to the published Cargo.lock.
- **Forgetting to wait on hydration.** SPAs render after IPC roundtrips
  finish — `await browser.waitUntil(() => $('...').isExisting())` instead
  of `browser.pause(500)`.
- **Reusing dev binaries built on a different Rust toolchain.** CI must
  build fresh in `onPrepare`; do not cache `target/debug/<app>` across
  jobs.
- **Hard-coding `~/.cargo/bin/tauri-driver` on Windows.** Use the path the
  CI runner gives you (`process.env.USERPROFILE`); the Selenium/WDIO
  template uses `os.homedir()`.

[`msedgedriver-tool`]: https://github.com/chippers/msedgedriver-tool

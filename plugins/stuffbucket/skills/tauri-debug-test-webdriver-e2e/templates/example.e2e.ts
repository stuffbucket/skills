// e2e-tests/test/specs/example.e2e.ts
//
// Demonstrates a thin page object + a few realistic assertions: hydration
// wait, text match, computed style. WebdriverIO's `expect` is auto-imported
// when wdio.conf.ts uses the mocha framework.

class MainPage {
  get header() { return $('body > h1') }
  get themeToggle() { return $('[data-test="theme-toggle"]') }
  async waitForHydration() {
    await browser.waitUntil(async () => this.header.then((h) => h.isExisting()), {
      timeout: 10_000,
      timeoutMsg: 'main window did not hydrate within 10s',
    })
  }
}

describe('Hello Tauri', () => {
  const page = new MainPage()

  before(async () => {
    await page.waitForHydration()
  })

  it('greets cordially', async () => {
    const text = await (await page.header).getText()
    expect(text).toMatch(/^hello/i)
  })

  it('uses a dark background', async () => {
    const body = await $('body')
    const bg = await body.getCSSProperty('background-color')
    // parsed.hex is normalised by WebdriverIO regardless of rgb()/hex source.
    const hex = bg.parsed.hex.replace('#', '')
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    expect(luma).toBeLessThan(100)
  })

  it('toggles theme via the IPC bridge', async () => {
    const toggle = await page.themeToggle
    if (await toggle.isExisting()) {
      await toggle.click()
      // App emits a class change after the round-trip — wait, do not pause.
      await browser.waitUntil(async () => (await $('body')).getAttribute('data-theme').then((v) => v === 'light'))
    }
  })
})

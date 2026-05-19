// e2e-tests/wdio.conf.ts
//
// Drop-in WebdriverIO config for a Tauri v2 app. Builds the debug binary
// in onPrepare, spawns tauri-driver in beforeSession, tears it down on
// shutdown (afterSession may not run if startup itself fails).
//
// Run with:  cd e2e-tests && yarn test
// On Linux CI:  xvfb-run yarn test

import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const APP_BINARY = path.resolve(
  __dirname,
  '..',
  'src-tauri',
  'target',
  'debug',
  // .exe suffix is fine to include on Windows — Node will resolve either way.
  process.platform === 'win32' ? 'tauri-app.exe' : 'tauri-app',
)

let tauriDriver: ChildProcessWithoutNullStreams | undefined
let shuttingDown = false

export const config: WebdriverIO.Config = {
  host: '127.0.0.1',
  port: 4444,
  specs: ['./test/specs/**/*.e2e.ts'],
  maxInstances: 1,
  capabilities: [
    {
      maxInstances: 1,
      'tauri:options': { application: APP_BINARY },
    },
  ],
  reporters: ['spec'],
  framework: 'mocha',
  mochaOpts: { ui: 'bdd', timeout: 60_000 },

  onPrepare() {
    // --no-bundle keeps installer-generation off the critical path.
    spawnSync('yarn', ['tauri', 'build', '--debug', '--no-bundle'], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      shell: true,
    })
  },

  beforeSession() {
    tauriDriver = spawn(
      path.resolve(os.homedir(), '.cargo', 'bin', process.platform === 'win32' ? 'tauri-driver.exe' : 'tauri-driver'),
      [],
      { stdio: [null, process.stdout, process.stderr] },
    )
    tauriDriver.on('error', (err) => {
      console.error('tauri-driver error:', err)
      process.exit(1)
    })
    tauriDriver.on('exit', (code) => {
      if (!shuttingDown) {
        console.error('tauri-driver exited unexpectedly with code', code)
        process.exit(1)
      }
    })
  },

  afterSession() {
    closeTauriDriver()
  },

  async afterTest(test, _ctx, { passed }) {
    if (!passed) {
      const safe = test.title.replace(/[^a-z0-9-_]+/gi, '_')
      await browser.saveScreenshot(`./screenshots/${safe}.png`).catch(() => {})
    }
  },
}

function closeTauriDriver() {
  shuttingDown = true
  tauriDriver?.kill()
}

for (const sig of ['exit', 'SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'] as const) {
  process.on(sig, () => {
    closeTauriDriver()
    if (sig !== 'exit') process.exit()
  })
}

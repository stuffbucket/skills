// vitest.setup.ts — referenced from vitest.config.ts via `setupFiles: ['./vitest.setup.ts']`
//
// Polyfills the few Web APIs that jsdom omits so Tauri's IPC mocks behave
// like a real WebView. Also wires automatic `clearMocks()` after every test
// so state from one file cannot poison another.

import { webcrypto } from 'node:crypto'
import { afterEach } from 'vitest'
import { clearMocks } from '@tauri-apps/api/mocks'

// jsdom does not ship WebCrypto; @tauri-apps/api uses it for IPC request
// correlation. happy-dom already provides this so the guard is safe.
if (!globalThis.crypto || !('subtle' in globalThis.crypto)) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
    writable: true,
  })
}

// Some Tauri JS paths read structuredClone (older jsdom). Node 17+ has it
// globally; this is belt-and-braces.
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = (v: unknown) => JSON.parse(JSON.stringify(v))
}

// Always tear mocks down. clearMocks() is idempotent and cheap — running
// it when no mock is installed is a no-op.
afterEach(() => {
  clearMocks()
})

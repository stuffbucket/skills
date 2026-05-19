// Example Vitest suite demonstrating the four common mocking patterns:
//   1. invoke() returns a value
//   2. spy on invoke arguments / call count
//   3. invoke() rejects (Rust error path)
//   4. Tauri-2.7+ event round-trip via shouldMockEvents
//   5. mockWindows for getCurrent()/getAll() branches
//
// Assumes vitest.setup.ts (next to this file) is wired into vitest.config.ts
// via `test.setupFiles`.

import { describe, expect, it, vi } from 'vitest'
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks'
import { invoke } from '@tauri-apps/api/core'
import { emit, listen } from '@tauri-apps/api/event'

describe('invoke', () => {
  it('returns the mocked value', async () => {
    mockIPC((cmd, args) => {
      if (cmd === 'add') return (args.a as number) + (args.b as number)
      throw new Error(`unmocked: ${cmd}`)
    })
    await expect(invoke('add', { a: 2, b: 3 })).resolves.toBe(5)
  })

  it('records call args via spy', async () => {
    mockIPC(() => 'ok')
    const spy = vi.spyOn(window.__TAURI_INTERNALS__, 'invoke')
    await invoke('save', { id: 42 })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('save', { id: 42 })
  })

  it('rejects when the handler throws', async () => {
    mockIPC(() => {
      throw { kind: 'NotFound', message: 'user 42' }
    })
    await expect(invoke('load_user')).rejects.toMatchObject({
      kind: 'NotFound',
    })
  })
})

describe('events (Tauri 2.7+)', () => {
  it('delivers emit() to listen()', async () => {
    mockIPC(() => {}, { shouldMockEvents: true })
    const handler = vi.fn()
    await listen('progress', handler)
    await emit('progress', { pct: 50 })
    expect(handler).toHaveBeenCalledWith({
      event: 'progress',
      payload: { pct: 50 },
      // id and other fields vary; only assert on shape we care about.
    })
  })
})

describe('mockWindows', () => {
  it('reports the current label and full list', async () => {
    mockWindows('splash', 'main', 'settings')
    const { getCurrent, getAll } = await import('@tauri-apps/api/webviewWindow')
    expect(getCurrent().label).toBe('splash')
    expect(getAll().map((w) => w.label)).toEqual(['splash', 'main', 'settings'])
  })
})

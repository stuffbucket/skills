// Vitest example: mock Tauri IPC so frontend code can be unit-tested
// without spawning the Rust core. Works with any jsdom-backed runner
// (Vitest, Jest). For Bun's test runner, swap `vi.fn`/`vi.spyOn` for
// `mock()` from `bun:test` — the `@tauri-apps/api/mocks` calls are the same.

import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { randomFillSync } from 'node:crypto';

import { clearMocks, mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';

// jsdom doesn't ship a WebCrypto implementation; Tauri's IPC layer uses it
// to generate per-call callback IDs, so wire up a Node-backed shim once.
beforeAll(() => {
  Object.defineProperty(window, 'crypto', {
    value: {
      getRandomValues: (buffer: Uint8Array) => randomFillSync(buffer),
    },
  });
});

// CRITICAL: clear between tests. mockIPC patches globals — without this,
// state leaks across the file and you get baffling cross-test failures.
afterEach(() => {
  clearMocks();
});

test('invoke: simple command handler', async () => {
  mockIPC((cmd, args) => {
    if (cmd === 'add') {
      const { a, b } = args as { a: number; b: number };
      return a + b;
    }
  });

  await expect(invoke('add', { a: 12, b: 15 })).resolves.toBe(27);
});

test('invoke: assert command was called with spy', async () => {
  mockIPC((cmd, args) => {
    if (cmd === 'greet') {
      return `hello ${(args as { name: string }).name}`;
    }
  });

  // __TAURI_INTERNALS__.invoke is the real entry point that mockIPC patches.
  const spy = vi.spyOn(window.__TAURI_INTERNALS__, 'invoke');

  await expect(invoke('greet', { name: 'world' })).resolves.toBe('hello world');
  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy).toHaveBeenCalledWith('greet', { name: 'world' }, undefined);
});

test('invoke: error path surfaces rejection', async () => {
  mockIPC((cmd) => {
    if (cmd === 'fails') throw new Error('boom');
  });

  await expect(invoke('fails')).rejects.toThrow('boom');
});

test('events: shouldMockEvents lets listen/emit round-trip (api >= 2.7.0)', async () => {
  mockIPC(() => {}, { shouldMockEvents: true });

  const handler = vi.fn();
  await listen('ping', handler);
  await emit('ping', { n: 1 });

  expect(handler).toHaveBeenCalledWith({
    event: 'ping',
    payload: { n: 1 },
  });
});

test('windows: mockWindows fakes label + multi-window topology', async () => {
  mockWindows('main', 'splash', 'settings');

  // dynamic import so the module reads the freshly mocked global state
  const { getCurrentWebviewWindow, getAllWebviewWindows } = await import(
    '@tauri-apps/api/webviewWindow'
  );

  expect(getCurrentWebviewWindow().label).toBe('main');
  expect((await getAllWebviewWindows()).map((w) => w.label)).toEqual([
    'main',
    'splash',
    'settings',
  ]);
});

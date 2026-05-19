---
name: tauri-debug-test-mock-ipc
description: Use when unit-testing the frontend of a Tauri v2 app under jsdom/happy-dom — intercepting `invoke()` calls with `mockIPC`, faking multiple windows with `mockWindows`, spying on `__TAURI_INTERNALS__.invoke` for call-count assertions, simulating Rust→JS events with `shouldMockEvents` (Tauri 2.7+), wiring `clearMocks()` into `afterEach`, polyfilling `globalThis.crypto.subtle` under jsdom, and the Vitest-vs-bun-test compatibility notes.
---

# Tauri v2 — Mocking IPC in Frontend Unit Tests

Frontend tests under jsdom/happy-dom run in a plain Node-like environment.
There is no Rust process, no `__TAURI_INTERNALS__`, no event system — anything
that calls `invoke()` or `listen()` throws by default. Tauri ships a
[`@tauri-apps/api/mocks`] module to install a fake IPC bridge for the
lifetime of a test.

See [[tauri-debug-test]] for the wider debug/test picture and
[[tauri-architecture-ipc-internals]] for what the real bridge looks like.

## Mental model

`mockIPC(handler)` monkey-patches `window.__TAURI_INTERNALS__.invoke` to call
your handler instead of postMessage'ing the Rust process. The handler
receives `(cmd: string, args: Record<string, unknown>)` and may return a
value or a `Promise`. Throwing (or returning a rejected promise) makes the
frontend `invoke()` reject — that's how you test error paths.

`mockWindows(current, ...others)` fakes the multi-window registry so
`getCurrent()`, `getAll()`, and friends from `@tauri-apps/api/webviewWindow`
resolve to plausible labels. It does **not** simulate window state — call
`mockIPC` for any `core:window:*` commands you actually need.

## Required teardown — `clearMocks()`

Mocks live on the global `window` object and **persist between tests** until
you tear them down. Always:

```ts
import { afterEach } from 'vitest'
import { clearMocks } from '@tauri-apps/api/mocks'

afterEach(() => {
  clearMocks()
})
```

If a "fresh" test inherits a stale `mockIPC` from the previous file,
debugging is brutal. Put `clearMocks()` in a global `setup.ts` so you cannot
forget.

## jsdom WebCrypto polyfill

Tauri's IPC layer uses `crypto.getRandomValues` and `crypto.subtle` for
request correlation. jsdom does not implement WebCrypto. Polyfill in setup:

```ts
// vitest.setup.ts
import { webcrypto } from 'node:crypto'
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto })
}
```

happy-dom ships WebCrypto, so this step is jsdom-only. See
`templates/test-setup.ts` for the full file.

## Spying on call count / arguments

`mockIPC` doesn't track calls. Wrap with Vitest's `vi.spyOn` against the
internal handle after installing the mock:

```ts
mockIPC((cmd, args) => cmd === 'add' ? (args.a as number) + (args.b as number) : undefined)
const spy = vi.spyOn(window.__TAURI_INTERNALS__, 'invoke')
await invoke('add', { a: 2, b: 3 })
expect(spy).toHaveBeenCalledWith('add', { a: 2, b: 3 })
```

For bun-test, use `mock()` and `spyOn` from `bun:test` — same shape, same
target (`window.__TAURI_INTERNALS__.invoke`).

## Errors and async

```ts
mockIPC(async (cmd) => {
  if (cmd === 'load_user') throw new Error('not found')
})
await expect(invoke('load_user')).rejects.toThrow('not found')
```

The frontend sees a plain `Error`, not a serialized `CommandError` — so if
your code depends on the structured `{ kind, message }` shape from
[[tauri-commands-error-handling]], throw a plain object instead:

```ts
throw { kind: 'NotFound', message: 'user 42' }
```

## Sidecar / shell commands

`@tauri-apps/plugin-shell`'s `Command.spawn()` returns through the IPC
layer with an event-callback id. The handler must call the global
`window[`_${onEventFn}`]` to deliver `Stdout` / `Terminated` events. See
the mocking docs for the snippet — rarely needed unless you test the
shell plugin directly.

## Event mocking — Tauri 2.7+

Opt in with `{ shouldMockEvents: true }`:

```ts
mockIPC(() => {}, { shouldMockEvents: true })
const handler = vi.fn()
await listen('progress', handler)
await emit('progress', { pct: 50 })
expect(handler).toHaveBeenCalledWith({ event: 'progress', payload: { pct: 50 } })
```

Limitations: `emitTo` and `emit_filter` (see [[tauri-events-targeted-emit]])
are **not** supported. Test targeted-emit logic by mocking the underlying
`invoke('plugin:event|emit')` call directly.

## mockWindows — when you need it

Code that branches on `getCurrent().label === 'splash'`:

```ts
mockWindows('splash', 'main')
const { getCurrent } = await import('@tauri-apps/api/webviewWindow')
expect(getCurrent().label).toBe('splash')
```

The first argument is the *current* window; the rest populate `getAll()`.

## Vitest vs bun-test

- Both work. The `mockIPC` API is framework-agnostic — it just patches
  `window.__TAURI_INTERNALS__`.
- Vitest needs `environment: 'jsdom'` (or `'happy-dom'`) in `vitest.config.ts`.
- bun-test honours `// @vitest-environment jsdom` if you import `happy-dom`
  manually in a setup file.
- The randomFillSync snippet from the official docs is a workaround for
  older jsdom — prefer the `webcrypto` polyfill above on modern Node.

## Templates

- `templates/test-setup.ts` — globalThis polyfills + `afterEach(clearMocks)`.
- `templates/mock-ipc.test.ts` — Vitest examples: return value, spy on
  args, throw to reject, event listener round-trip, `mockWindows`.

## Anti-patterns

- **Forgetting `clearMocks()`.** State leaks across files and you spend a
  day chasing "but it passes in isolation".
- **Mocking too coarsely.** A handler that returns `undefined` for every
  command silently swallows unrelated `invoke()` calls. Throw on the
  unexpected branch: `throw new Error(\`unmocked: ${cmd}\`)`.
- **Testing Rust through the mock.** The mock is the seam between halves;
  if your unit test depends on Rust behaviour, you want WebDriver (see
  [[tauri-debug-test-webdriver-e2e]]).

[`@tauri-apps/api/mocks`]: https://v2.tauri.app/reference/javascript/api/namespacemocks/

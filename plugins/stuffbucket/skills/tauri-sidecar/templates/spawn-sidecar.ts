// Spawn a Tauri v2 sidecar from the WebView side.
//
// Use this when the WebView, not Rust, owns the sidecar lifecycle —
// e.g. a UI button that boots a helper, or a dev tool. For app-lifetime
// sidecars (a backend server that should die with the app), prefer the
// Rust pattern in spawn-sidecar.rs so kill-on-exit is reliable.

import { Command, type Child } from '@tauri-apps/plugin-shell'

/**
 * Spawn the bundled `binaries/myproxy` sidecar. Resolves once the
 * process is running; rejects if the shell plugin denies it (check
 * capabilities/*.json) or if the binary is missing for this triple.
 */
export async function startMyProxy(port: number): Promise<Child> {
  // The first arg is the path string from tauri.conf.json's
  // bundle.externalBin — no triple suffix, Tauri resolves it.
  const sidecar = Command.sidecar('binaries/myproxy', [
    '--port',
    String(port),
  ])

  sidecar.stdout.on('data', (line) => {
    console.log('[myproxy]', line)
  })
  sidecar.stderr.on('data', (line) => {
    console.error('[myproxy]', line)
  })
  sidecar.on('close', ({ code, signal }) => {
    console.log('[myproxy] exited', { code, signal })
  })
  sidecar.on('error', (err) => {
    console.error('[myproxy] spawn error', err)
  })

  const child = await sidecar.spawn()
  return child
}

/**
 * One-shot variant: run the sidecar to completion and collect output.
 * Useful for CLI-style helpers that don't need to stream.
 *
 * Requires shell:allow-execute (not allow-spawn) in capabilities.
 */
export async function runOnce(args: Array<string>): Promise<string> {
  const cmd = Command.sidecar('binaries/myproxy', args)
  const { stdout, stderr, code } = await cmd.execute()
  if (code !== 0) {
    throw new Error(`myproxy exited ${code}: ${stderr}`)
  }
  return stdout
}

/**
 * Wire kill-on-window-close so the helper doesn't outlive the UI that
 * owns it. Requires shell:allow-kill in capabilities.
 */
export function killOnUnload(child: Child): void {
  window.addEventListener('beforeunload', () => {
    child.kill().catch(() => {
      // Already dead — harmless.
    })
  })
}

// Send input to a long-running sidecar's stdin.
//   await child.write('hello\n')
//   await child.write(new Uint8Array([0x01, 0x02]))

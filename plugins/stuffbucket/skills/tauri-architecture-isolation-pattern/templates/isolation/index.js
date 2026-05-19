// Tauri Isolation hook.
//
// Runs inside a sandboxed iframe between your frontend and Core.
// Every invoke() call routes through here BEFORE AES-GCM encryption
// and forwarding to the Rust side.
//
// Keep this file hand-written and dependency-free. Anything you import
// becomes part of the trust boundary.

window.__TAURI_ISOLATION_HOOK__ = (payload) => {
  // payload shape: { cmd, callback, error, ...commandArgs }

  // 1. Cheap structural checks
  if (typeof payload?.cmd !== 'string') {
    throw new Error('isolation: missing cmd');
  }

  // 2. Per-command validation. Whitelist, don't blacklist.
  switch (payload.cmd) {
    case 'read_file':
    case 'write_file': {
      const path = payload.path;
      if (typeof path !== 'string' || path.includes('..')) {
        throw new Error(`isolation: bad path for ${payload.cmd}`);
      }
      break;
    }

    // Add cases for every command your app exposes. An unrecognized
    // command is still forwarded by default — flip this to deny-by-default
    // if you can enumerate every command at build time.
    default:
      break;
  }

  // 3. Optional: dev-mode logging. Console output here is visible in the
  // isolation iframe's DevTools context, not the main window's.
  // console.debug('[isolation]', payload.cmd);

  return payload;
};

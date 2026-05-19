// vite.config.ts — Tauri v2 + Vite, mobile-ready.
// Drop into the project root. Pair with `tauri.conf.json#build.devUrl = "http://localhost:1420"`
// and `frontendDist = "../dist"`.
import { defineConfig } from 'vite';

// When `tauri (ios|android) dev` is run, the CLI sets TAURI_DEV_HOST to the
// machine's LAN IP so the phone webview can reach Vite. In all other cases
// it's undefined and we bind to localhost only.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  // Keep cargo output visible — don't let Vite clear the terminal.
  clearScreen: false,

  server: {
    // Must match `devUrl` in tauri.conf.json. 1420 is Tauri's scaffolder default.
    port: 1420,
    // Hard-fail if the port is taken; Tauri won't rebind.
    strictPort: true,
    // Only expose on the LAN when running `tauri ios/android dev`.
    host: host || false,
    // HMR over websockets on a separate port works around iOS/Android
    // WKWebView/Chromium quirks with HTTP upgrade.
    hmr: host
      ? { protocol: 'ws', host, port: 1421 }
      : undefined,
    watch: {
      // Don't re-bundle on Rust edits — cargo handles those.
      ignored: ['**/src-tauri/**'],
    },
  },

  // Expose TAURI_ENV_PLATFORM, TAURI_ENV_DEBUG, TAURI_ENV_ARCH, etc. to
  // the frontend as `import.meta.env.TAURI_ENV_*`.
  envPrefix: ['VITE_', 'TAURI_ENV_*'],

  build: {
    // Windows uses Edge WebView2 (Chromium 105+); macOS/Linux use WKWebView
    // (Safari 13 surface). Targeting these keeps bundles small.
    target:
      process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    // Faster, readable builds in debug; minify only for release.
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});

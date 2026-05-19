import { defineConfig } from 'vite';

// `TAURI_DEV_HOST` is injected by `tauri dev` when targeting a physical iOS
// device — it tells Vite to bind to the LAN IP instead of localhost so the
// device can reach the dev server.
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig({
  // Don't let Vite clear the terminal — Rust compile errors are easy to miss
  // when Vite repaints the screen on reload.
  clearScreen: false,

  server: {
    // MUST match `build.devUrl` in src-tauri/tauri.conf.json.
    port: 1420,
    // Tauri expects this exact port; fail loudly if it's already taken.
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // src-tauri churns on every Rust rebuild; don't trigger HMR for it.
      ignored: ['**/src-tauri/**'],
    },
  },

  // Expose VITE_* and Tauri's TAURI_ENV_* vars to `import.meta.env`.
  envPrefix: ['VITE_', 'TAURI_ENV_*'],

  build: {
    // Tauri uses Chromium on Windows (WebView2) and WebKit elsewhere.
    target:
      process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});

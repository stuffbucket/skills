// tsup.config.ts — produces:
//   dist-js/index.js     (ESM, sourcemap)
//   dist-js/index.cjs    (CJS, sourcemap)
//   dist-js/index.d.ts   (type declarations, single .d.ts works for both formats)
//
// Run: bun run build  →  tsup picks up this config automatically.

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['guest-js/index.ts'],
  outDir: 'dist-js',

  // Dual publish. Without both formats, CJS-only consumers (older bundlers,
  // some test runners) cannot require() the package.
  format: ['esm', 'cjs'],

  // Single .d.ts file shared across both formats.
  dts: true,

  sourcemap: true,
  clean: true,

  // External the Tauri API so the published bundle does NOT include its own
  // copy. The consumer app's @tauri-apps/api (declared as a peer dep) is the
  // single source of truth — bundling our own would create two
  // __TAURI_INTERNALS__ surfaces and break Channel<T> + addPluginListener.
  external: ['@tauri-apps/api', '@tauri-apps/api/core'],

  // Don't minify. The published surface is small and consumers benefit from
  // readable stack traces. App-level bundlers (Vite/webpack) will minify
  // again as part of their own production build.
  minify: false,

  // Target the lowest WebView2 / WKWebView / webkit2gtk runtime Tauri 2.x
  // supports. ES2020 is a safe baseline; bumping to ES2022 is fine if you
  // need top-level await or Error cause, but be deliberate.
  target: 'es2020',

  // Code-splitting off — single-file output simplifies the exports map and
  // matches what every other tauri-apps/plugins-workspace plugin does.
  splitting: false,
});

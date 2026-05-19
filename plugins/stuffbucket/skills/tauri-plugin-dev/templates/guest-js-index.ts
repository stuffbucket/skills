// guest-js/index.ts — published as the npm package for tauri-plugin-my-plugin.
//
// Consumers do:
//   import { greet } from '@your-scope/plugin-my-plugin';
//   const res = await greet('Ada');
//
// Replace `my-plugin` with the identifier you passed to `Builder::new(...)`
// in src/lib.rs. The string `plugin:<id>|<command>` is the IPC channel
// Tauri routes to your `invoke_handler`.

import { invoke, Channel, addPluginListener, type PluginListener } from '@tauri-apps/api/core';

const PLUGIN_ID = 'my-plugin';

/** Response shape for the `greet` command. Mirrors the Rust struct. */
export interface GreetResponse {
  message: string;
  call_count: number;
}

/** Calls the `greet` command. Throws if the plugin returns an error string. */
export async function greet(name: string): Promise<GreetResponse> {
  return await invoke<GreetResponse>(`plugin:${PLUGIN_ID}|greet`, { name });
}

// ---- Streaming example (Channel<T>) ---------------------------------------
//
// If your Rust command takes `on_progress: Channel<u32>` as a parameter,
// expose it as a callback to JS consumers:

/**
 * Example of wiring a `Channel`-based progress stream. Drop or adapt for
 * your real streaming command.
 */
export async function upload(
  url: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  const channel = new Channel<number>();
  channel.onmessage = onProgress;
  await invoke<void>(`plugin:${PLUGIN_ID}|upload`, { url, onProgress: channel });
}

// ---- Plugin event listener (for trigger(...) from mobile code) ------------
//
// Use addPluginListener when your Kotlin/Swift code emits via
// `trigger("event-name", payload)`. The consumer still needs the plugin's
// permission in their capability for this to deliver.

export async function onCameraOpen(
  handler: (payload: { open: boolean }) => void,
): Promise<PluginListener> {
  return await addPluginListener(PLUGIN_ID, 'camera', handler);
}

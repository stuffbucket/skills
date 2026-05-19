// guest-js/index.ts
//
// The public TypeScript surface of the my-plugin Tauri plugin.
// Consumers do:
//
//   import { openCamera, download, onCameraOpened } from '@my-org/plugin-my-plugin';
//
// instead of remembering the raw `plugin:my-plugin|open_camera` invoke string.

import {
  invoke,
  Channel,
  addPluginListener,
  type PluginListener,
} from '@tauri-apps/api/core';

// Centralizing the plugin-name string makes typos a single-site fix, not a
// fan-out hunt across every wrapper. The string MUST match Builder::new("...")
// on the Rust side.
const PLUGIN = 'my-plugin' as const;
const cmd = <K extends string>(name: K) => `plugin:${PLUGIN}|${name}` as const;

// ---------------------------------------------------------------------------
// Simple request/response command.
// ---------------------------------------------------------------------------

export interface CameraRequest {
  quality: number;
  allowEdit?: boolean;
  note?: string | null;
}

export interface Photo {
  path: string;
}

export async function openCamera(req: CameraRequest): Promise<Photo> {
  // The arg key `req` must match the Rust handler's parameter name:
  //   #[tauri::command] async fn open_camera(req: CameraRequest) -> Result<Photo>
  return await invoke<Photo>(cmd('open_camera'), { req });
}

export async function ping(): Promise<void> {
  return await invoke(cmd('ping'));
}

// ---------------------------------------------------------------------------
// Streaming command via Channel<T>. The wrapper hides the channel
// construction so callers just pass an onEvent handler.
// ---------------------------------------------------------------------------

export type DownloadEvent =
  | { event: 'started'; data: { id: number; total: number } }
  | { event: 'progress'; data: { id: number; bytes: number } }
  | { event: 'finished'; data: { id: number } };

export async function download(
  url: string,
  onEvent: (e: DownloadEvent) => void,
): Promise<void> {
  const channel = new Channel<DownloadEvent>();
  channel.onmessage = onEvent;
  // Rust side: async fn download(url: String, on_event: Channel<DownloadEvent>)
  // Tauri serializes the Channel<T> handle so the same instance ends up on both sides.
  await invoke(cmd('download'), { url, onEvent: channel });
}

// ---------------------------------------------------------------------------
// Plugin events (native -> JS push). The plugin's permission set must include
// the listener permission and the app's capability must grant it, or these
// listeners fail with a denial error at registration time.
// ---------------------------------------------------------------------------

export interface CameraOpenedPayload {
  path: string;
  quality: number;
}

export async function onCameraOpened(
  handler: (payload: CameraOpenedPayload) => void,
): Promise<PluginListener> {
  return await addPluginListener(PLUGIN, 'cameraOpened', handler);
}

// Permission-state probe wrappers. The Rust crate auto-implements these on
// mobile platforms (see tauri-plugin-dev-mobile-bridges). On desktop they
// typically resolve to { camera: "granted" } unconditionally.

export type PermissionState =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'prompt-with-rationale';

export interface Permissions {
  camera: PermissionState;
}

export async function checkPermissions(): Promise<Permissions> {
  return await invoke<Permissions>(cmd('check_permissions'));
}

export async function requestPermissions(): Promise<Permissions> {
  return await invoke<Permissions>(cmd('request_permissions'));
}

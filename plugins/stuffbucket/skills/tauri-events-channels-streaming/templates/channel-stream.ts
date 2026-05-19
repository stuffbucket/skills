// Tauri v2 — Channel<T> consumer for the hash_file command.
//
// Usage:
//   const sha = await hashFile('/tmp/big.iso', ({ bytesRead, totalBytes }) => {
//     setProgress(bytesRead / totalBytes);
//   });

import { invoke, Channel } from '@tauri-apps/api/core';

export type ProgressEvent =
  | { event: 'started'; data: { totalBytes: number } }
  | { event: 'chunk'; data: { bytesRead: number } }
  | { event: 'done'; data: { sha256: string } }
  | { event: 'failed'; data: { message: string } };

export type ProgressTick = {
  bytesRead: number;
  totalBytes: number;
};

export async function hashFile(
  path: string,
  onProgress: (tick: ProgressTick) => void,
): Promise<string> {
  const onEvent = new Channel<ProgressEvent>();
  let totalBytes = 0;

  return new Promise<string>((resolve, reject) => {
    onEvent.onmessage = (msg) => {
      switch (msg.event) {
        case 'started':
          totalBytes = msg.data.totalBytes;
          onProgress({ bytesRead: 0, totalBytes });
          break;
        case 'chunk':
          onProgress({ bytesRead: msg.data.bytesRead, totalBytes });
          break;
        case 'done':
          resolve(msg.data.sha256);
          break;
        case 'failed':
          reject(new Error(msg.data.message));
          break;
      }
    };

    // Fire-and-forget: the command's Promise resolves when Rust returns,
    // but the channel keeps the stream going independently. We resolve
    // off the 'done' event instead.
    invoke('hash_file', { path, onEvent }).catch(reject);
  });
}

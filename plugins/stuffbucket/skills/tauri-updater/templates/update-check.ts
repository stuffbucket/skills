// Full update-check flow: check, prompt, download with progress, relaunch.
//
// Wire this into a "Check for updates..." menu item and/or call it from your
// app's boot sequence. Safe to call repeatedly — `check()` is a no-op when no
// newer version is published.

import { check, type Update, type DownloadEvent } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export interface UpdateProgress {
  downloaded: number;
  contentLength: number | null;
  phase: 'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'done' | 'error';
  error?: string;
  update?: Pick<Update, 'version' | 'date' | 'body'>;
}

type ProgressCallback = (state: UpdateProgress) => void;

export async function checkAndInstall(onProgress: ProgressCallback = () => {}): Promise<boolean> {
  let downloaded = 0;
  let contentLength: number | null = null;

  onProgress({ downloaded: 0, contentLength: null, phase: 'checking' });

  let update: Update | null;
  try {
    update = await check();
  } catch (err) {
    onProgress({
      downloaded: 0,
      contentLength: null,
      phase: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }

  if (!update) {
    onProgress({ downloaded: 0, contentLength: null, phase: 'done' });
    return false;
  }

  onProgress({
    downloaded: 0,
    contentLength: null,
    phase: 'available',
    update: { version: update.version, date: update.date, body: update.body },
  });

  try {
    await update.downloadAndInstall((event: DownloadEvent) => {
      switch (event.event) {
        case 'Started':
          contentLength = event.data.contentLength ?? null;
          onProgress({ downloaded: 0, contentLength, phase: 'downloading' });
          break;
        case 'Progress':
          downloaded += event.data.chunkLength;
          onProgress({ downloaded, contentLength, phase: 'downloading' });
          break;
        case 'Finished':
          onProgress({ downloaded, contentLength, phase: 'installing' });
          break;
      }
    });
  } catch (err) {
    onProgress({
      downloaded,
      contentLength,
      phase: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }

  onProgress({ downloaded, contentLength, phase: 'done' });
  // On Windows the installer already terminated the app process; this line
  // is only reached on macOS/Linux.
  await relaunch();
  return true;
}

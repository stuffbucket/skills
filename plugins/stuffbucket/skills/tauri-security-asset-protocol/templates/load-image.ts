import { convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

/**
 * Prompt the user for an image, then render it through the asset protocol.
 *
 * Requires:
 *   - `app.security.assetProtocol.enable: true` with a scope covering the picked dir
 *     (or `tauri-plugin-persisted-scope` with the `protocol-asset` feature, to keep
 *     dialog-granted paths across launches).
 *   - CSP `img-src 'self' asset: https://asset.localhost` (Tauri injects these by
 *     default unless `dangerousDisableAssetCspModification` is `true`).
 */
export async function pickAndRenderImage(target: HTMLImageElement): Promise<string | null> {
  const picked = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
  });

  if (picked === null) return null;
  const absolutePath = Array.isArray(picked) ? picked[0] : picked;

  // convertFileSrc REQUIRES an absolute path. A relative path silently produces
  // a URL that resolves against the current page and 404s.
  const url = convertFileSrc(absolutePath);
  //   macOS / Linux: asset://localhost/%2F...
  //   Windows:       https://asset.localhost/%2F...

  target.src = url;
  return url;
}

/**
 * Render a video by absolute path. The asset protocol supports HTTP Range, so
 * `<video>` seeking works without buffering the whole file into memory.
 */
export function renderVideo(absolutePath: string, target: HTMLVideoElement): void {
  target.src = convertFileSrc(absolutePath);
  target.load();
}

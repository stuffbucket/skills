/**
 * Window manager helpers — open-or-focus by label, broadcast helpers,
 * close-to-hide for menubar apps.
 *
 * Requires capability permissions:
 *   core:webview:allow-create-webview-window
 *   core:window:allow-show
 *   core:window:allow-hide
 *   core:window:allow-set-focus
 *   core:window:allow-unminimize
 *   core:window:allow-close
 */

import { WebviewWindow, getAllWebviewWindows } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit } from '@tauri-apps/api/event';

export interface OpenOptions {
  url: string;
  title?: string;
  width?: number;
  height?: number;
  resizable?: boolean;
  decorations?: boolean;
  transparent?: boolean;
}

/** Open `label` if missing, otherwise show + focus the existing window. */
export async function openOrFocus(label: string, opts: OpenOptions): Promise<WebviewWindow> {
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.unminimize();
    await existing.show();
    await existing.setFocus();
    return existing;
  }

  return new Promise((resolve, reject) => {
    const win = new WebviewWindow(label, opts);
    win.once('tauri://created', () => resolve(win));
    win.once('tauri://error', (e) => reject(new Error(String(e.payload))));
  });
}

/** Close a window by label. No-op if it doesn't exist. */
export async function closeWindow(label: string): Promise<void> {
  const win = await WebviewWindow.getByLabel(label);
  if (win) await win.close();
}

/** Send an event to one specific window. */
export async function sendTo<T>(label: string, event: string, payload: T): Promise<void> {
  const win = await WebviewWindow.getByLabel(label);
  if (win) await win.emit(event, payload);
}

/** Broadcast to every window except the caller. */
export async function broadcast<T>(event: string, payload: T): Promise<void> {
  const self = getCurrentWindow().label;
  const all = await getAllWebviewWindows();
  await Promise.all(all.filter((w) => w.label !== self).map((w) => w.emit(event, payload)));
}

/** Global emit (everyone listens, including the caller). */
export async function broadcastAll<T>(event: string, payload: T): Promise<void> {
  await emit(event, payload);
}

/** Wire the OS close button to hide-instead-of-close (menubar pattern). */
export async function hideOnClose(): Promise<() => void> {
  const win = getCurrentWindow();
  return await win.onCloseRequested(async (event) => {
    event.preventDefault();
    await win.hide();
  });
}

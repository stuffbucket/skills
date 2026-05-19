/**
 * Wire the custom titlebar buttons to the Window API.
 *
 * Requires these capability permissions:
 *   core:window:allow-start-dragging
 *   core:window:allow-minimize
 *   core:window:allow-toggle-maximize
 *   core:window:allow-close
 *   core:window:allow-internal-toggle-maximize  (Win11 snap layouts)
 *
 * Call `wireTitlebar()` once after DOMContentLoaded.
 */

import { getCurrentWindow } from '@tauri-apps/api/window';

export function wireTitlebar(): void {
  const appWindow = getCurrentWindow();

  const byId = (id: string) => document.getElementById(id);

  byId('titlebar-minimize')?.addEventListener('click', () => {
    void appWindow.minimize();
  });

  byId('titlebar-maximize')?.addEventListener('click', () => {
    void appWindow.toggleMaximize();
  });

  byId('titlebar-close')?.addEventListener('click', () => {
    void appWindow.close();
  });
}

/**
 * Manual drag fallback — use this instead of `data-tauri-drag-region`
 * when only part of a region should drag (e.g. a sidebar header that
 * drags everywhere except over a collapse caret).
 */
export function wireManualDrag(elementId: string): void {
  const appWindow = getCurrentWindow();
  const el = document.getElementById(elementId);
  if (!el) return;

  el.addEventListener('mousedown', (e) => {
    if (e.buttons !== 1) return;        // left button only
    if ((e.target as HTMLElement).closest('button, input, a, [data-no-drag]')) return;
    if (e.detail === 2) {
      void appWindow.toggleMaximize();
    } else {
      void appWindow.startDragging();
    }
  });
}

// Auto-wire if loaded as a module script
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wireTitlebar);
} else {
  wireTitlebar();
}

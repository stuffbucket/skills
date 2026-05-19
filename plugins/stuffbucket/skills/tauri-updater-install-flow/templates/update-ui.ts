/**
 * update-ui.ts — full reference implementation of the Tauri v2 updater UX.
 *
 * Covers:
 *   - check() with debounce
 *   - downloadAndInstall with progress UI
 *   - skip-this-version persistence
 *   - mandatory-update gating via a "[MANDATORY]" sentinel in release notes
 *   - error states surfaced in the UI, not silently swallowed
 *
 * Wire `initUpdater(container)` into your app boot. The DOM contract:
 *   <div id="update-root">
 *     <p data-update="status"></p>
 *     <progress data-update="progress"></progress>
 *     <button data-update="install">Install</button>
 *     <button data-update="later">Later</button>
 *     <button data-update="skip">Skip this version</button>
 *   </div>
 */

import { check, type Update, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h
const SKIPPED_KEY = "updater.skippedVersion";
const LAST_CHECK_KEY = "updater.lastCheckAt";
const PENDING_KEY = "updater.pendingVersion";

type UpdaterUI = {
  status: HTMLElement;
  progress: HTMLProgressElement;
  install: HTMLButtonElement;
  later: HTMLButtonElement;
  skip: HTMLButtonElement;
};

function bindDom(root: HTMLElement): UpdaterUI {
  return {
    status: root.querySelector('[data-update="status"]')!,
    progress: root.querySelector('[data-update="progress"]')!,
    install: root.querySelector('[data-update="install"]')!,
    later: root.querySelector('[data-update="later"]')!,
    skip: root.querySelector('[data-update="skip"]')!,
  };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function shouldCheck(): boolean {
  const last = Number(localStorage.getItem(LAST_CHECK_KEY) ?? 0);
  return Date.now() - last >= CHECK_INTERVAL_MS;
}

function markChecked() {
  localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
}

function isMandatory(update: Update): boolean {
  return (update.body ?? "").includes("[MANDATORY]");
}

async function performInstall(update: Update, ui: UpdaterUI) {
  ui.install.disabled = true;
  ui.later.disabled = true;
  ui.skip.disabled = true;
  ui.progress.hidden = false;

  let downloaded = 0;
  let contentLength = 0;

  try {
    await update.downloadAndInstall((event: DownloadEvent) => {
      switch (event.event) {
        case "Started":
          contentLength = event.data.contentLength ?? 0;
          if (contentLength > 0) {
            ui.progress.max = contentLength;
            ui.progress.value = 0;
          } else {
            ui.progress.removeAttribute("max"); // indeterminate
          }
          ui.status.textContent = `Downloading ${update.version}…`;
          break;
        case "Progress":
          downloaded += event.data.chunkLength;
          if (contentLength > 0) ui.progress.value = downloaded;
          ui.status.textContent =
            contentLength > 0
              ? `${formatBytes(downloaded)} / ${formatBytes(contentLength)}`
              : `${formatBytes(downloaded)} downloaded`;
          break;
        case "Finished":
          ui.status.textContent = "Installing…";
          break;
      }
    });
    ui.status.textContent = "Update installed. Restarting…";
    localStorage.removeItem(SKIPPED_KEY);
    localStorage.removeItem(PENDING_KEY);
    await relaunch();
  } catch (err) {
    ui.status.textContent = `Update failed: ${err instanceof Error ? err.message : String(err)}`;
    ui.install.disabled = false;
    ui.later.disabled = false;
    ui.skip.disabled = false;
  }
}

async function presentUpdate(update: Update, root: HTMLElement) {
  const ui = bindDom(root);
  root.hidden = false;
  ui.progress.hidden = true;
  ui.status.textContent = `Update ${update.version} available (you're on ${update.currentVersion}).`;

  const mandatory = isMandatory(update);
  ui.skip.hidden = mandatory;
  ui.later.hidden = mandatory;

  ui.install.onclick = () => performInstall(update, ui);
  ui.later.onclick = () => {
    root.hidden = true;
  };
  ui.skip.onclick = () => {
    localStorage.setItem(SKIPPED_KEY, update.version);
    root.hidden = true;
  };

  if (mandatory) {
    // No exit. Auto-start in 3s so the user reads the notice.
    setTimeout(() => performInstall(update, ui), 3000);
  }
}

export async function initUpdater(root: HTMLElement) {
  if (!shouldCheck()) return;
  markChecked();

  try {
    const update = await check();
    if (!update) return;

    const skipped = localStorage.getItem(SKIPPED_KEY);
    if (skipped === update.version && !isMandatory(update)) return;

    await presentUpdate(update, root);
  } catch (err) {
    // Signature errors land here — they are LOUD and the user should know.
    console.error("Updater check failed:", err);
  }
}

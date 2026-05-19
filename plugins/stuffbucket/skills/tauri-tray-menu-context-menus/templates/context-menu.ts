// shell/src/context-menu.ts
//
// JS bridge: intercept native `contextmenu`, classify the click target,
// and ask Rust to pop a native menu. Always preventDefault() — otherwise
// the WebView's own menu shows on top.

import { invoke } from "@tauri-apps/api/core";

type Kind = "link" | "row" | "blank";

interface ContextPayload {
  kind: Kind;
  payload: string | null;
  selected: boolean;
}

function classify(target: EventTarget | null): ContextPayload {
  const el = target as HTMLElement | null;
  if (!el) return { kind: "blank", payload: null, selected: false };

  const link = el.closest("a[href]") as HTMLAnchorElement | null;
  if (link) {
    return { kind: "link", payload: link.href, selected: false };
  }

  const row = el.closest("[data-row-id]") as HTMLElement | null;
  if (row) {
    return {
      kind: "row",
      payload: row.dataset.rowId ?? null,
      selected: row.getAttribute("aria-selected") === "true",
    };
  }

  return { kind: "blank", payload: null, selected: false };
}

export function installContextMenu(): () => void {
  const handler = (e: MouseEvent) => {
    // Always suppress the built-in WebView menu in production.
    e.preventDefault();
    const ctx = classify(e.target);
    void invoke("show_context_menu", ctx).catch((err) => {
      // Tauri-only API — when running the UI in a plain browser (Vite-only
      // dev mode), invoke is undefined. Swallow so the page still works.
      console.debug("show_context_menu skipped:", err);
    });
  };

  window.addEventListener("contextmenu", handler);
  return () => window.removeEventListener("contextmenu", handler);
}

// Usage in main.ts:
//
//   import { installContextMenu } from "./context-menu";
//   installContextMenu();
//
// To disable the menu inside a specific element (e.g. a code editor that
// wants its own context menu), add a stopPropagation handler on that
// element's `contextmenu` event.

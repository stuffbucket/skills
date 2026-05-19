// Tauri v2 — events and channels (frontend side).
//
// Global events: subscribe with `listen`, always call the returned unlisten.
// Channels: pass a Channel<T> as a command argument, consume via .onmessage.

import { invoke, Channel } from '@tauri-apps/api/core';
import { listen, type UnlistenFn, type Event } from '@tauri-apps/api/event';

// ---------- Global event consumer ----------

interface StatusChanged {
  state: string;
  atMs: number;
}

export async function subscribeStatus(
  onChange: (s: StatusChanged) => void,
): Promise<UnlistenFn> {
  return listen<StatusChanged>('status-changed', (e: Event<StatusChanged>) => {
    onChange(e.payload);
  });
}

// Example usage with explicit teardown:
//
//   const unlisten = await subscribeStatus((s) => render(s));
//   // ...later:
//   unlisten();

// React-flavored pattern (drop into a component):
//
//   useEffect(() => {
//     let off: UnlistenFn | undefined;
//     subscribeStatus(setStatus).then((fn) => { off = fn; });
//     return () => { off?.(); };
//   }, []);

// ---------- Trigger broadcast / targeted emit from JS ----------

export function broadcastStatus(state: string): Promise<void> {
  return invoke('broadcast_status', { state });
}

export function notifyWindow(label: string, message: string): Promise<void> {
  return invoke('notify_window', { label, message });
}

// ---------- Channel-based streaming consumer ----------

export type ProgressEvent =
  | { event: 'started'; data: { total: number } }
  | { event: 'tick'; data: { done: number } }
  | { event: 'finished'; data: { ok: boolean } };

export interface ProgressHandlers {
  onStart?: (total: number) => void;
  onTick?: (done: number, total: number) => void;
  onDone?: (ok: boolean) => void;
}

export async function runTask(
  total: number,
  handlers: ProgressHandlers = {},
): Promise<void> {
  const onEvent = new Channel<ProgressEvent>();
  let lastTotal = total;

  onEvent.onmessage = (msg) => {
    switch (msg.event) {
      case 'started':
        lastTotal = msg.data.total;
        handlers.onStart?.(lastTotal);
        break;
      case 'tick':
        handlers.onTick?.(msg.data.done, lastTotal);
        break;
      case 'finished':
        handlers.onDone?.(msg.data.ok);
        break;
    }
  };

  // The channel stays open until this promise resolves and the channel is GC'd.
  await invoke('run_task', { total, onEvent });
}

// Example:
//
//   await runTask(100, {
//     onStart: (n) => console.log('starting', n),
//     onTick:  (d, t) => bar.set(d / t),
//     onDone:  (ok) => console.log('done', ok),
//   });

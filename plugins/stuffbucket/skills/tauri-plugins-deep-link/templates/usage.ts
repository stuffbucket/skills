import { onOpenUrl, getCurrent } from '@tauri-apps/plugin-deep-link';
import { listen } from '@tauri-apps/api/event';

type Route = { host: string; path: string; params: Record<string, string> };

function parse(url: string): Route {
  const u = new URL(url);
  // myapp://thing/42?ref=foo
  //   protocol = 'myapp:', host = 'thing', pathname = '/42'
  return {
    host: u.host,
    path: u.pathname.replace(/^\/+/, ''),
    params: Object.fromEntries(u.searchParams),
  };
}

function dispatch(url: string) {
  const r = parse(url);
  console.log('[deep-link]', r);
  // route into your app: r.host = section, r.path = id, r.params = query
}

export async function setupDeepLinks() {
  // Cold launch — the URL the app was opened with.
  // onOpenUrl will NOT fire for this; you must read it explicitly.
  const initial = await getCurrent();
  if (initial?.length) for (const u of initial) dispatch(u);

  // Warm: subsequent OS-side dispatches (macOS goes straight here).
  await onOpenUrl((urls) => {
    for (const u of urls) dispatch(u);
  });

  // Windows/Linux: single-instance re-emits "deep-link" on the core event bus.
  await listen<string>('deep-link', (e) => dispatch(e.payload));
}

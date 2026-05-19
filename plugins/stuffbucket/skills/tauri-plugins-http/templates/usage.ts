import { fetch } from '@tauri-apps/plugin-http';

// Standard JSON request — note the Tauri-specific extras (connectTimeout, proxy)
// are merged onto the spec Fetch RequestInit.
async function createThing(token: string) {
  const res = await fetch('https://api.example.com/v1/things', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'MyApp/1.0', // browser-forbidden header; allowed here
    },
    body: JSON.stringify({ name: 'thing' }),
    connectTimeout: 30_000,
    maxRedirections: 5,
  });

  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// Streaming download — same shape as browser fetch.
async function streamDownload(url: string, onChunk: (b: Uint8Array) => void) {
  const res = await fetch(url);
  if (!res.body) throw new Error('no body');
  const reader = res.body.getReader();
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    onChunk(value);
  }
  return total;
}

// Cookie auth (browser would refuse to set this header).
async function withCookie(session: string) {
  return fetch('https://api.example.com/v1/me', {
    headers: { 'Cookie': `session=${session}` },
  });
}

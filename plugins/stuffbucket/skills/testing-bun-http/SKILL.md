---
name: testing-bun-http
description: Test HTTP servers and routes in Bun without binding a port. Use when testing a Hono or fetch-style handler with in-memory requests, reading a streaming or server-sent-events response body, or when you genuinely need a real listening port. Covers in-memory request testing against an app fetch handler, reading response bodies via a stream reader, and the real-port exception with an ephemeral port that must be gated behind an environment variable and kept away from any file that mocks the server library. Part of the testing skill family.
---

# Testing HTTP in Bun

Default to testing HTTP handlers **in memory** — call the app's fetch-style
handler directly and never bind a port. Binding a real listener is a rare
exception with its own hazards. This skill covers the in-memory default, how
to read streaming bodies, and the narrow real-port case. It is one concern in
the testing family: load the `testing-bun-runner` skill for the env-gating hub
and the `testing-bun-mock-leaks` skill for why mocks and real ports collide.

## In-memory is the default

Most HTTP frameworks expose a fetch-style handler that takes a `Request` and
returns a `Response`. You can call it directly — no port, no network, no
socket flakiness, and it runs fast. Hono gives you `app.request(...)`, which
returns a real `Response` you can assert against.

```ts
import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { routes } from "../src/routes/widgets";

describe("widgets routes", () => {
  it("returns a widget as JSON", async () => {
    const app = new Hono();
    app.route("/widgets", routes);

    const res = await app.request("/widgets/42");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 42, name: "sprocket" });
  });
});
```

## Mount only what you test

Construct a fresh `new Hono()` in each test and mount just the sub-app or
routes under test — do not import the whole server. This keeps tests isolated
and avoids dragging in global middleware (auth, logging, rate limits) that you
did not intend to exercise. Mounting a thin slice is also how you drive
negative and auth cases: set request headers on the `init` argument and assert
the rejection.

```ts
it("rejects a missing token", async () => {
  const app = new Hono();
  app.route("/widgets", routes);

  const res = await app.request("/widgets/42", {
    headers: { authorization: "" },
  });

  expect(res.status).toBe(401);
});
```

## Reading streaming and server-sent-events bodies

For a streaming endpoint, do not await the whole body — read it incrementally
via `res.body.getReader()`, accumulate decoded chunks until a target token
appears, then cancel. Pair the reader with an `AbortController` so cleanup
also aborts the underlying request.

```ts
async function readUntil(res: Response, token: string): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (!buffer.includes(token)) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel();
  }

  return buffer;
}
```

Assert against the accumulated buffer — for SSE, check for a `data:` line or
the terminal `[DONE]` sentinel — instead of counting exact chunk boundaries,
which are not stable.

## The real-port exception

Sometimes you MUST bind a real port: proving a WebSocket upgrade completes, or
that the actual listener path works end to end. Bind an **ephemeral** port
with `serve({ port: 0 })` and read the OS-assigned address off the server
handle. This is the ONE kind of test that opens a port — keep them rare.

```ts
import { serve } from "bun";

const server = serve({ port: 0, fetch: app.fetch });
const url = `http://localhost:${server.port}`;

const res = await fetch(`${url}/widgets/42`);
expect(res.status).toBe(200);
```

## Gating real-port tests

Real-port tests are slower and process-sensitive, so skip them by default and
opt in through an environment variable. Use `describe.skipIf` so they only run
when the flag is set. Load the `testing-bun-runner` skill for the full
env-gating idiom and how the flag flows through the runner.

```ts
import { describe } from "bun:test";

describe.skipIf(!process.env.RUN_REAL_PORT)("real listener", () => {
  // ephemeral-port tests here
});
```

## Critical hazard: real ports vs mocked server libs

A real-port test CANNOT share a test process with a file that does
`mock.module` on the server library. The mock replaces the real `serve`, so
your ephemeral listener never binds — the server handle is undefined and the
test crashes when it reads the URL. Either gate and isolate the real-port test
into its own process, or, better, **inject** the server function as a
dependency instead of mocking the module. Load the `testing-bun-mock-leaks`
skill for how module mocks leak across files and why injection avoids this.

## Cleanup

Always close the server and any opened sockets in `afterAll`. Push each socket
into an array as you open it and close them all on teardown; clear any
handshake timeout once the connection settles so a dangling timer does not keep
the process alive.

```ts
import { afterAll } from "bun:test";

const sockets: WebSocket[] = [];
let handshake: ReturnType<typeof setTimeout> | undefined;

afterAll(() => {
  if (handshake) clearTimeout(handshake);
  for (const socket of sockets) socket.close();
  server.stop(true);
});
```

Leaked ports and unclosed sockets are the usual cause of a Bun test run that
passes but never exits — closing them here keeps the suite deterministic.

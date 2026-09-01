# http-tracker Plan 1 — Core Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the end-to-end core: the `shared` types/constants, the `agent` browser library (fetch/XHR capture, redaction, caps, WS transport), and the `server` (byte-LRU store, WS broadcast hub, HTTP ingestion, `http-tracker` CLI) serving a minimal timeline dashboard — so a request captured from a page shows up live on a dashboard at `localhost:4000`.

**Architecture:** Bun monorepo. The agent patches `window.fetch`/`XMLHttpRequest` in the page, builds `RequestRecord`s, redacts and caps them, and streams them over a WebSocket to the server (`/events`). The server stores records (byte-LRU), broadcasts snapshots+deltas to dashboard clients over a second WebSocket (`/ws`), and serves the built static dashboard at `/`. The CLI resolves the port and opens a browser.

**Tech Stack:** Bun 1.4+ (`bun test`, `Bun.serve`), TypeScript, Hono, `ws`, bun workspaces.

## Global Constraints

- Runtime: **Bun >= 1.4.0** (`bun` for dev/run/test, `bun test` as the runner). No Node-only APIs.
- TypeScript strict; no `any`; explicit types on all exports.
- No comments unless they explain "why" (not "what").
- Every exported symbol has an explicit type annotation.
- Server binds to **`127.0.0.1` only**; never `0.0.0.0`.
- All write/ingest paths (HTTP + WS) require the configured **token**; default `dev`.
- Response body size cap default **`500_000` bytes**; store byte cap **`128 * 1024 * 1024`**; agent ring buffer **`10_000`** records.
- Redacted sensitive header/body tokens: `authorization`, `cookie`, `set-cookie`, `x-api-key`, `x-auth-token`, `token`, `password`, `secret` (case-insensitive) → `[REDACTED]`.
- Shared record shape lives in `packages/shared`; agent, server and UI all import it.
- No git commits without the user's explicit request (this is a planning doc; commits are written as steps because that's the plan, but the executing agent must defer to the user's instruction not to auto-commit).

---

### Task 1: Monorepo scaffold + shared constants

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/constants.ts`
- Test: `packages/shared/src/constants.test.ts`

**Interfaces:**
- Produces: `packages/shared` exports `RequestRecord` (type), `CopyRequestRecord` helper type, and constants `DEFAULT_BODY_CAP`, `DEFAULT_STORE_BYTE_CAP`, `DEFAULT_RING_BUFFER_SIZE`, `DEFAULT_TOKEN`, `SENSITIVE_FIELDS`, `REDACTED_VALUE`.

- [ ] **Step 1: Root package.json**

```json
{
  "name": "http-tracker",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "test": "bun test",
    "dev:server": "bun run packages/server/src/cli.ts",
    "build": "bun run build --filter=*",
    "build:ui": "bun run --cwd packages/ui build"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: TypeScript configs**

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["bun"],
    "noEmit": true
  }
}
```

`tsconfig.json` (root):
```json
{
  "extends": "./tsconfig.base.json",
  "include": ["packages/*/src/**/*", "apps/*/src/**/*"]
}
```

`packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "./src" },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: .gitignore**

```gitignore
node_modules/
dist/
*.log
.env
packages/ui/dist/
apps/*/dist/
apps/*/.vite/
```

- [ ] **Step 4: shared package.json**

```json
{
  "name": "@http-tracker/shared",
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "types": "./src/index.ts"
}
```

- [ ] **Step 5: shared types**

`packages/shared/src/types.ts`:
```ts
export interface RequestRecord {
  requestId: string;
  seq: number;
  method: string;
  url: string;
  status: number;
  initiator?: string;
  startTime: number;
  endTime: number;
  duration: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  bodyTruncated?: boolean;
  opaque?: boolean;
  streaming?: boolean;
  bodySizeBytes?: number;
  requestHash?: string;
  strictMode?: boolean;
}
```

- [ ] **Step 6: shared constants**

`packages/shared/src/constants.ts`:
```ts
export const DEFAULT_BODY_CAP = 500_000;
export const DEFAULT_STORE_BYTE_CAP = 128 * 1024 * 1024;
export const DEFAULT_RING_BUFFER_SIZE = 10_000;
export const DEFAULT_TOKEN = "dev";
export const DEFAULT_SERVER_PORT = 4000;
export const DEFAULT_SERVER_URL = "http://localhost:4000";
export const DEFAULT_WS_URL = "ws://localhost:4000";
export const REDACTED_VALUE = "[REDACTED]";
export const DEDUP_WINDOW_MS = 150;
export const SENSITIVE_FIELDS = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
  "token",
  "password",
  "secret",
] as const;
```

`packages/shared/src/index.ts`:
```ts
export * from "./types.js";
export * from "./constants.js";
```

- [ ] **Step 7: Write the failing test**

`packages/shared/src/constants.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { DEFAULT_BODY_CAP, DEFAULT_TOKEN, REDACTED_VALUE, SENSITIVE_FIELDS } from "./constants.js";

describe("constants", () => {
  test("sensitive fields are lower-case and include authorization", () => {
    expect(SENSITIVE_FIELDS).toContain("authorization");
    expect(SENSITIVE_FIELDS).toContain("cookie");
  });
  test("body cap is 500KB", () => {
    expect(DEFAULT_BODY_CAP).toBe(500_000);
  });
  test("default token and redacted value are set", () => {
    expect(DEFAULT_TOKEN).toBe("dev");
    expect(REDACTED_VALUE).toBe("[REDACTED]");
  });
});
```

- [ ] **Step 8: Run the failing test**

Run: `bun test packages/shared/src/constants.test.ts -v`
Expected: FAIL — module `./constants.js` not found.

- [ ] **Step 9: Run the whole task's steps up to green**

Run: `bun install && bun test packages/shared/src/constants.test.ts -v`
Expected: PASS (3 tests).

---

### Task 2: Agent — redaction helpers

**Files:**
- Create: `packages/agent/package.json`
- Create: `packages/agent/tsconfig.json`
- Create: `packages/agent/src/index.ts`
- Create: `packages/agent/src/redact.ts`
- Test: `packages/agent/src/redact.test.ts`

**Interfaces:**
- Consumes: `SENSITIVE_FIELDS`, `REDACTED_VALUE` from `@http-tracker/shared`.
- Produces: `redactHeaders(headers: Record<string,string>): Record<string,string>`, `redactString(input: string): string`.

- [ ] **Step 1: agent package.json**

```json
{
  "name": "@http-tracker/agent",
  "version": "0.0.0",
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "types": "./src/index.ts",
  "dependencies": { "@http-tracker/shared": "*" }
}
```

`packages/agent/tsconfig.json` extends base, includes `src/**/*`, types `["bun", "bun"]` → leave default.

- [ ] **Step 2: Write failing tests**

`packages/agent/src/redact.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { redactHeaders, redactString } from "./redact.js";

describe("redactHeaders", () => {
  test("redacts sensitive keys case-insensitively", () => {
    const out = redactHeaders({ authorization: "Bearer x", "X-Api-Key": "k", Accept: "json" });
    expect(out.authorization).toBe("[REDACTED]");
    expect(out["X-Api-Key"]).toBe("[REDACTED]");
    expect(out.Accept).toBe("json");
  });
});

describe("redactString", () => {
  test("replaces sensitive tokens in JSON-like strings", () => {
    const out = redactString('{"token":"abc","password":"x","user":"a"}');
    expect(out).toBe('{"token":"[REDACTED]","password":"[REDACTED]","user":"a"}');
  });
  test("returns input unchanged if nothing sensitive", () => {
    expect(redactString('{"user":"a"}')).toBe('{"user":"a"}');
  });
});
```

- [ ] **Step 3: Write minimal implementation**

`packages/agent/src/redact.ts`:
```ts
import { REDACTED_VALUE, SENSITIVE_FIELDS } from "@http-tracker/shared";

const fieldSet = new Set<string>(SENSITIVE_FIELDS);

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = fieldSet.has(k.toLowerCase()) ? REDACTED_VALUE : v;
  }
  return out;
}

export function redactString(input: string): string {
  let out = input;
  for (const field of SENSITIVE_FIELDS) {
    const re = new RegExp(`("${field}":\\s*")[^"]*(")`, "gi");
    out = out.replace(re, `$1${REDACTED_VALUE}$2`);
  }
  return out;
}
```

- [ ] **Step 4: index re-export**

`packages/agent/src/index.ts`:
```ts
export * from "./redact.js";
```

- [ ] **Step 5: Run tests**

Run: `bun test packages/agent/src/redact.test.ts -v`
Expected: PASS (3 tests).

---

### Task 3: Agent — capture building (headers, body serialization, hash)

**Files:**
- Create: `packages/agent/src/capture.ts`
- Test: `packages/agent/src/capture.test.ts`

**Interfaces:**
- Consumes: `RequestRecord`, `DEFAULT_BODY_CAP` from shared; `redactHeaders`, `redactString` from `./redact.js`.
- Produces:
  - `serializeBody(input: unknown): { body?: string; truncated: boolean; size: number }`
  - `hashRequest(method: string, url: string, body?: string): string`
  - `parseHeaders(headers: Headers | Record<string,string>): Record<string,string>`

- [ ] **Step 1: Write failing tests**

`packages/agent/src/capture.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { hashRequest, parseHeaders, serializeBody } from "./capture.js";

describe("serializeBody", () => {
  test("serializes JSON", () => {
    const r = serializeBody({ a: 1 });
    expect(r.body).toBe('{"a":1}');
    expect(r.truncated).toBe(false);
  });
  test("serializes string as-is", () => {
    expect(serializeBody("x=1")).toEqual({ body: "x=1", truncated: false, size: 3 });
  });
  test("marks null body", () => {
    expect(serializeBody(undefined)).toEqual({ body: undefined, truncated: false, size: 0 });
  });
});

describe("parseHeaders", () => {
  test("reads from Headers object", () => {
    const h = new Headers({ "Content-Type": "application/json" });
    expect(parseHeaders(h)["Content-Type"]).toBe("application/json");
  });
  test("passes through plain object", () => {
    expect(parseHeaders({ A: "1" })).toEqual({ A: "1" });
  });
});

describe("hashRequest", () => {
  test("is stable and includes url", () => {
    expect(hashRequest("GET", "https://a/b")).toBe(hashRequest("GET", "https://a/b"));
    expect(hashRequest("GET", "https://a/b")).not.toBe(hashRequest("GET", "https://a/c"));
  });
  test("includes body", () => {
    expect(hashRequest("POST", "https://a/b", '{"x":1}')).not.toBe(hashRequest("POST", "https://a/b", '{"x":2}'));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test packages/agent/src/capture.test.ts -v`
Expected: FAIL — `./capture.js` not found.

- [ ] **Step 3: Write implementation**

`packages/agent/src/capture.ts`:
```ts
import { DEFAULT_BODY_CAP } from "@http-tracker/shared";

export interface BodyResult {
  body: string | undefined;
  truncated: boolean;
  size: number;
}

export function serializeBody(input: unknown, cap = DEFAULT_BODY_CAP): BodyResult {
  if (input == null) return { body: undefined, truncated: false, size: 0 };
  if (
    input instanceof FormData ||
    input instanceof ReadableStream ||
    input instanceof Blob ||
    input instanceof ArrayBuffer ||
    ArrayBuffer.isView(input)
  ) {
    const size = input instanceof Blob ? input.size : 0;
    return { body: undefined, truncated: false, size };
  }
  let text: string;
  if (typeof input === "string") {
    text = input;
  } else if (input instanceof URLSearchParams) {
    text = input.toString();
  } else if (typeof input === "object") {
    text = JSON.stringify(input);
  } else {
    return { body: undefined, truncated: false, size: 0 };
  }
  const size = text.length;
  if (size > cap) return { body: undefined, truncated: true, size };
  return { body: text, truncated: false, size };
}

export function hashRequest(method: string, url: string, body?: string): string {
  const input = `${method}\n${url}\n${body ?? ""}`;
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function parseHeaders(headers: Headers | Record<string, string>): Record<string, string> {
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((v, k) => { out[k] = v; });
    return out;
  }
  return { ...headers };
}
```

- [ ] **Step 4: Run tests**

Run: `bun test packages/agent/src/capture.test.ts -v`
Expected: PASS (6 tests).

---

### Task 4: Agent — WS transport (ring buffer, reconnect, flush-on-connect, replay)

**Files:**
- Create: `packages/agent/src/transport.ts`
- Test: `packages/agent/src/transport.test.ts`

**Interfaces:**
- Consumes: `RequestRecord`, `DEFAULT_RING_BUFFER_SIZE`, `DEFAULT_WS_URL`, `DEFAULT_TOKEN` from shared.
- Produces: class `WsTransport { constructor(opts: TransportOptions, onAck?: (n: number) => void); enqueue(r: RequestRecord): void; connect(): void; close(): void }`. Sends `{ type: "records", token, records: RequestRecord[] }`. Retains un-acked records for replay; drops oldest when ring buffer exceeds size.

- [ ] **Step 1: Write failing tests**

`packages/agent/src/transport.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { WsTransport } from "./transport.js";

class FakeSocket {
  sent: string[] = [];
  open = false;
  closeCalls = 0;
  send(data: string) { this.sent.push(data); }
  close() { this.closeCalls++; }
}

const makeOpts = () => ({
  url: "ws://localhost:4000",
  token: "dev",
  connect: undefined as unknown,
});

describe("WsTransport", () => {
  test("queues records and flushes on connect", () => {
    const t = new WsTransport(makeOpts() as never);
    const a = { requestId: "1", seq: 1 } as never;
    t.enqueue(a);
    const sock = new FakeSocket();
    sock.readyState = 1; // mimic WebSocket.OPEN
    (t as any).socket = sock;
    (t as any).flush();
    expect(sock.sent[0]).toContain('"requestId":"1"');
  });
  test("drops oldest when over ring buffer size", () => {
    const t = new WsTransport({ ...makeOpts(), ringSize: 2 } as never);
    t.enqueue({ requestId: "1" } as never);
    t.enqueue({ requestId: "2" } as never);
    t.enqueue({ requestId: "3" } as never);
    expect(t["buffer"].length).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test packages/agent/src/transport.test.ts -v`
Expected: FAIL — `./transport.js` not found.

- [ ] **Step 3: Write implementation**

`packages/agent/src/transport.ts`:
```ts
import { DEFAULT_RING_BUFFER_SIZE, DEFAULT_TOKEN, DEFAULT_WS_URL, type RequestRecord } from "@http-tracker/shared";

export interface TransportOptions {
  url?: string;
  token?: string;
  ringSize?: number;
}

export class WsTransport {
  private url: string;
  private token: string;
  private ringSize: number;
  private buffer: RequestRecord[] = [];
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  readonly onAck: (n: number) => void;

  constructor(opts: TransportOptions, onAck: (n: number) => void = () => {}) {
    this.url = opts.url ?? DEFAULT_WS_URL;
    this.token = opts.token ?? DEFAULT_TOKEN;
    this.ringSize = opts.ringSize ?? DEFAULT_RING_BUFFER_SIZE;
    this.onAck = onAck;
  }

  enqueue(record: RequestRecord): void {
    this.buffer.push(record);
    if (this.buffer.length > this.ringSize) {
      this.buffer.splice(0, this.buffer.length - this.ringSize);
    }
    this.flush();
  }

  connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) return;
    const sock = new WebSocket(this.url);
    this.socket = sock;
    sock.onopen = () => this.flush();
    sock.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { type: string; count?: number };
        if (msg.type === "acked" && typeof msg.count === "number") {
          this.buffer.splice(0, msg.count);
          this.onAck(msg.count);
        }
      } catch {}
    };
    sock.onclose = () => this.scheduleReconnect();
    sock.onerror = () => sock.close();
  }

  close(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = null;
  }

  private flush(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.buffer.length === 0) return;
    this.socket.send(JSON.stringify({ type: "records", token: this.token, records: this.buffer }));
  }

  private scheduleReconnect(): void {
    this.socket = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), 1000);
  }
}
```

- [ ] **Step 4: Run tests**

Run: `bun test packages/agent/src/transport.test.ts -v`
Expected: PASS (2 tests).

---

### Task 5: Agent — fetch + XHR patches

**Files:**
- Create: `packages/agent/src/patch-fetch.ts`
- Create: `packages/agent/src/patch-xhr.ts`
- Create: `packages/agent/src/index.ts` (update)
- Test: `packages/agent/src/patch.test.ts`

**Interfaces:**
- Consumes: `RequestRecord`, `DEFAULT_BODY_CAP`, `REDACTED_VALUE` from shared; `serializeBody`, `hashRequest`, `parseHeaders` from `./capture.js`; `redactHeaders`, `redactString` from `./redact.js`; `WsTransport` from `./transport.js`.
- Produces: `patchFetch(transport: WsTransport): () => void` (returns restore fn), `patchXhr(transport: WsTransport): () => void`, `initAgent(opts?: { serverUrl?: string; token?: string; strictMode?: boolean }): void`.

- [ ] **Step 1: Write failing tests** — use happy-dom for `window`/`XMLHttpRequest` unless absent; set `// @happy-dom` at top of file.

`packages/agent/src/patch.test.ts`:
```ts
// @happy-dom
import { describe, expect, test } from "bun:test";
import { patchFetch } from "./patch-fetch.js";

describe("patchFetch", () => {
  test("patches window.fetch and restores", () => {
    const original = window.fetch;
    const restore = patchFetch({ enqueue: () => {} } as never);
    expect(window.fetch).not.toBe(original);
    restore();
    expect(window.fetch).toBe(original);
  });
});
```

- [ ] **Step 2: Run to verify failure** (fragment present, mock transport with `enqueue`).

Run: `bun test packages/agent/src/patch.test.ts -v`
Expected: FAIL — `./patch-fetch.js` not found.

- [ ] **Step 3: Write implementation**

`packages/agent/src/patch-fetch.ts`:
```ts
import { type RequestRecord, DEFAULT_BODY_CAP } from "@http-tracker/shared";
import { hashRequest, parseHeaders, serializeBody } from "./capture.js";
import { redactHeaders, redactString } from "./redact.js";

let seqCounter = 0;

interface FetchSink { enqueue(r: RequestRecord): void }

export function patchFetch(sink: FetchSink): () => void {
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = (init?.method ?? "GET").toUpperCase();
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const startTime = Date.now();
    const bodyResult = serializeBody(init?.body);
    const requestHash = hashRequest(method, url, bodyResult.body);
    const seq = ++seqCounter;

    return original(input, init).then(async (res) => {
      const endTime = Date.now();
      const bodySize = res.headers.get("content-length");
      let responseBody: string | undefined;
      let truncated = false;
      let opaque = false;
      let streaming = false;
      try {
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("text/event-stream")) {
          streaming = true;
        } else if (bodySize && Number(bodySize) > DEFAULT_BODY_CAP) {
          truncated = true;
        } else if (res.body) {
          responseBody = String(await res.clone().text());
          if (responseBody.length > DEFAULT_BODY_CAP) { responseBody = undefined; truncated = true; }
        }
      } catch {
        opaque = true;
      }
      const record: RequestRecord = {
        requestId: crypto.randomUUID(),
        seq,
        method,
        url,
        status: res.status,
        startTime,
        endTime,
        duration: endTime - startTime,
        requestHeaders: redactHeaders(parseHeaders(init?.headers ?? {})),
        responseHeaders: redactHeaders(parseHeaders(res.headers)),
        requestBody: bodyResult.body ? redactString(bodyResult.body) : undefined,
        responseBody: responseBody ? redactString(responseBody) : undefined,
        bodyTruncated: truncated || bodyResult.truncated,
        opaque,
        streaming,
        bodySizeBytes: responseBody ? responseBody.length : Number(bodySize ?? 0) || 0,
        requestHash,
      };
      sink.enqueue(record);
      return res;
    });
  };
  return () => { window.fetch = original as typeof window.fetch; };
}
```

`packages/agent/src/patch-xhr.ts`:
```ts
import { type RequestRecord } from "@http-tracker/shared";
import { hashRequest, parseHeaders, serializeBody } from "./capture.js";
import { redactHeaders, redactString } from "./redact.js";

interface XhrSink { enqueue(r: RequestRecord): void }

export function patchXhr(sink: XhrSink): () => void {
  const Original = window.XMLHttpRequest;
  let seqCounter = 0;
  const Patched = class extends Original {
    private seq = ++seqCounter;
    private start = 0;
    private url = "";
    private method = "";
    private bodyResult = { body: undefined as string | undefined, truncated: false, size: 0 };
    open(method: string, url: string | URL): void {
      this.method = method.toUpperCase();
      this.url = typeof url === "string" ? url : url.toString();
      this.start = Date.now();
      super.open(method, url);
    }
    send(body?: Document | XMLHttpRequestBodyInit | null): void {
      const pending = serializeBody(body);
      this.bodyResult = pending;
      this.addEventListener("loadend", () => {
        const end = Date.now();
        const record: RequestRecord = {
          requestId: crypto.randomUUID(),
          seq: this.seq,
          method: this.method,
          url: this.url,
          status: this.status,
          startTime: this.start,
          endTime: end,
          duration: end - this.start,
          requestHeaders: {},
          responseHeaders: redactHeaders(parseHeaders(this.getAllResponseHeaders() ? new Headers(this.getAllResponseHeaders()) : {})),
          requestBody: pending.body ? redactString(pending.body) : undefined,
          responseBody: redactString(String(this.responseText ?? "")),
          bodyTruncated: pending.truncated,
          bodySizeBytes: (this.responseText ?? "").length,
          requestHash: hashRequest(this.method, this.url, pending.body),
        };
        sink.enqueue(record);
      });
      super.send(body);
    }
  } as unknown as typeof XMLHttpRequest;

  window.XMLHttpRequest = Patched;
  return () => { window.XMLHttpRequest = Original; };
}
```

`packages/agent/src/index.ts` (replace):
```ts
export * from "./redact.js";
export * from "./capture.js";
export * from "./transport.js";
export { patchFetch } from "./patch-fetch.js";
export { patchXhr } from "./patch-xhr.js";
```

`packages/agent/src/init-agent.ts` (new file):
```ts
import { DEFAULT_SERVER_URL, DEFAULT_TOKEN } from "@http-tracker/shared";
import { patchFetch } from "./patch-fetch.js";
import { patchXhr } from "./patch-xhr.js";
import { WsTransport } from "./transport.js";

export interface AgentOptions {
  serverUrl?: string;
  token?: string;
  strictMode?: boolean;
}

export function initAgent(opts: AgentOptions = {}): (() => void)[] {
  const wsUrl = (opts.serverUrl ?? DEFAULT_SERVER_URL).replace(/^http/, "ws").replace(/\/$/, "");
  const transport = new WsTransport({ url: wsUrl, token: opts.token ?? DEFAULT_TOKEN });
  transport.connect();
  const restoreFetch = patchFetch({ enqueue: (r) => transport.enqueue(r) });
  const restoreXhr = patchXhr({ enqueue: (r) => transport.enqueue(r) });
  return [restoreFetch, restoreXhr];
}
```

- [ ] **Step 4: Run tests**

Run: `bun test packages/agent/src/patch.test.ts -v`
Expected: PASS (1 test).

---

### Task 6: Server — byte-LRU store with snapshot/clear

**Files:**
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/src/store.ts`
- Test: `packages/server/src/store.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_STORE_BYTE_CAP`, `DEFAULT_BODY_CAP` from shared.
- Produces: `class RequestStore { constructor(opts?: { byteCap?: number }); add(r: RequestRecord): void; snapshot(): RequestRecord[]; clear(): void; get sizeInBytes(): number; count(): number }`. Evicts oldest by `seq` when exceeding `byteCap`.

- [ ] **Step 1: Write failing tests**

`packages/server/src/store.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { RequestStore } from "./store.js";

const mk = (seq: number, size: number) => ({
  requestId: String(seq), seq, method: "GET", url: `u${seq}`, status: 200,
  startTime: 1, endTime: 1, duration: 0, bodySizeBytes: size,
}) as never;

describe("RequestStore", () => {
  test("adds and snapshots in insertion order", () => {
    const s = new RequestStore({ byteCap: 1000 });
    s.add(mk(1, 10));
    s.add(mk(2, 10));
    expect(s.count()).toBe(2);
    expect(s.snapshot().map((r) => r.seq)).toEqual([1, 2]);
  });
  test("evicts oldest when over byte cap", () => {
    const s = new RequestStore({ byteCap: 100 });
    s.add(mk(1, 60));
    s.add(mk(2, 60));
    expect(s.count()).toBe(1);
    expect(s.snapshot()[0].seq).toBe(2);
  });
  test("clear empties store", () => {
    const s = new RequestStore({ byteCap: 1000 });
    s.add(mk(1, 10));
    s.clear();
    expect(s.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test packages/server/src/store.test.ts -v`
Expected: FAIL — `./store.js` not found.

- [ ] **Step 3: Write implementation**

`packages/server/src/store.ts`:
```ts
import { DEFAULT_STORE_BYTE_CAP, type RequestRecord } from "@http-tracker/shared";

export interface StoreOptions { byteCap?: number }

export class RequestStore {
  private records = new Map<number, RequestRecord>();
  private byteCap: number;
  private bytes = 0;

  constructor(opts: StoreOptions = {}) {
    this.byteCap = opts.byteCap ?? DEFAULT_STORE_BYTE_CAP;
  }

  add(r: RequestRecord): void {
    const size = this.sizeOf(r);
    this.records.set(r.seq, r);
    this.bytes += size;
    while (this.bytes > this.byteCap && this.records.size > 1) {
      const sorted = this.snapshot();
      const oldest = sorted[0];
      this.records.delete(oldest.seq);
      this.bytes -= this.sizeOf(oldest);
    }
  }

  snapshot(): RequestRecord[] {
    return [...this.records.values()].sort((a, b) => a.seq - b.seq);
  }

  clear(): void {
    this.records.clear();
    this.bytes = 0;
  }

  count(): number { return this.records.size; }
  get sizeInBytes(): number { return this.bytes; }

  private sizeOf(r: RequestRecord): number {
    return (r.bodySizeBytes ?? 0) + (r.responseBody?.length ?? 0);
  }
}
```

- [ ] **Step 4: Run tests**

Run: `bun test packages/server/src/store.test.ts -v`
Expected: PASS (3 tests).

---

### Task 7: Server — HTTP/WS hub, token auth, static serving

**Files:**
- Create: `packages/server/src/server.ts`
- Test: `packages/server/src/server.test.ts`
- Create: `packages/server/public/index.html` (minimal timeline)
- Create: `packages/server/public/app.js`

**Interfaces:**
- Consumes: `RequestStore`, `DEFAULT_TOKEN`.
- Produces: `startServer(opts: { port?: number; host?: string; token?: string; store?: RequestStore }): Promise<{ port: number; close(): Promise<void> }>`. Serves `POST /events` (batch ingest), `WS /events` (agent ingest via same shape), `WS /ws` (dashboard), static `/`, and broadcasts snapshot+deltas. `host` fixed to `127.0.0.1`.
- Mark: the WS broadcast hub reads agent records via `records` message type, extracts stored records, and sends `{type:"snapshot",records}` on dashboard connect and `{type:"record",record}` per new record.

- [ ] **Step 1: Write failing integration test**

`packages/server/src/server.test.ts`:
```ts
import { afterAll, describe, expect, test } from "bun:test";
import { startServer } from "./server.js";

let srv: Awaited<ReturnType<typeof startServer>>;
let base = "";

describe("server", () => {
  test("starts and serves index", async () => {
    srv = await startServer({ port: 0, token: "dev" });
    base = `http://127.0.0.1:${srv.port}`;
    const res = await fetch(base + "/");
    expect(res.status).toBe(200);
  });
  test("ingests records via POST /events", async () => {
    const body = { token: "dev", records: [{ requestId: "1", seq: 1, method: "GET", url: "/x", status: 200, startTime: 1, endTime: 1, duration: 0 }] };
    const res = await fetch(base + "/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    expect(res.status).toBe(200);
  });
  afterAll(async () => { if (srv) await srv.close(); });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test packages/server/src/server.test.ts -v`
Expected: FAIL — `./server.js` not found.

- [ ] **Step 3: Write implementation**

`packages/server/src/server.ts`:
```ts
import { Hono } from "hono";
import { DEFAULT_SERVER_PORT, DEFAULT_TOKEN, type RequestRecord } from "@http-tracker/shared";
import { RequestStore } from "./store.js";

export interface ServerOptions { port?: number; host?: string; token?: string; store?: RequestStore }

export function startServer(opts: ServerOptions = {}): Promise<{ port: number; close: () => Promise<void> }> {
  const host = "127.0.0.1";
  const token = opts.token ?? DEFAULT_TOKEN;
  const store = opts.store ?? new RequestStore();
  const dashboards = new Set<WebSocket>();
  const app = new Hono();

  app.post("/events", async (c) => {
    const j = (await c.req.json()) as { token?: string; records?: RequestRecord[] };
    if (j.token !== token) return c.json({ error: "unauthorized" }, 401);
    for (const r of j.records ?? []) store.add(r);
    broadcast({ type: "records", records: j.records ?? [] });
    return c.json({ ok: true });
  });

  app.get("/", async () => {
    const file = Bun.file(new URL("../public/index.html", import.meta.url).pathname);
    return new Response(await file.text(), { headers: { "content-type": "text/html" } });
  });

  function broadcast(payload: { type: string; records?: RequestRecord[] }): void {
    const data = JSON.stringify(payload);
    for (const d of dashboards) { try { d.send(data); } catch {} }
  }

  const server = Bun.serve({
    port: opts.port ?? DEFAULT_SERVER_PORT,
    hostname: host,
    fetch(req, srv) {
      const url = new URL(req.url);
      if (url.pathname === "/ws") {
        if (url.searchParams.get("token") !== token) return new Response("unauthorized", { status: 401 });
        if (srv.upgrade(req)) return new Response(undefined, { status: 101 });
        return new Response("upgrade failed", { status: 400 });
      }
      return app.fetch(req);
    },
    websocket: {
      open(ws) {
        ws.send(JSON.stringify({ type: "snapshot", records: store.snapshot() }));
        dashboards.add(ws as unknown as WebSocket);
      },
      message(ws, message) {
        const msg = JSON.parse(String(message)) as { type?: string; token?: string; records?: RequestRecord[] };
        if (msg.type === "records") {
          if (msg.token !== token) return;
          for (const r of msg.records ?? []) store.add(r);
          ws.send(JSON.stringify({ type: "acked", count: msg.records?.length ?? 0 }));
          broadcast({ type: "records", records: msg.records ?? [] });
        } else if (msg.type === "clear") {
          if (msg.token !== token) return;
          store.clear();
          broadcast({ type: "clear" });
        }
      },
      close(ws) {
        dashboards.delete(ws as unknown as WebSocket);
      },
    },
  });

  return Promise.resolve({
    port: server.port as number,
    close: () => new Promise<void>((resolve) => { server.stop(); resolve(); }),
  });
}
```

- [ ] **Step 4: Write minimal dashboard**

`packages/server/public/index.html`:
```html
<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>http-tracker</title><style>
    body { font-family: system-ui, sans-serif; background: #0b0e14; color: #e6e6e6; margin: 0; padding: 1rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid #1d2430; font-size: 13px; }
    td.m { font-weight: 700; }
    .GET{color:#4ad295} .POST{color:#54a7ff} .PUT{color:#c07af0} .DELETE{color:#ff6b6b} .OTHER{color:#cfd3dc}
  </style></head>
  <body>
    <h1>http-tracker</h1>
    <button id="clear">Clear</button>
    <table><thead><tr><th>T</th><th>Method</th><th>URL</th><th>Status</th><th>ms</th></tr></thead><tbody id="rows"></tbody></table>
    <script src="./app.js"></script>
  </body>
</html>
```

`packages/server/public/app.js`:
```js
const rows = document.getElementById("rows");
const token = new URLSearchParams(location.search).get("token") ?? "dev";
const ws = new WebSocket(`ws://127.0.0.1:${location.port}/ws?token=${token}`);
let t = 0;

ws.onopen = () => console.log("connected");
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.type === "snapshot") msg.records.forEach(render);
  else if (msg.type === "records") msg.records.forEach(render);
  else if (msg.type === "clear") rows.innerHTML = "";
};

function render(r) {
  const tr = document.createElement("tr");
  const mk = (x) => { const t = document.createElement("td"); t.textContent = x; return t; };
  const m = document.createElement("td"); m.className = "m " + (["GET","POST","PUT","DELETE"].includes(r.method) ? r.method : "OTHER"); m.textContent = r.method;
  tr.append(mk(new Date(r.startTime).toLocaleTimeString()), m, mk(r.url), mk(String(r.status)), mk(String(r.duration)));
  rows.append(tr);
}

document.getElementById("clear").onclick = () => ws.send(JSON.stringify({ type: "clear", token }));
```

- [ ] **Step 5: Run tests**

Run: `bun test packages/server/src/server.test.ts -v`
Expected: PASS (2 tests). If the Hono websocket setup fails typecheck, adjust to the `upgradeWebSocket` helper from `hono/upgrade` as noted.

---

### Task 8: Server — CLI (`http-tracker`)

**Files:**
- Create: `packages/server/src/cli.ts`
- Create: `packages/server/package.json` (add `bin`)
- Test: `packages/server/src/cli.test.ts`

**Interfaces:**
- Consumes: `startServer`, `DEFAULT_SERVER_PORT`, `DEFAULT_TOKEN`.
- Produces: CLI with flags `--port`, `--token`, `--no-open`; prints the dashboard URL; opens browser unless `--no-open`.

- [ ] **Step 1: Write test for arg parsing**

`packages/server/src/cli.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { parseArgs } from "./cli.js";

describe("cli parseArgs", () => {
  test("defaults", () => {
    expect(parseArgs([])).toEqual({ port: 4000, token: "dev", open: true });
  });
  test("overrides", () => {
    expect(parseArgs(["--port", "5000", "--token", "abc", "--no-open"])).toEqual({ port: 5000, token: "abc", open: false });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test packages/server/src/cli.test.ts -v`
Expected: FAIL — `./cli.js` not found.

- [ ] **Step 3: Write implementation**

`packages/server/src/cli.ts`:
```ts
export interface CliArgs { port: number; token: string; open: boolean }

export function parseArgs(argv: string[]): CliArgs {
  let port = 4000;
  let token = "dev";
  let open = true;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--port") port = Number(argv[++i]);
    else if (a === "--token") token = argv[++i] ?? token;
    else if (a === "--no-open") open = false;
    else if (a === "--help") {
      console.log("http-tracker [--port 4000] [--token dev] [--no-open]");
      process.exit(0);
    }
  }
  return { port, token, open };
}

async function main() {
  const { port, token, open } = parseArgs(process.argv.slice(2));
  const { startServer } = await import("./server.js");
  const { port: bound } = await startServer({ port, token });
  const url = `http://127.0.0.1:${bound}/?token=${token}`;
  console.log(`http-tracker listening at ${url}`);
  if (open) {
    const { default: openBrowser } = await import("open");
    openBrowser(url).catch(() => {});
  }
}

if (import.meta.main) main();
```

`packages/server/package.json` adds:
```json
{ "bin": { "http-tracker": "./src/cli.ts" } }
```
Dependency `open` (Bun-compatible) or use Bun's built-in `Bun.spawn(["xdg-open", url])`. Prefer the built-in approach to avoid a dependency; update the code:

```ts
if (open) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  Bun.spawn([cmd, url]);
}
```

- [ ] **Step 4: Run tests**

Run: `bun test packages/server/src/cli.test.ts -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Smoke run server**

Run: `bun run packages/server/src/cli.ts --port 4000 --no-open`
Expected: prints `http-tracker listening at http://127.0.0.1:4000/?token=dev`.

---

### Task 9: End-to-end smoke test

**Files:**
- Create: `packages/server/src/e2e.test.ts`

**Interfaces:**
- Consumes: `startServer`, `initAgent`-shaped transport, WS dashboard client.

- [ ] **Step 1: Write test** — start server on a random port, connect a dashboard WS client, then POST a record, assert the dashboard receives a `records` message.

`packages/server/src/e2e.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { startServer } from "./server.js";

let srv: Awaited<ReturnType<typeof startServer>>;
let base = "";
let wsUrl = "";

beforeAll(async () => {
  srv = await startServer({ port: 0, token: "dev" });
  base = `http://127.0.0.1:${srv.port}`;
  wsUrl = `ws://127.0.0.1:${srv.port}/ws?token=dev`;
});
afterAll(async () => { if (srv) await srv.close(); });

describe("e2e", () => {
  test("dashboard receives snapshot on connect", async () => {
    const ws = new WebSocket(wsUrl);
    const msg = await new Promise<Record<string, unknown>>((resolve, reject) => {
      ws.onopen = () => { ws.send(JSON.stringify({ type: "clear", token: "dev" })); };
      ws.onmessage = (ev) => { const m = JSON.parse(String(ev.data)); if (m.type === "snapshot") resolve(m); };
      ws.onerror = reject;
    });
    expect(msg.type).toBe("snapshot");
    ws.close();
  });
  test("dashboard receives a record posted over HTTP", async () => {
    const ws = new WebSocket(wsUrl);
    const seen = new Promise<Record<string, unknown>>((resolve, reject) => {
      ws.onmessage = (ev) => { const m = JSON.parse(String(ev.data)); if (m.type === "records") resolve(m); };
      ws.onerror = reject;
    });
    await new Promise<void>((res) => { ws.onopen = () => res(); });
    await fetch(base + "/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: "dev", records: [{ requestId: "x", seq: 100, method: "GET", url: "/e2e", status: 200, startTime: 1, endTime: 1, duration: 0 }] }) });
    const m = await seen;
    expect((m.records as Array<{ url: string }>)[0]?.url).toBe("/e2e");
    ws.close();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `bun test packages/server/src/e2e.test.ts -v`
Expected: PASS (2 tests).

- [ ] **Step 3: Full suite**

Run: `bun test -v`
Expected: all tests green across `shared`/`agent`/`server`.

---

### Plan summary / handoff

- Deliverable of Plan 1: a runnable `http-tracker` server (`bun packages/server/src/cli.ts --no-open`) that ingests records from an agent over HTTP/WS and shows them live on a static timeline dashboard at `127.0.0.1:4000`. All core packages unit/integration tested with Bun.

- **Plan 2 (next):** replace the static dashboard with the `packages/ui` React + ReactFlow graph — time-ordered nodes left→right, conservative/opt-in trigger edges, filters, inspect panel. Consumes `snapshot`/`records`/`clear` WS messages plus `RequestRecord` from `@http-tracker/shared`.

- **Plan 3 (next):** Strict-Mode dedup (server-side `groupKey`/`dupRole` + build-time `__HTTP_TRACKER_STRICT_MODE__`) and the Vite plugin auto-inject + source scan, plus `react-app`/`vue-app`/`solid-app` and Playwright E2E asserting a merged `×2` node.

# http-tracker — Design Spec

> **Historical:** This design describes the original Bun/Hono CLI architecture. The current implementation uses a Node-compatible server started and stopped by the Vite plugin; see `README.md` and `AGENTS.md`.

Date: 2026-09-01
Status: Draft (pending user review)

---

## 1. Goal

A developer-experience (DX) tool that captures the HTTP requests a frontend app makes (the same traffic you see in the browser Network panel), relays them to a sidecar dashboard running on a **different port**, and renders them as a JSON-Crack-style node graph ordered by time. When React Strict Mode causes a request to fire twice, the tool collapses the duplicates into a single clearly-flagged node so the developer immediately understands it is a dev-mode double-invoke, not a real bug.

The tool is a **diagnostic** — it flags expected duplicate requests; it does not prevent them. Both Strict-Mode requests genuinely reach the network.

## 2. Non-goals

- No TLS / active interception of traffic the page itself cannot read.
- No request replay.
- No auth / multi-user / remote persistence. Local-first dev tool.
- No permanent log store; server holds recent history in memory only.
- No cross-application correlation.
- No Angular target in this iteration (Vite-only targets: React, Vue, SolidJS).

## 3. Capture-fidelity caveat (devtools parity is limited)

Devtools is CORS-exempt; page JavaScript is **not**. For any cross-origin call the app itself cannot read, the agent gets **no response body**, while Devtools shows it. The tool is therefore strictly *less* than the Network panel:

- Capture the response body only where the page can actively read it.
- Fall back to metadata-only for opaque / cross-origin responses.
- Document this limitation; do not claim Devtools parity.

## 4. Architecture

Bun monorepo with three shipped packages plus build tooling and sample apps.

```
http-tracker/
  packages/
    agent/    # browser lib: patches fetch + XHR, pushes events over WebSocket
    server/   # Bun + Hono + ws: WS hub, in-memory store, serves dashboard, CLI
    ui/       # React + Vite + ReactFlow: the dashboard
    plugin/   # Vite plugin exposing httpTracker(): auto-inject agent + StrictMode flag
  apps/
    react-app/  # Vite + React, <StrictMode> on. Primary E2E target.
    vue-app/    # Vite + Vue 3. Verifies plugin into another Vite SFC framework.
    solid-app/  # Vite + SolidJS. Verifies plugin + framework-agnostic agent.
```

Data flow:

```
[Tracked app]                          [server: localhost:4000]              [dashboard UI]
 agent patches fetch/XHR  ──WS──▶  Hono + ws hub ──▶ in-memory store ──▶  ReactFlow graph
  captures RequestRecord                         │ broadcast            (JSON-Crack style)
                                 served dashboard at / ◀── same port ──┘
```

The dashboard and the ingestion endpoint share `localhost:4000`, which is deliberately different from the app's port (e.g. app = 3000). The agent reaches the server via WebSocket; the developer opens `http://localhost:4000` to view the graph.

## 5. Package design

### 5.1 `packages/agent` (browser)

Framework-agnostic. Patches `window.fetch` and `XMLHttpRequest` to wrap send/response and emit `RequestRecord` objects.

Everything below this line is optional.

**Capture per request:**

```ts
interface RequestRecord {
  requestId: string        // monotonic id assigned by agent
  seq: number              // global increasing sequence across the session (ordering)
  method: string           // GET, POST, ...
  url: string              // full URL
  status: number           // HTTP status (0 if never resolved)
  initiator?: string       // optional tag (e.g. component name) when available
  startTime: number        // epoch ms
  endTime: number          // epoch ms
  duration: number         // ms
  requestHeaders?: Record<string, string>
  responseHeaders?: Record<string, string>
  requestBody?: string      // serialized text/JSON/urlencoded only (see limits)
  responseBody?: string     // size-capped + redacted
  bodyTruncated?: boolean
  opaque?: boolean          // true => body unreadable (CORS/opaque)
  streaming?: boolean       // true => streamed response, body not captured
  bodySizeBytes?: number
  requestHash?: string      // stable hash (method+url+body-when-content) for dedup
}
```

**Capture limits / behavior:**

- Response body **size-capped** (default `500_000` bytes). Beyond cap → store nothing, set `bodyTruncated = true`, record `bodySizeBytes`.
- **Redaction** of sensitive request/response headers and body fields: `authorization`, `cookie`, `set-cookie`, `x-api-key`, `token`, `password`, `secret`. Redacted value → `"[REDACTED]"`. Header keys matched case-insensitively.
- **Streaming** (`response.body` is a stream, or content-length unset/SSE): do not read the body; set `streaming = true`. Never block on a stream read.
- **Request body** hashing/serialization only for safe, re-readable forms: text, `URLSearchParams`, JSON. Skip `FormData`, `Blob`, `ReadableStream` (set `opaque`/`bodyTruncated` and omit `requestBody`/`requestHash` where not safely derivable).
- **Opaque responses**: if the page cannot read the body (CORS), set `opaque = true`, keep metadata, omit body.

**Transport:**

- Buffers `RequestRecord`s in a ring buffer (default `10_000`).
- Opens a WebSocket to the server and flushes queued + live records. **Queue must be flushed on connect** even for requests made before the socket was ready.
- Reconnect with backoff; on reconnect, replay un-acked buffered records so nothing is lost if the server restarts.
- Configurable server URL via env/config injected by the plugin (default `ws://localhost:4000`).
- Sends a **token** on connect (injected by the plugin); the server rejects connections without a valid token.

### 5.2 `packages/server` (Bun + Hono + ws)

- Bun + Hono HTTP server + native `ws` upgrade.
- Ingestion endpoint `POST/WS /events` receives `RequestRecord`s. All write paths require the injected token.
- **Binds to `127.0.0.1` only** (never `0.0.0.0`).
- **In-memory store:** object keyed by `seq`/`requestId`, evicted by **total bytes** LRU (not record count) with default cap `128 MB`. Evict oldest by `seq` when over cap.
- **Dedup resolution runs server-side** as records arrive (keeps the agent light). See §7.
- **Ordering: `seq` is the source of truth**. Nodes are laid out left→right by `seq` (a.k.a. start time).
- Serves the built `ui` dashboard as static files at `/`.
- **Dashboard connect:** sends a snapshot of current history, then live deltas (snapshot + delta, not full re-broadcast of the whole buffer on every event).
- **CLI** `http-tracker`:
  - `http-tracker [--port 4000] [--no-open]`
  - Opens the dashboard in the default browser unless `--no-open`.
  - `--port` configurable.

### 5.3 `packages/ui` (React + Vite + ReactFlow)

- React + TypeScript + ReactFlow.
- Each `RequestRecord` → a node: **method colour-coding** (GET green, POST blue, PUT/other purple, DELETE red, non-200 status indicator), label = method + URL path, status chip.
- **Ordering:** nodes placed left→right by `seq`. The time axis is the primary, reliable truth.
- **Trigger edges (conservative + opt-in):** an edge is drawn only when we can attribute one request to another — a request initiated *synchronously or within the same microtask turn* while a previous request's response was being handled (e.g. a fetch fired from the `.then` of another response). Edges are best-effort and can be toggled off; they never replace the timeline.
- **Strict-Mode dedup display:** duplicates are collapsed into a single visual node with a `×2`/`×3` badge and, when Strict Mode is confirmed, the label `×2 — likely Strict Mode (dev double-mount)`. Expanding reveals the individual requests; the canonical/survivor vs duplicates are distinguishable (see §7). Both original and duplicate are present in the data — nothing is discarded.
- **Controls:** filter by method / status / URL substring, search, pause (stop ingesting), clear, inspect panel for a selected node (full headers, body, timing).
- **Aesthetic** references JSON Crack (dark, clean node–edge graph).

### 5.4 `packages/plugin` (Vite plugin)

- Exposes `httpTracker(options?)`.
- **Auto-inject** an `<script>` (or module import) during `dev`/`build-analyze` that loads the agent bundle and configures it (server URL, token).
- **StrictMode source scan** (build-time, accurate): walks the Vite module graph / entry source for `<StrictMode>`, `React.StrictMode`, `StrictMode` imports from `react`; injects **`__HTTP_TRACKER_STRICT_MODE__`** flag accordingly. This is the reliable "is Strict Mode on" evidence used to upgrade the `×2` label from "duplicate" to "likely Strict Mode". No runtime React internals.
- Config: `{ serverUrl?, port?, token?, autoInject?: boolean }`.

## 6. Data model summary

`RequestRecord` (see §5.1) is the single canonical shape shared by agent, server, and UI. Server adds derived fields per record:

- `groupKey?: string` — group id for duplicates (see §7).
- `dupRole?: 'canonical' | 'duplicate'` — which record is canon.
- `strictMode?: boolean` — from the class-level `__HTTP_TRACKER_STRICT_MODE__` flag.

## 7. Strict-Mode dedup semantics (hybrid)

Two layers, never inferred purely from timing:

1. **Neutral grouping (server, using the agent-computed signature):** the agent computes `requestHash` + `seq`; the server groups records with an identical `(method, url, requestHash-when-content)` signature, started within a tight window (`< 150 ms`), with no interleaving record of a different signature in between. Group members become a single visual node. **This layer never asserts a cause** — it only groups. Because it is neutral, a *real* duplicate (racing fetches, polling, refetch on dependency change) is still surfaced and inspectable rather than hidden as "expected".
2. **Strict-Mode attribution (build-time, authoritative):** only when `__HTTP_TRACKER_STRICT_MODE__` is true do we attach the `"likely Strict Mode (dev double-mount)"` label to grouped duplicates. The attribution is backed by source analysis, not response timing.

**Canonical selection:** Strict Mode mounts→unmounts→remounts, so the **last** matching request in a group is the survivor. Keep the **last** as `canonical`; collapse the earlier ones as `duplicates`. (Both remain stored; `dupRole` marks which is which.)

**Label states:**
- No grouping → single node.
- Group + strict flag off → `×2 duplicate`.
- Group + strict flag on → `×2 — likely Strict Mode (dev double-mount)`.

## 8. Pitfall mitigations (resolved in design)

| Pitfall | Mitigation |
|---|---|
| CORS hides cross-origin bodies, Devtools shows them | Opaque handling + metadata-only fallback; documented inability to match Devtools |
| Streaming/SSE body read breaks streaming / hangs | `streaming` flag, never read stream; body capture only for finite bodies |
| `FormData`/`Blob`/`ReadableStream` request bodies not re-readable for hashing | Serialize/hash safe forms only; skip otherwise |
| Memory blowup (5000×500KB ≈ 2.5GB) | Byte-based LRU cap (128 MB) not record count; caps on body size |
| Full-history replay to each new dashboard tab | Snapshot then delta on connect |
| WS race before socket ready; loss on server restart | Ring buffer + flush-on-connect + reconnect with replay of un-acked records |
| Any local page can inject fake events; HTTPS mixed-content; remote localhost mismatch | Bind 127.0.0.1, token required for write, configurable `serverUrl`, note HTTPS/mixed-content caveat |
| Patching every request adds latency/GC | Queue, lazy body capture, constants for caps, no eager reads |
| Devtools parity expectation | Explicit caveat in §3 |
| Tool thought to *prevent* duplication | Framed as diagnostic in §1 |

## 9. Testing strategy

- **Agent:** unit tests (happy-dom) with a mock `fetch` + `XMLHttpRequest` — capture shape, redaction, body caps, streaming/opaque handling, dedup grouping, WS flush + reconnect replay, dedup canonical selection.
- **Server:** Bun tests — `POST/WS /events` ingestion, byte-based LRU eviction, dedup grouping/ordering, snapshot+delta, token auth, static serving, CLI flags.
- **Plugin:** Vite build tests — auto-injection of the agent script, StrictMode source-scan flag on/off, config options.
- **UI:** component tests for ReactFlow node rendering, method colouring, the merged `×2` node + badge labels, expand/collapse, filters, inspect panel.
- **E2E:** Playwright against the demo apps. The marquee assertion: in `react-app` with Strict Mode on, an effect double-fetch must render as a **merged `×2` node with the Strict-Mode label**; in `vue-app`/`solid-app`, requests appear as normal nodes.

## 10. Out of scope for this iteration

- Response-body inspection parity with Devtools (see §3).
- Per-component attribution to React fibers.
- Angular target (dropped; may be added later via manual import path).
- Persistent history, replay, multi-user.

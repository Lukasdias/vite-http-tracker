# json-graph-view — Design Spec

> **Historical:** This design predates automatic tracker startup. For current runtime and usage details, see `README.md` and `AGENTS.md`.

Date: 2026-09-07
Status: Draft (pending user review)

---

## 1. Goal

Add a **JSON-as-graph** view (JSON Crack style) to the dashboard. When the developer selects a request, the main canvas swaps from the request timeline to a node-link graph of that request's response body (falling back to the request body). Each JSON key/value becomes a node connected by labeled edges; containers (objects/arrays) are collapsible so large payloads stay navigable.

## 2. Non-goals

- No force-directed / organic layout. Use a deterministic tree layout (like the existing timeline's layered layout).
- No second render of request *and* response side by side. Response with request fallback, per decision.
- No edits / mutation of the JSON. Read-only visualization.
- No persistence of the "graph view" mode across reloads; it is session state.
- No change to the timeline's node graph itself.

## 3. Context / why this shape

- The repo already ships React Flow v12 (`@xyflow/react`) for the request timeline.
- The body is today rendered as a tree (`JsonViewer`) or raw inside the side `InspectPanel`.
- The user chose: a **main full-screen view** replacing the timeline, **nós + arestas colapsáveis**, response body with request fallback, entered by **clicking a request node** and exited via a **back** button.
- Reusing React Flow keeps the bundle lean and gives pan/zoom/collapse for free.

## 4. Architecture

### 4.1 Navigation / state

- New dashboard state: `graphRecordId: string | null`.
- When set, `Dashboard` renders `JsonGraphView` in the main canvas slot (replacing `FlowCanvas`). The side `InspectPanel` stays visible.
- Clicking a request node in the timeline sets both `selectedId` (for the inspector) and `graphRecordId` (to open the graph).
- A **back** button in the `JsonGraphView` toolbar clears `graphRecordId`, returning to the timeline.
- The source record is `useRequest(graphRecordId)` (same hook the inspector uses).

### 4.2 Pure module `json-graph.ts` (no React, fully unit-tested)

Reuses types from `json.ts` (`JsonValue`, `JsonKind`, `kindOf`).

```ts
interface JsonGraphNode {
  id: string;          // path, e.g. "$.users.0.name"
  key: string;         // key label (array index for arrays)
  kind: JsonKind;
  value?: string;      // rendered text for leaves (string/number/bool/null)
  depth: number;
  childCount: number;  // descendant count (for container preview)
  x: number;
  y: number;
}

interface JsonGraph {
  nodes: JsonGraphNode[];
  edges: { id: string; source: string; target: string; label: string }[];
  rootId: string;
}

function buildJsonGraph(value: JsonValue, collapsed: ReadonlySet<string>): JsonGraph;
function toggleCollapse(id: string, collapsed: Set<string>): void;
function countJsonNodes(value: JsonValue): number;
```

- `buildJsonGraph` walks `value`, assigns path-based ids, computes a **tree layout**: root at `(0,0)`; children placed below the parent at `depth * Y_JSON_GAP`, spaced by `X_JSON_GAP` in breadth-first order. Collapsed nodes' descendants are omitted from `nodes`/`edges` but counted in `childCount` so the collapse affordance still shows `(N)`.
- Leaves hold a `value` string. String values that themselves parse as JSON (`jsonString`) are unwrapped as child objects/arrays, matching `JsonViewer` behavior.
- Cap: `MAX_GRAPH_NODES = 2000`. If `countJsonNodes` exceeds it, `buildJsonGraph` returns a sentinel (`{ overflow: true, count }`) and the view shows an overflow notice with a "view anyway" opt-in — mirroring `BodyViewer`'s large-object handling.

### 4.3 Component `JsonGraphView.tsx`

- Own `<ReactFlowProvider>` + `<ReactFlow>` (separate instance from the timeline; only one view renders at a time, so the two never conflict).
- `nodeTypes = { container: JsonContainerNode, scalar: JsonScalarNode }`.
- `JsonContainerNode`: key label + `{…}`/`[…]` + `childCount`, an input and output `Handle`, and a collapse chevron (▾/▸). Clicking toggles collapse via `onCollapse(id)`.
- `JsonScalarNode`: key + colored value, reusing the `j-string`/`j-number`/`j-bool`/`j-null` classes from `JsonViewer`.
- Edges are labeled with the child key; arrow markers match the timeline's `EDGE_COLOR`.
- Toolbar: **back**, **fit view**, **zoom in/out**, **expand all**, **collapse**, and an indicator of which body is shown (`response` vs `request` fallback).
- Body-legibility banners reuse the existing flags (`truncated`, `opaque`, `streaming`); if the body isn't readable, the view renders the same notice `BodyViewer` shows instead of a graph.

### 4.4 Integration

- `Dashboard.tsx`: conditional render of `JsonGraphView` vs `FlowCanvas` in the main slot; pass `record`, `collapsed` handlers, and `onBack`.
- `RequestNode` click path already routes through `onNodeClick` → adjust to also open the graph view.
- No changes to `server` / `agent` / `shared` — this is UI-only.

## 5. Data flow

```
timeline node click
  -> setSelectedId(id); setGraphRecordId(id)
  -> Dashboard renders JsonGraphView(record)
  -> JsonGraphView parses record.responseBody ?? record.requestBody via parseJson
  -> buildJsonGraph(value, collapsed) -> nodes/edges
  -> ReactFlow renders containers/scalars with collapse handlers
back -> setGraphRecordId(null) -> timeline returns
```

## 6. Error / edge cases

- No selected request yet: view is never opened without a record.
- Body empty / not JSON: show `—` / "not JSON" notice (same as `BodyViewer`).
- Huge payload: overflow cap + "view anyway" opt-in.
- Stringified nested JSON: unwrapped (reuses `jsonString`).
- Strict-mode duplicates: the graph uses the single canonical record from the group (same source as the inspector).

## 7. Testing

- `packages/ui/src/json-graph.test.ts` (Bun):
  - Conversion of nested objects, arrays, primitives, and stringified JSON.
  - Tree layout positions (root, siblings spacing, depth).
  - Collapse/expand: descendants omitted, `childCount` preserved, edges pruned.
  - Overflow cap sentinel.
- Typecheck the package: `bunx tsc --noEmit -p packages/ui/tsconfig.json`.
- Lint/format: `bunx oxlint packages apps`, `bunx oxfmt --write packages apps`.
- Rebuild dashboard: `bun run --cwd packages/ui build`.

## 8. Files touched

- `packages/ui/src/json-graph.ts` (new)
- `packages/ui/src/json-graph.test.ts` (new)
- `packages/ui/src/components/JsonGraphView.tsx` (new)
- `packages/ui/src/components/JsonContainerNode.tsx` (new)
- `packages/ui/src/components/JsonScalarNode.tsx` (new)
- `packages/ui/src/App.tsx` (wire navigation + conditional render)

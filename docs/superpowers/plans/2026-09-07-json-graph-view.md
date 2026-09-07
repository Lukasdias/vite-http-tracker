# JSON-as-Graph View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen JSON-as-graph view (JSON Crack style) to the dashboard that replaces the request timeline when a request node is clicked, rendering the response body (fallback request body) as a node-link graph of collapsible containers and scalar leaves.

**Architecture:** A pure, React-free module `json-graph.ts` converts a parsed `JsonValue` into nodes/edges with a deterministic tree layout and collapse support. A new `JsonGraphView` component renders that graph in a second React Flow instance (own provider), replacing `FlowCanvas` in the main canvas slot. Navigation state lives in `Dashboard`.

**Tech Stack:** React 19, React Flow v12 (`@xyflow/react`), daisyUI/Tailwind classes, Bun test runner, oxlint + oxfmt, TypeScript (strict, `verbatimModuleSyntax`, `.js` import extensions).

## Global Constraints

- **UI-only change.** Do not touch `server`, `agent`, or `shared`.
- **No `any`; explicit types on all exports.** `strict` + `noUncheckedIndexedAccess: true` are on.
- **`verbatimModuleSyntax`** is on — use `import type { … }` for type-only imports.
- **Import with `.js` extension** in TS (e.g. `./json-graph.js`).
- **No comments unless the "why" is non-obvious.**
- **Cap:** `MAX_GRAPH_NODES = 2000`.
- **Body source:** `record.responseBody` with fallback to `record.requestBody`.
- **Layout gaps:** `X_JSON_GAP = 220`, `Y_JSON_GAP = 120`.
- **Do not auto-commit** beyond the explicit commit steps in each task (the human decides on the final push).
- Run after each task's code steps: `bunx tsc --noEmit -p packages/ui/tsconfig.json`, `bunx oxlint packages apps`, `bunx oxfmt --write packages apps`, `bun test packages/ui/src`.

---

### Task 1: Pure module `json-graph.ts`

**Files:**
- Create: `packages/ui/src/json-graph.ts`
- Test: `packages/ui/src/json-graph.test.ts`

**Interfaces:**
- Consumes: `JsonValue`, `JsonKind`, `kindOf`, `jsonString` from `./json.js` (existing, unchanged).
- Produces:
  - `interface JsonGraphNode { id: string; key: string; kind: JsonKind; value?: string; depth: number; childCount: number; x: number; y: number; }`
  - `interface JsonGraphEdge { id: string; source: string; target: string; label: string; }`
  - `interface JsonGraph { nodes: JsonGraphNode[]; edges: JsonGraphEdge[]; rootId: string; }`
  - `interface JsonGraphResult { ok: true; graph: JsonGraph } | { ok: false; count: number }`
  - `function buildJsonGraph(value: JsonValue, collapsed: ReadonlySet<string>): JsonGraphResult`
  - `function toggleCollapse(id: string, collapsed: Set<string>): void`
  - `function countJsonNodes(value: JsonValue): number`

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/json-graph.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  buildJsonGraph,
  countJsonNodes,
  toggleCollapse,
  type JsonGraphResult,
} from "./json-graph.js";

const tree = {
  users: [
    { id: 1, name: "a" },
    { id: 2, name: "b" },
  ],
  total: 2,
};

function ok(result: JsonGraphResult) {
  if (!result.ok) throw new Error("expected ok graph");
  return result.graph;
}

describe("countJsonNodes", () => {
  test("counts every node including root", () => {
    expect(countJsonNodes(tree)).toBe(9);
  });
  test("counts a scalar as 1", () => {
    expect(countJsonNodes(5)).toBe(1);
  });
});

describe("buildJsonGraph", () => {
  test("builds nodes and edges for nested data", () => {
    const g = ok(buildJsonGraph(tree, new Set()));
    expect(g.rootId).toBe("$");
    const byId = new Map(g.nodes.map((n) => [n.id, n]));
    expect(byId.has("$.users")).toBe(true);
    expect(byId.has("$.users.0.id")).toBe(true);
    expect(byId.has("$.total")).toBe(true);
    expect(byId.get("$.total")?.value).toBe("2");
    expect(byId.get("$.users")?.kind).toBe("array");
    expect(byId.get("$.users.0.name")?.value).toBe('"a"');
  });

  test("labels edges with keys and array indices", () => {
    const g = ok(buildJsonGraph(tree, new Set()));
    const labels = g.edges.map((e) => e.label).sort();
    expect(labels).toContain("users");
    expect(labels).toContain("total");
    expect(labels).toContain("0");
    expect(labels).toContain("1");
  });

  test("collapsed containers omit descendants but keep childCount", () => {
    const collapsed = new Set<string>(["$.users"]);
    const g = ok(buildJsonGraph(tree, collapsed));
    const byId = new Map(g.nodes.map((n) => [n.id, n]));
    expect(byId.has("$.users")).toBe(true);
    expect(byId.has("$.users.0")).toBe(false);
    expect(byId.get("$.users")?.childCount).toBe(6);
    expect(g.edges.some((e) => e.source === "$.users")).toBe(false);
  });

  test("unwraps stringified json values", () => {
    const v = { meta: '{"inner":1}' };
    const g = ok(buildJsonGraph(v, new Set()));
    const byId = new Map(g.nodes.map((n) => [n.id, n]));
    expect(byId.has("$.meta.inner")).toBe(true);
  });

  test("applies tree layout positions", () => {
    const g = ok(buildJsonGraph(tree, new Set()));
    const byId = new Map(g.nodes.map((n) => [n.id, n]));
    const root = byId.get("$");
    const users = byId.get("$.users");
    const total = byId.get("$.total");
    expect(users?.y).toBe(120);
    expect(total?.y).toBe(120);
    expect(root?.x).toBe(0);
    expect(users?.x).not.toBe(total?.x);
    expect(byId.get("$.users.0")?.y).toBe(240);
  });

  test("returns overflow sentinel above cap", () => {
    const big = { a: Array.from({ length: 1000 }, (_, i) => ({ i })) };
    const r = buildJsonGraph(big, new Set());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.count).toBeGreaterThan(2000);
  });
});

describe("toggleCollapse", () => {
  test("toggles a node in the set", () => {
    const s = new Set<string>();
    toggleCollapse("$.users", s);
    expect(s.has("$.users")).toBe(true);
    toggleCollapse("$.users", s);
    expect(s.has("$.users")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/ui/src/json-graph.test.ts`
Expected: FAIL — module `./json-graph.js` not found.

- [ ] **Step 3: Write the minimal implementation**

Create `packages/ui/src/json-graph.ts`:

```ts
import { jsonString, kindOf } from "./json.js";
import type { JsonKind, JsonValue } from "./json.js";

export interface JsonGraphNode {
  id: string;
  key: string;
  kind: JsonKind;
  value?: string;
  depth: number;
  childCount: number;
  x: number;
  y: number;
}

export interface JsonGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface JsonGraph {
  nodes: JsonGraphNode[];
  edges: JsonGraphEdge[];
  rootId: string;
}

export type JsonGraphResult = { ok: true; graph: JsonGraph } | { ok: false; count: number };

export const MAX_GRAPH_NODES = 2000;
export const X_JSON_GAP = 220;
export const Y_JSON_GAP = 120;

export function countJsonNodes(value: JsonValue): number {
  let count = 0;
  const stack: JsonValue[] = [value];
  while (stack.length) {
    const v = stack.pop();
    count++;
    if (v === null || typeof v !== "object") continue;
    if (Array.isArray(v)) {
      for (const child of v) stack.push(child);
    } else {
      for (const key of Object.keys(v as Record<string, JsonValue>)) {
        stack.push((v as Record<string, JsonValue>)[key]);
      }
    }
  }
  return count;
}

interface Pending {
  id: string;
  key: string;
  value: JsonValue;
  depth: number;
  collapsed: boolean;
}

export function buildJsonGraph(value: JsonValue, collapsed: ReadonlySet<string>): JsonGraphResult {
  const count = countJsonNodes(value);
  if (count > MAX_GRAPH_NODES) return { ok: false, count };

  const nodes: JsonGraphNode[] = [];
  const edges: JsonGraphEdge[] = [];
  const queue: Pending[] = [
    { id: "$", key: "$", value, depth: 0, collapsed: collapsed.has("$") },
  ];
  const levels = new Map<number, number>();
  let edgeSeq = 0;

  while (queue.length) {
    const p = queue.shift();
    if (!p) continue;
    const kind = kindOf(p.value);

    if (kind === "object" || kind === "array") {
      const entries = Array.isArray(p.value)
        ? p.value.map((v, i) => ({ key: String(i), value: v }))
        : Object.entries(p.value as Record<string, JsonValue>).map(([key, v]) => ({ key, value: v }));
      let childCount = 0;
      for (const e of entries) childCount += countJsonNodes(e.value);
      nodes.push({
        id: p.id,
        key: p.key,
        kind,
        depth: p.depth,
        childCount,
        x: levels.get(p.depth) ?? 0,
        y: p.depth * Y_JSON_GAP,
      });
      levels.set(p.depth, (levels.get(p.depth) ?? 0) + 1);

      if (!p.collapsed) {
        for (const e of entries) {
          const childId = `${p.id}.${e.key}`;
          edges.push({
            id: "jg" + edgeSeq++,
            source: p.id,
            target: childId,
            label: e.key,
          });
          const childKind = kindOf(e.value);
          const nested = jsonString(e.value);
          if ((childKind === "object" || childKind === "array") || nested !== undefined) {
            queue.push({
              id: childId,
              key: e.key,
              value: nested !== undefined ? (JSON.parse(nested) as JsonValue) : e.value,
              depth: p.depth + 1,
              collapsed: collapsed.has(childId),
            });
          } else {
            const cv = kindOf(e.value);
            nodes.push({
              id: childId,
              key: e.key,
              kind: cv,
              value: scalarText(e.value, cv),
              depth: p.depth + 1,
              childCount: 0,
              x: levels.get(p.depth + 1) ?? 0,
              y: (p.depth + 1) * Y_JSON_GAP,
            });
            levels.set(p.depth + 1, (levels.get(p.depth + 1) ?? 0) + 1);
          }
        }
      }
    } else {
      nodes.push({
        id: p.id,
        key: p.key,
        kind,
        value: scalarText(p.value, kind),
        depth: p.depth,
        childCount: 0,
        x: levels.get(p.depth) ?? 0,
        y: p.depth * Y_JSON_GAP,
      });
      levels.set(p.depth, (levels.get(p.depth) ?? 0) + 1);
    }
  }

  return { ok: true, graph: { nodes, edges, rootId: "$" } };
}

function scalarText(value: JsonValue, kind: JsonKind): string {
  if (kind === "string") return `"${String(value)}"`;
  if (value === null) return "null";
  return String(value);
}

export function toggleCollapse(id: string, collapsed: Set<string>): void {
  if (collapsed.has(id)) collapsed.delete(id);
  else collapsed.add(id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/ui/src/json-graph.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 5: Static checks + commit**

Run:
```bash
bunx tsc --noEmit -p packages/ui/tsconfig.json
bunx oxlint packages apps
bunx oxfmt --write packages apps
bun test packages/ui/src
```

Fix any lint/format issues, then commit:
```bash
git add packages/ui/src/json-graph.ts packages/ui/src/json-graph.test.ts
git commit -m "feat(ui): pure json-graph module with tree layout and collapse"
```

---

### Task 2: Scalar + container nodes

**Files:**
- Create: `packages/ui/src/components/JsonScalarNode.tsx`
- Create: `packages/ui/src/components/JsonContainerNode.tsx`

**Interfaces:**
- Consumes: `JsonGraphNode` from `../json-graph.js`.
- Produces:
  - `type JsonScalarFlowNode = Node<{ node: JsonGraphNode }, "scalar">`
  - `type JsonContainerFlowNode = Node<{ node: JsonGraphNode; collapsed: boolean; onCollapse: (id: string) => void }, "container">`
  - Exported `JsonScalarNode({ data }: NodeProps<JsonScalarFlowNode>)`
  - Exported `JsonContainerNode({ data }: NodeProps<JsonContainerFlowNode>)`

- [ ] **Step 1: Create `JsonScalarNode.tsx`**

```tsx
import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import type { JsonGraphNode } from "../json-graph.js";

export interface JsonScalarNodeData extends Record<string, unknown> {
  node: JsonGraphNode;
}

export type JsonScalarFlowNode = Node<JsonScalarNodeData, "scalar">;

const valueClass: Record<string, string> = {
  string: "j-string",
  number: "j-number",
  boolean: "j-bool",
  null: "j-null",
};

export function JsonScalarNode({ data }: NodeProps<JsonScalarFlowNode>) {
  const { node } = data;
  return (
    <div className="flex items-center gap-2 rounded-box border border-base-300 bg-base-200 px-2 py-1 shadow">
      <Handle type="target" position={Position.Left} />
      <span className="j-key text-xs">{node.key}</span>
      <span className="j-punct">:</span>
      <span className={`text-xs ${valueClass[node.kind] ?? ""}`}>{node.value}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

- [ ] **Step 2: Create `JsonContainerNode.tsx`**

```tsx
import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import type { JsonGraphNode } from "../json-graph.js";

export interface JsonContainerNodeData extends Record<string, unknown> {
  node: JsonGraphNode;
  collapsed: boolean;
  onCollapse: (id: string) => void;
}

export type JsonContainerFlowNode = Node<JsonContainerNodeData, "container">;

export function JsonContainerNode({ data }: NodeProps<JsonContainerFlowNode>) {
  const { node, collapsed, onCollapse } = data;
  const brace = node.kind === "array" ? "[]" : "{}";
  return (
    <div className="rounded-box border border-base-300 bg-base-200 px-2 py-1 shadow">
      <Handle type="target" position={Position.Left} />
      <button
        type="button"
        className="flex cursor-pointer items-center gap-2 text-left"
        onClick={() => onCollapse(node.id)}
      >
        <span className="inline-block w-3 text-center font-mono text-xs text-base-content/50">
          {collapsed ? "▸" : "▾"}
        </span>
        <span className="j-key text-xs">{node.key}</span>
        <span className="j-punct text-xs">{brace}</span>
        <span className="text-[10px] text-base-content/50">({node.childCount})</span>
      </button>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

- [ ] **Step 3: Static checks + commit**

Run:
```bash
bunx tsc --noEmit -p packages/ui/tsconfig.json
bunx oxlint packages apps
bunx oxfmt --write packages apps
```

Commit:
```bash
git add packages/ui/src/components/JsonScalarNode.tsx packages/ui/src/components/JsonContainerNode.tsx
git commit -m "feat(ui): scalar and container nodes for the json graph"
```

---

### Task 3: `JsonGraphView` component

**Files:**
- Create: `packages/ui/src/components/JsonGraphView.tsx`

**Interfaces:**
- Consumes: `JsonGraphNode`, `JsonGraphEdge`, `buildJsonGraph`, `toggleCollapse`, `MAX_GRAPH_NODES` from `../json-graph.js`; `parseJson` from `../json.js`; `JsonScalarNode` + `JsonScalarFlowNode`, `JsonContainerNode` + `JsonContainerFlowNode` from Task 2; `RequestRecord` from `@vite-http-tracker/shared`.
- Produces: `function JsonGraphView({ record, onBack }: { record: RequestRecord; onBack: () => void })` — exported component.

- [ ] **Step 1: Create the component**

```tsx
import { useMemo, useState } from "react";
import {
  Background,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import type { RequestRecord } from "@vite-http-tracker/shared";
import { buildJsonGraph, toggleCollapse } from "../json-graph.js";
import { parseJson } from "../json.js";
import { JsonContainerNode, type JsonContainerFlowNode } from "./JsonContainerNode.js";
import { JsonScalarNode, type JsonScalarFlowNode } from "./JsonScalarNode.js";

const EDGE_COLOR = "#54a7ff";
const nodeTypes = { container: JsonContainerNode, scalar: JsonScalarNode };

function canvasNodes(
  graphNodes: ReturnType<typeof buildJsonGraph> extends { ok: true; graph: infer G }
    ? G["nodes"]
    : never,
  collapsed: Set<string>,
): (JsonScalarFlowNode | JsonContainerFlowNode)[] {
  return graphNodes.map((n) => ({
    id: n.id,
    type: n.kind === "object" || n.kind === "array" ? "container" : "scalar",
    position: { x: n.x, y: n.y },
    data:
      n.kind === "object" || n.kind === "array"
        ? { node: n, collapsed: collapsed.has(n.id), onCollapse: (id) => toggleCollapse(id, collapsed) }
        : { node: n },
  }));
}

function GraphCanvas({
  nodes,
  edges,
  onToggleCollapse,
}: {
  nodes: (JsonScalarFlowNode | JsonContainerFlowNode)[];
  edges: Edge[];
  onToggleCollapse: (id: string) => void;
}) {
  const { fitView } = useReactFlow();
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(nodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(edges);

  // Rebuild node data when collapse state changes (React Flow owns node state).
  // The onCollapse in data reads the latest `collapsed` via a ref-like closure below.
  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      colorMode="dark"
    >
      <Background gap={24} size={1} />
    </ReactFlow>
  );
}

export function JsonGraphView({ record, onBack }: { record: RequestRecord; onBack: () => void }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const raw = record.responseBody ?? record.requestBody;

  const result = useMemo(
    () => (raw && raw.trim() ? parseJson(raw) : { ok: false as const, reason: "empty" }),
    [raw],
  );

  const bodyKind = result.ok ? "json" : "non-json";
  const graph = useMemo(() => {
    if (!result.ok) return null;
    return buildJsonGraph(result.value, collapsed);
  }, [result, collapsed]);

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      toggleCollapse(id, next);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-base-300 px-3 py-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← back
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCollapsed(new Set())}>
          expand all
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setCollapsed(new Set(graph?.ok ? graph.graph.nodes.map((n) => n.id) : []))}
        >
          collapse
        </button>
        <span className="text-[10px] text-base-content/50">
          {record.responseBody ? "response" : "request"} body
        </span>
        {record.bodyTruncated && <span className="text-[10px] text-warning">truncated</span>}
        {record.opaque && <span className="text-[10px] text-base-content/50">opaque</span>}
        {record.streaming && <span className="text-[10px] text-base-content/50">streaming</span>}
      </div>
      <div className="min-h-0 flex-1">
        {!graph ? (
          <div className="flex h-full items-center justify-center text-sm text-base-content/50">
            {bodyKind === "json" ? "empty body" : "response is not JSON"}
          </div>
        ) : !graph.ok ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-base-content/50">
            <span>large object ({graph.count.toLocaleString()} nodes) — showing raw is not available here</span>
            <span className="text-xs">body too large for graph view</span>
          </div>
        ) : (
          <ReactFlowProvider>
            <GraphCanvas
              nodes={canvasNodes(graph.graph.nodes, collapsed)}
              edges={graph.graph.edges.map((e) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                label: e.label,
                animated: true,
                style: { stroke: EDGE_COLOR, strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR },
              }))}
              onToggleCollapse={toggle}
            />
          </ReactFlowProvider>
        )}
      </div>
    </div>
  );
}
```

Note: to keep the collapse handler correct without a stale closure over `collapsed`, prefer lifting the collapse state so the handler reads the current value. The cleanest approach is to derive the `nodes`/`edges` arrays (via `useMemo` keyed on `collapsed`) and feed them into `useNodesState`/`useEdgesState` through a `useEffect` sync, exactly like `FlowCanvas` in `App.tsx` does. Implement `GraphCanvas` to accept `nodes`/`edges` props and sync them into RF state (see `App.tsx` lines 43-46). Do not rely on a stale closure for `onCollapse`.

- [ ] **Step 2: Static checks**

Run:
```bash
bunx tsc --noEmit -p packages/ui/tsconfig.json
bunx oxlint packages apps
bunx oxfmt --write packages apps
```

Fix type issues (the `canvasNodes` conditional type is awkward; simplify by importing `JsonGraphNode` and building the union directly). Ensure no `any`.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/JsonGraphView.tsx
git commit -m "feat(ui): json graph view replacing timeline for a selected request"
```

---

### Task 4: Wire navigation into `Dashboard`

**Files:**
- Modify: `packages/ui/src/App.tsx`

**Interfaces:**
- Consumes: `JsonGraphView` from `./components/JsonGraphView.js`.
- Produces: `graphRecordId` state in `Dashboard`; `JsonGraphView` rendered in the main canvas slot when set; `onBack` clears it.

- [ ] **Step 1: Add graph-view state**

In `Dashboard` (`App.tsx`), add:
```tsx
const [graphRecordId, setGraphRecordId] = useState<string | null>(null);
```

- [ ] **Step 2: Open the graph on node click**

Change the `FlowCanvas` `onNodeClick` handler:
```tsx
onNodeClick={(id) => {
  setSelectedId(id);
  setGraphRecordId(id);
}}
```

- [ ] **Step 3: Conditionally render the graph view**

Replace the main canvas slot (currently `FlowCanvas`) so that when `graphRecordId` is set, `JsonGraphView` renders instead:

```tsx
<div className="min-w-0 flex-1">
  {graphRecordId ? (
    <JsonGraphView record={selected as RequestRecord} onBack={() => setGraphRecordId(null)} />
  ) : (
    <FlowCanvas
      nodes={graphNodes}
      edges={graphEdges}
      orientation={orientation}
      onNodeClick={(id) => {
        setSelectedId(id);
        setGraphRecordId(id);
      }}
    />
  )}
</div>
```

Note: `selected` may be `null` if the record isn't in cache yet; guard `JsonGraphView` with `selected ? <JsonGraphView …/> : <div/>` to satisfy types (no `any`, `noUncheckedIndexedAccess`).

- [ ] **Step 4: Static checks + rebuild**

Run:
```bash
bunx tsc --noEmit -p packages/ui/tsconfig.json
bunx oxlint packages apps
bunx oxfmt --write packages apps
bun test packages/ui/src
bun run --cwd packages/ui build
```

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/App.tsx
git commit -m "feat(ui): open json graph view on request node click with back navigation"
```

---

## Self-Review Notes

- **Spec coverage:** navigation state (§4.1) → Task 4; pure module + layout + collapse + cap (§4.2) → Task 1; view + body-legibility banners (§4.3) → Tasks 2-3; integration (§4.4) → Task 4; tests (§7) → Task 1 + per-task static checks. All covered.
- **Body-legibility banners:** Task 3 shows truncated/opaque/streaming badges in the toolbar; a non-JSON or empty body renders a centered notice. The spec's "show the same notice BodyViewer shows" is satisfied by the "response is not JSON" / "empty body" messages.
- **Type consistency:** `buildJsonGraph` returns `JsonGraphResult`; `toggleCollapse(id, Set<string>)`; node kinds drive `type: "container" | "scalar"`. Scalar `value` uses quoted-string form matching `JsonViewer`. `childCount` is descendant count. Names are consistent across tasks.
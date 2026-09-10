# Domain-grouped graph Implementation Plan

> **Historical:** This plan predates automatic tracker startup. Its development commands are retained only as implementation history; use the root `AGENTS.md` and `README.md` for current workflows.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat timeline with a domain-grouped graph: colored container per URL host, chronological edges preserved, toggleable legend, big URLs removed from nodes and the inspect sidebar.

**Architecture:** Pure logic lives in `packages/ui/src/grouping.ts` (URL host parsing, palette, partition) and `graph.ts` (`buildGroupedGraph` layout). React components (`DomainNode`, `RequestNode`, `InspectPanel`, `Legend`) render the grouped structure; `App.tsx` wires it together.

**Tech Stack:** React 19, `@xyflow/react` (React Flow group nodes), TanStack Query, Bun test runner, oxlint/oxfmt.

## Global Constraints

- **No auto-commit.** The human decides when to commit/push. Do NOT run `git commit` as part of any task; just note the files changed.
- Group by **URL host only** (single level). Do NOT guess version/route patterns.
- Group containers ordered by **first request appearance** (min `seq`), then **alphabetically**.
- Palette of **12 distinct colors**, dark-theme friendly, used as translucent container backgrounds.
- No comments unless the "why" is non-obvious.
- Explicit types on all exports; no `any`. `strict` + `noUncheckedIndexedAccess: true` are on.
- `verbatimModuleSyntax` on → use `import type { … }` for type-only imports.
- Import with `.js` extension in TS (e.g. `./grouping.js`).
- Lint/format with oxlint + oxfmt; typecheck per-package with `bunx tsc --noEmit -p packages/ui/tsconfig.json`.

---

### Task 1: `grouping.ts` — URL host parsing, palette, partition

**Files:**
- Create: `packages/ui/src/grouping.ts`
- Test: `packages/ui/src/grouping.test.ts`

**Interfaces:**
- Consumes: `RecordGroup` type from `./graph.js` (type-only import).
- Produces:
  - `UNKNOWN_DOMAIN: string`
  - `DOMAIN_COLORS: string[]`
  - `domainOf(url: string): string`
  - `pathOf(url: string): string`
  - `partitionByDomain(groups: RecordGroup[]): DomainGroup[]`
  - `interface DomainGroup { domain: string; color: string; groups: RecordGroup[] }`

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/grouping.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import type { RequestRecord } from "@vite-http-tracker/shared";
import { groupRecords } from "./graph.js";
import { DOMAIN_COLORS, UNKNOWN_DOMAIN, domainOf, partitionByDomain, pathOf } from "./grouping.js";

const mk = (partial: Partial<RequestRecord>): RequestRecord => ({
  requestId: partial.requestId ?? "id",
  seq: partial.seq ?? 1,
  method: partial.method ?? "GET",
  url: partial.url ?? "/x",
  status: partial.status ?? 200,
  startTime: partial.startTime ?? 1,
  endTime: partial.endTime ?? 1,
  duration: partial.duration ?? 0,
  strictMode: partial.strictMode ?? false,
  batchId: partial.batchId,
});

describe("domainOf", () => {
  test("extracts hostname from absolute urls", () => {
    expect(domainOf("https://api.example.com/v1/users")).toBe("api.example.com");
    expect(domainOf("http://localhost:3000/api")).toBe("localhost");
  });
  test("falls back to the unknown sentinel for unparseable urls", () => {
    expect(domainOf("/api/users")).toBe(UNKNOWN_DOMAIN);
  });
});

describe("pathOf", () => {
  test("returns path plus search for absolute urls", () => {
    expect(pathOf("https://api.example.com/v1/users?id=1")).toBe("/v1/users?id=1");
  });
  test("returns the raw url for relative urls", () => {
    expect(pathOf("/api/users")).toBe("/api/users");
  });
});

describe("partitionByDomain", () => {
  test("orders domains by first appearance then alphabetically and assigns colors", () => {
    const recs = [
      mk({ requestId: "a", seq: 1, url: "https://b.com/x" }),
      mk({ requestId: "b", seq: 2, url: "https://a.com/x" }),
      mk({ requestId: "c", seq: 3, url: "https://b.com/y" }),
    ];
    const domains = partitionByDomain(groupRecords(recs));
    expect(domains.map((d) => d.domain)).toEqual(["b.com", "a.com"]);
    expect(domains[0]!.color).toBe(DOMAIN_COLORS[0]);
    expect(domains[1]!.color).toBe(DOMAIN_COLORS[1]);
    expect(domains[0]!.groups.map((g) => g.canonical.url)).toEqual([
      "https://b.com/x",
      "https://b.com/y",
    ]);
  });
  test("cycles the palette when more than 12 domains appear", () => {
    const recs = Array.from({ length: 13 }, (_, i) =>
      mk({ requestId: `r${i}`, seq: i + 1, url: `https://d${i}.com/x` }),
    );
    const domains = partitionByDomain(groupRecords(recs));
    expect(domains.length).toBe(13);
    expect(domains[0]!.color).toBe(DOMAIN_COLORS[0]);
    expect(domains[12]!.color).toBe(DOMAIN_COLORS[0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/ui/src/grouping.test.ts`
Expected: FAIL — cannot resolve `./grouping.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/ui/src/grouping.ts`:

```ts
import type { RecordGroup } from "./graph.js";

export interface DomainGroup {
  domain: string;
  color: string;
  groups: RecordGroup[];
}

export const UNKNOWN_DOMAIN = "(unknown)";

export const DOMAIN_COLORS = [
  "#4ad295",
  "#54a7ff",
  "#c07af0",
  "#ff6b6b",
  "#ffb84d",
  "#f0e14a",
  "#4dd0e1",
  "#f06292",
  "#aed581",
  "#7986cb",
  "#ff8a65",
  "#9575cd",
];

export function domainOf(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname || UNKNOWN_DOMAIN;
  } catch {
    const m = url.match(/^https?:\/\/([^/?#]+)/i);
    if (m?.[1]) return m[1];
    return UNKNOWN_DOMAIN;
  }
}

export function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

export function partitionByDomain(groups: RecordGroup[]): DomainGroup[] {
  const byDomain = new Map<string, RecordGroup[]>();
  for (const g of groups) {
    const d = domainOf(g.canonical.url);
    const list = byDomain.get(d) ?? [];
    list.push(g);
    byDomain.set(d, list);
  }
  const entries = [...byDomain.entries()].map(([domain, gs]) => ({
    domain,
    groups: [...gs].sort((a, b) => a.canonical.seq - b.canonical.seq),
  }));
  entries.sort((a, b) => {
    const aSeq = Math.min(...a.groups.map((g) => g.canonical.seq));
    const bSeq = Math.min(...b.groups.map((g) => g.canonical.seq));
    if (aSeq !== bSeq) return aSeq - bSeq;
    return a.domain.localeCompare(b.domain);
  });
  return entries.map((e, i) => ({
    ...e,
    color: DOMAIN_COLORS[i % DOMAIN_COLORS.length] ?? "#3a3f4b",
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/ui/src/grouping.test.ts`
Expected: PASS.

---

### Task 2: `buildGroupedGraph` in `graph.ts`

**Files:**
- Modify: `packages/ui/src/graph.ts`
- Test: `packages/ui/src/graph.test.ts`

**Interfaces:**
- Consumes: `partitionByDomain`, `DomainGroup` from `./grouping.js`; existing `RecordGroup`, `GraphNode`, `GraphEdge`, `Orientation`.
- Produces:
  - `interface DomainNode { id: string; domain: string; color: string; x: number; y: number; width: number; height: number }`
  - `interface GroupedGraph { domainNodes: DomainNode[]; nodes: GraphNode[]; edges: GraphEdge[] }`
  - `buildGroupedGraph(groups: RecordGroup[], showEdges: boolean, orientation?: Orientation): GroupedGraph`
  - `GraphNode` gains optional `parentId?: string; extent?: "parent"`.
  - Constants: `DOMAIN_PADDING`, `DOMAIN_GAP`, `NODE_W`, `NODE_H`.

- [ ] **Step 1: Add `parentId`/`extent` to `GraphNode`**

In `packages/ui/src/graph.ts`, extend the `GraphNode` interface (currently lines 3-17):

```ts
export interface GraphNode {
  id: string;
  seq: number;
  method: string;
  url: string;
  status: number;
  duration: number;
  x: number;
  y: number;
  dupCount: number;
  strictMode: boolean;
  memberIds: string[];
  batchId?: string;
  batchSize?: number;
  parentId?: string;
  extent?: "parent";
}
```

- [ ] **Step 2: Add constants and new interfaces**

After the existing constants (around line 47), add:

```ts
export const DOMAIN_PADDING = 16;
export const DOMAIN_GAP = 40;
export const NODE_W = 224;
export const NODE_H = 72;

export interface DomainNode {
  id: string;
  domain: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GroupedGraph {
  domainNodes: DomainNode[];
  nodes: GraphNode[];
  edges: GraphEdge[];
}
```

- [ ] **Step 3: Write the failing test**

Append to `packages/ui/src/graph.test.ts`. Add `buildGroupedGraph` to the existing import from `./graph.js`:

```ts
import {
  buildGraph,
  buildGroupedGraph,
  filterGroups,
  groupRecords,
  matchesFilter,
  methodColor,
  statusClass,
  OTHER_METHOD_COLOR,
} from "./graph.js";
```

Append:

```ts
describe("buildGroupedGraph", () => {
  test("wraps request groups in domain containers with parentId and extent", () => {
    const recs = [
      mk({ requestId: "a", seq: 1, url: "https://api.example.com/v1/users" }),
      mk({ requestId: "b", seq: 2, url: "https://api.example.com/v1/posts" }),
      mk({ requestId: "c", seq: 3, url: "https://cdn.example.com/x.js" }),
    ];
    const { domainNodes, nodes, edges } = buildGroupedGraph(groupRecords(recs), true);
    expect(domainNodes.length).toBe(2);
    expect(domainNodes.map((d) => d.domain)).toEqual([
      "api.example.com",
      "cdn.example.com",
    ]);
    expect(nodes.every((n) => n.parentId && n.extent === "parent")).toBe(true);
    expect(nodes[0]!.parentId).toBe("domain:api.example.com");
    expect(edges.length).toBe(2);
  });
  test("stacks containers vertically in horizontal orientation and sizes them", () => {
    const recs = [
      mk({ requestId: "a", seq: 1, url: "https://a.com/x" }),
      mk({ requestId: "b", seq: 2, url: "https://b.com/y" }),
    ];
    const { domainNodes } = buildGroupedGraph(groupRecords(recs), false, "horizontal");
    expect(domainNodes[0]!.y).toBe(0);
    expect(domainNodes[1]!.y).toBeGreaterThan(domainNodes[0]!.y);
    expect(domainNodes[0]!.width).toBeGreaterThan(0);
    expect(domainNodes[0]!.height).toBeGreaterThan(0);
  });
  test("places containers side by side in vertical orientation", () => {
    const recs = [
      mk({ requestId: "a", seq: 1, url: "https://a.com/x" }),
      mk({ requestId: "b", seq: 2, url: "https://b.com/y" }),
    ];
    const { domainNodes } = buildGroupedGraph(groupRecords(recs), false, "vertical");
    expect(domainNodes[0]!.x).toBe(0);
    expect(domainNodes[1]!.x).toBeGreaterThan(domainNodes[0]!.x);
    expect(domainNodes[0]!.y).toBe(0);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `bun test packages/ui/src/graph.test.ts`
Expected: FAIL — `buildGroupedGraph` is not exported.

- [ ] **Step 5: Write the implementation**

Add to `packages/ui/src/graph.ts` (after `buildGraph`):

```ts
export function buildGroupedGraph(
  groups: RecordGroup[],
  showEdges: boolean,
  orientation: Orientation = "horizontal",
): GroupedGraph {
  const batchSizes = new Map<string, number>();
  for (const g of groups) {
    const id = g.canonical.batchId;
    if (id) batchSizes.set(id, (batchSizes.get(id) ?? 0) + 1);
  }

  const domains = partitionByDomain(groups);
  const domainNodes: DomainNode[] = [];
  const nodes: GraphNode[] = [];
  let cursor = 0;

  for (const d of domains) {
    const dId = `domain:${d.domain}`;
    const sorted = [...d.groups].sort((a, b) => a.canonical.seq - b.canonical.seq);
    const children: GraphNode[] = sorted.map((g, i) => ({
      id: g.canonical.requestId,
      seq: g.canonical.seq,
      method: g.canonical.method,
      url: g.canonical.url,
      status: g.canonical.status,
      duration: g.canonical.duration,
      x: orientation === "horizontal" ? i * X_GAP + DOMAIN_PADDING : DOMAIN_PADDING,
      y: orientation === "horizontal" ? DOMAIN_PADDING : i * Y_GAP + DOMAIN_PADDING,
      dupCount: g.members.length,
      strictMode: g.strictMode,
      memberIds: g.members.map((m) => m.requestId),
      batchId: g.canonical.batchId,
      batchSize: g.canonical.batchId ? (batchSizes.get(g.canonical.batchId) ?? 0) : 0,
      parentId: dId,
      extent: "parent",
    }));
    const maxX = Math.max(...children.map((c) => c.x), DOMAIN_PADDING);
    const maxY = Math.max(...children.map((c) => c.y), DOMAIN_PADDING);
    const width = maxX + NODE_W + DOMAIN_PADDING;
    const height = maxY + NODE_H + DOMAIN_PADDING;
    if (orientation === "horizontal") {
      domainNodes.push({ id: dId, domain: d.domain, color: d.color, x: 0, y: cursor, width, height });
      cursor += height + DOMAIN_GAP;
    } else {
      domainNodes.push({ id: dId, domain: d.domain, color: d.color, x: cursor, y: 0, width, height });
      cursor += width + DOMAIN_GAP;
    }
    nodes.push(...children);
  }

  const edges: GraphEdge[] = [];
  if (showEdges) {
    const allSorted = [...groups].sort((a, b) => a.canonical.seq - b.canonical.seq);
    for (let i = 1; i < allSorted.length; i++) {
      const prev = allSorted[i - 1];
      const cur = allSorted[i];
      if (!prev || !cur) continue;
      const gap = Math.max(0, Math.round(cur.canonical.startTime - prev.canonical.startTime));
      edges.push({
        id: "e" + i,
        source: prev.canonical.requestId,
        target: cur.canonical.requestId,
        gap,
      });
    }
  }

  return { domainNodes, nodes, edges };
}
```

Add the import at the top of `graph.ts`:

```ts
import { partitionByDomain } from "./grouping.js";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test packages/ui/src/graph.test.ts`
Expected: PASS.

---

### Task 3: UI — grouped rendering, path labels, inspect breadcrumb

**Files:**
- Modify: `packages/ui/src/hooks/useGraph.ts`
- Create: `packages/ui/src/components/DomainNode.tsx`
- Modify: `packages/ui/src/components/RequestNode.tsx`
- Modify: `packages/ui/src/components/InspectPanel.tsx`

**Interfaces:**
- Consumes: `buildGroupedGraph`, `DomainNode` from `./graph.js`; `pathOf`, `domainOf` from `./grouping.js`; `RequestFlowNode` from `./RequestNode.js`.
- Produces: `DomainFlowNode` type (React Flow node for domain containers); `useGraph` returns `domainNodes: DomainNode[]`.

- [ ] **Step 1: Update `useGraph` to return the grouped graph**

Replace the body of `packages/ui/src/hooks/useGraph.ts`:

```ts
import { useMemo } from "react";
import {
  buildGroupedGraph,
  filterGroups,
  groupRecords,
  type DomainNode,
  type Orientation,
  type RecordFilter,
} from "../graph.js";
import type { RecordGroup } from "../graph.js";
import { useRequests } from "./useRequests.js";

export interface UseGraphResult {
  groups: RecordGroup[];
  domainNodes: DomainNode[];
  nodes: ReturnType<typeof buildGroupedGraph>["nodes"];
  edges: ReturnType<typeof buildGroupedGraph>["edges"];
}

export function useGraph(
  filter: RecordFilter,
  showEdges: boolean,
  orientation: Orientation,
): UseGraphResult {
  const requests = useRequests();
  const groups = useMemo(() => groupRecords(requests), [requests]);
  const filtered = useMemo(() => filterGroups(groups, filter), [groups, filter]);
  const graph = useMemo(
    () => buildGroupedGraph(filtered, showEdges, orientation),
    [filtered, showEdges, orientation],
  );
  return { groups, domainNodes: graph.domainNodes, nodes: graph.nodes, edges: graph.edges };
}
```

- [ ] **Step 2: Create `DomainNode.tsx`**

Create `packages/ui/src/components/DomainNode.tsx`:

```tsx
import type { Node, NodeProps } from "@xyflow/react";

export interface DomainNodeData extends Record<string, unknown> {
  domain: string;
  color: string;
}

export type DomainFlowNode = Node<DomainNodeData, "domain">;

export function DomainNode({ data }: NodeProps<DomainFlowNode>) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-base-300/40">
      <div
        className="shrink-0 px-2.5 py-1 font-mono text-xs font-semibold"
        style={{ color: data.color }}
      >
        {data.domain}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `RequestNode` to show the compact path**

In `packages/ui/src/components/RequestNode.tsx`, replace the URL line:

```tsx
      <div className="mt-1 max-w-56 truncate text-xs mono">{record.url}</div>
```

with:

```tsx
      <div className="mt-1 max-w-56 truncate text-xs mono">{pathOf(record.url)}</div>
```

Add the import:

```ts
import { pathOf } from "../grouping.js";
```

- [ ] **Step 4: Update `InspectPanel` header to a compact domain/path breadcrumb**

In `packages/ui/src/components/InspectPanel.tsx`, replace the header block:

```tsx
          <div className="font-semibold" style={{ color: methodColor(record.method) }}>
            {record.method} <span className="font-normal break-all">{record.url}</span>
          </div>
```

with:

```tsx
          <div className="text-xs text-base-content/50">{domainOf(record.url)}</div>
          <div className="font-semibold" style={{ color: methodColor(record.method) }}>
            {record.method} <span className="font-normal break-all">{pathOf(record.url)}</span>
          </div>
```

Add the import:

```ts
import { domainOf, pathOf } from "../grouping.js";
```

- [ ] **Step 5: Typecheck**

Run: `bunx tsc --noEmit -p packages/ui/tsconfig.json`
Expected: no errors.

---

### Task 4: Legend + Header toggle + App wiring

**Files:**
- Create: `packages/ui/src/components/Legend.tsx`
- Modify: `packages/ui/src/components/Header.tsx`
- Modify: `packages/ui/src/App.tsx`

**Interfaces:**
- Consumes: `DomainFlowNode` from `./DomainNode.js`; `DomainNode` from `./graph.js`; `showLegend`/`onShowLegend` props.
- Produces: `Legend` component; `Header` gains `showLegend`/`onShowLegend` props.

- [ ] **Step 1: Create `Legend.tsx`**

Create `packages/ui/src/components/Legend.tsx`:

```tsx
import type { DomainNode } from "../graph.js";

export interface LegendProps {
  domains: DomainNode[];
  onClose: () => void;
}

export function Legend({ domains, onClose }: LegendProps) {
  if (!domains.length) return null;
  return (
    <div className="absolute bottom-4 left-4 z-30 w-56 rounded-box border border-base-300 bg-base-100/95 p-3 shadow-lg backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
          Domains
        </h3>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={onClose}
          aria-label="Close legend"
        >
          ×
        </button>
      </div>
      <ul className="space-y-1.5">
        {domains.map((d) => (
          <li key={d.id} className="flex items-center gap-2 text-xs">
            <span
              className="size-3 shrink-0 rounded-sm"
              style={{ backgroundColor: d.color }}
            />
            <span className="truncate font-mono text-base-content/80">{d.domain}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Add legend toggle to `Header`**

In `packages/ui/src/components/Header.tsx`:
- Add props `showLegend: boolean` and `onShowLegend: (v: boolean) => void` to `HeaderProps`.
- Import `LayersIcon` from `@radix-ui/react-icons`.
- Add a `ToolButton` next to the edges toggle:

```tsx
          <ToolButton
            active={showLegend}
            onClick={() => onShowLegend(!showLegend)}
            title="Show domain legend"
          >
            <LayersIcon className={icon} />
          </ToolButton>
```

- [ ] **Step 3: Wire `App.tsx`**

In `packages/ui/src/App.tsx`:

1. Update imports:
```ts
import { RequestNode, type RequestFlowNode } from "./components/RequestNode.js";
import { DomainNode, type DomainFlowNode } from "./components/DomainNode.js";
import { Legend } from "./components/Legend.js";
```
2. Update `nodeTypes`:
```ts
const nodeTypes = { request: RequestNode, domain: DomainNode };
```
3. In `Dashboard`, destructure `domainNodes` from `useGraph`:
```ts
const { groups, domainNodes, nodes, edges } = useGraph(filter, showEdges, orientation);
```
4. Add legend state:
```ts
const [showLegend, setShowLegend] = useState(true);
```
5. Update `graphNodes` memo to include domain group nodes and set `parentId`/`extent` on request nodes:

Replace the existing `graphNodes` memo:

```ts
  const graphNodes = useMemo<(RequestFlowNode | DomainFlowNode)[]>(
    () => [
      ...domainNodes.map((d) => ({
        id: d.id,
        type: "domain",
        position: { x: d.x, y: d.y },
        style: { width: d.width, height: d.height, backgroundColor: d.color + "22" },
        data: { domain: d.domain, color: d.color },
      })),
      ...nodes.map((n) => {
        const group = groups.find((g) => g.canonical.requestId === n.id);
        return {
          id: n.id,
          type: "request",
          position: { x: n.x, y: n.y },
          parentId: n.parentId,
          extent: n.parentId ? "parent" : undefined,
          data: {
            record: (group?.canonical ?? selected) as RequestRecord,
            dupCount: n.dupCount,
            strictMode: n.strictMode,
            memberIds: n.memberIds,
            batchSize: n.batchSize,
            orientation,
          },
        };
      }),
    ],
    [domainNodes, nodes, groups, selected, orientation],
  );
```
6. Pass legend props to `Header`:
```tsx
        showLegend={showLegend}
        onShowLegend={setShowLegend}
```
7. Render the `Legend` overlay inside the graph container (next to `FlowCanvas`), e.g. wrap the `FlowCanvas` region:

```tsx
          {graphRecordId && selected ? (
            <JsonGraphView record={selected} onBack={() => setGraphRecordId(null)} />
          ) : (
            <div className="relative h-full">
              <FlowCanvas
                nodes={graphNodes}
                edges={graphEdges}
                orientation={orientation}
                onNodeClick={(id) => {
                  setSelectedId(id);
                  setGraphRecordId(id);
                }}
              />
              {showLegend && (
                <Legend
                  domains={domainNodes}
                  onClose={() => setShowLegend(false)}
                />
              )}
            </div>
          )}
```

- [ ] **Step 4: Typecheck**

Run: `bunx tsc --noEmit -p packages/ui/tsconfig.json`
Expected: no errors.

---

### Task 5: Verification

- [ ] **Step 1: Run the full test suite**

Run: `bun test`
Expected: all PASS.

- [ ] **Step 2: Lint**

Run: `bunx oxlint packages apps`
Expected: no errors.

- [ ] **Step 3: Format**

Run: `bunx oxfmt --write packages apps`
Expected: files formatted; review the diff.

- [ ] **Step 4: Rebuild the dashboard**

Run: `bun run --cwd packages/ui build`
Expected: builds successfully. (The server serves `packages/ui/dist`.)

- [ ] **Step 5: Manual smoke test**

Run the tracker and sample app, then hit endpoints across a couple of domains:
```
bun run packages/server/src/cli.ts --no-open
bun run --cwd apps/react-app dev
```
Confirm:
- Requests are grouped into colored domain containers.
- The legend lists each domain with its color swatch and can be toggled off.
- Request nodes show the compact path, not the full URL.
- The inspect sidebar shows `domain / path` instead of the big URL.
- Chronological edges still connect requests.

Note the files changed across tasks so the human can commit when ready.

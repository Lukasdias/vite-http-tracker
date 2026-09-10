# Domain-grouped graph

> **Historical:** This design predates automatic tracker startup. For current runtime and usage details, see `README.md` and `AGENTS.md`.

Date: 2026-09-07

## Problem

The dashboard renders the HTTP traffic as a flat, chronological timeline of request
nodes, each showing a truncated raw URL. When a user is investigating which
backends/APIs a page hits, they cannot tell at a glance which **domains** are being
called, and the full URL only appears in the inspect sidebar.

Goal: replace the flat timeline with a graph where requests are grouped by **domain**
(URL host). Each domain is a colored container holding its request nodes, with a
toggleable legend mapping colors to domains. This removes the need for big URLs on
individual nodes and in the inspect sidebar.

## Scope

UI-only. The domain is derived from the request URL at the UI layer. No changes to
`packages/agent`, `packages/server`, `packages/plugin`, or `packages/shared`.

## Decisions (confirmed with user)

- **Single level of grouping**: group by URL host only. Do NOT guess version/route
  patterns (`/v1`, `/users/:id`) — URL shapes are unknown across users. The path is
  still visible on each node, but the group is domain-only.
- **Replaces the timeline**: the graph always renders colored domain containers; there
  is no separate flat-timeline mode.
- **Chronological edges kept**: request nodes are ordered in request-order inside each
  domain container, and the timeline edges are preserved.
- **Container ordering**: by first request appearance (earliest `seq` in the domain),
  then alphabetically as a tiebreaker.
- **Legend**: a small floating panel (bottom-left) listing each domain with its color
  swatch, toggleable from the header.
- **Palette**: 12 distinct colors, dark-theme friendly.

## Architecture

Pure logic stays out of React, per repo convention. All graph/grouping functions are
unit-tested and live under `packages/ui/src`.

### New module: `packages/ui/src/grouping.ts`

Pure, no React, no DOM.

- `domainOf(url: string): string` — extract the URL host via `new URL(url)`; fall back
  to a regex for non-parseable URLs (e.g. relative or opaque). Never throws.
- `DOMAIN_COLORS: string[]` — 12 distinct hues, chosen to be distinguishable on the
  dark theme and rendered as translucent backgrounds so child nodes stay readable.
- `partitionByDomain(groups: RecordGroup[]): DomainGroup[]` — partitions deduped
  request groups by domain. Returns an ordered array where `DomainGroup` is:
  ```ts
  interface DomainGroup {
    domain: string;
    color: string;
    groups: RecordGroup[]; // in request order (seq)
  }
  ```
  Ordering: first request appearance (min `seq`), then alphabetical. Color is assigned
  from `DOMAIN_COLORS` in that same order; if more than 12 domains appear, cycle the
  palette (reuse colors). The `color` is the translucent background for the container.

### Extend `packages/ui/src/graph.ts`

Add `buildGroupedGraph(groups, showEdges, orientation)` returning:

```ts
interface DomainNode {
  id: string;        // e.g. `domain:<host>`
  domain: string;
  color: string;     // translucent background
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GroupedGraph {
  domainNodes: DomainNode[];  // React Flow group nodes (type: 'group')
  nodes: GraphNode[];         // request nodes with parentId + extent: 'parent'
  edges: GraphEdge[];
}
```

Layout:
- **Horizontal orientation**: domain containers stacked vertically (top to bottom),
  request nodes flow left→right inside each container.
- **Vertical orientation**: domain containers side-by-side (left to right), request
  nodes flow top→bottom inside each container.
- Container size = bounding box of its children + padding. Children positioned relative
  to their container; set `extent: 'parent'` so they stay inside.
- Edges are the same chronological edges between request nodes (consecutive by `seq`),
  which React Flow renders even across container boundaries.

## Data flow

```
useRequests() -> groupRecords() -> filterGroups()
  -> partitionByDomain() -> buildGroupedGraph() -> React Flow nodes/edges
```

Wired through `useGraph` (extended to return the grouped graph) and rendered in
`App.tsx`/`FlowCanvas`.

## UI changes

- **`RequestNode.tsx`**: replace the truncated full URL with the compact path
  (domain-relative), since the domain is now the container context.
- **`InspectPanel.tsx`**: replace the big URL header with a compact `domain / path`
  breadcrumb, with the domain shown as a badge.
- **`Legend`** (new component, floating bottom-left): lists each visible domain with its
  color swatch. Toggled from the header.

## Error handling

- Unparseable/opaque URLs → `domainOf` falls back to a regex; if no host is extractable,
  group under a sentinel domain label (e.g. the URL string itself or `(unknown)`).
- More than 12 domains → palette cycles; the legend still maps each color to its domain,
  so a reused color is unambiguous within the legend context.

## Testing

- `grouping.test.ts`: `domainOf` (host extraction, fallback), `partitionByDomain`
  (ordering by first-appearance then alphabetically, color assignment, palette cycling).
- `graph.test.ts`: `buildGroupedGraph` layout — container positions/sizes, child
  `parentId`/`extent`, edges preserved, orientation variants.

## Verification

1. `bunx tsc --noEmit -p packages/ui/tsconfig.json`
2. `bun test`
3. `bunx oxlint packages apps` and `bunx oxfmt --write packages apps`
4. `bun run --cwd packages/ui build` (server serves the built bundle)
5. Manual: run `apps/react-app` + tracker, hit a few endpoints across domains, confirm
   colored containers, legend, and sidebar breadcrumb.

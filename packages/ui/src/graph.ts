import type { RequestRecord } from "@vite-http-tracker/shared";
import { partitionByDomain } from "./grouping.js";

export interface GraphNode {
  id: string;
  seq: number;
  method: string;
  url: string;
  status: number;
  transport?: RequestRecord["transport"];
  error?: string;
  timedOut?: boolean;
  poolId?: string;
  poolSize?: number;
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

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  gap?: number;
}

export type NodeSide = "top" | "right" | "bottom" | "left";

export interface EdgeRoute {
  sourceSide: NodeSide;
  targetSide: NodeSide;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface RecordGroup {
  key: string;
  canonical: RequestRecord;
  members: RequestRecord[];
  strictMode: boolean;
}

export const METHOD_COLORS: Record<string, string> = {
  GET: "#4ad295",
  POST: "#54a7ff",
  PUT: "#c07af0",
  DELETE: "#ff6b6b",
};
export const OTHER_METHOD_COLOR = "#cfd3dc";
export const X_GAP = 360;
export const Y_GAP = 220;
export const DUPLICATE_WINDOW_MS = 200;
export const DOMAIN_PADDING = 16;
export const DOMAIN_GAP = 40;
export const NODE_W = 288;
export const NODE_H = 120;

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

export function methodColor(method: string): string {
  return METHOD_COLORS[method.toUpperCase()] ?? OTHER_METHOD_COLOR;
}

export type StatusClass = "success" | "warning" | "error";

export function statusClass(status: number): StatusClass {
  if (status === 0) return "error";
  if (status >= 400) return "error";
  if (status >= 300) return "warning";
  return "success";
}

export function signatureOf(record: RequestRecord): string {
  const hash = record.requestHash ? `|${record.requestHash}` : "";
  return `${record.method}|${record.url}${hash}`;
}

export function groupRecords(
  records: RequestRecord[],
  windowMs = DUPLICATE_WINDOW_MS,
): RecordGroup[] {
  const sorted = [...records].sort((a, b) => a.seq - b.seq);
  const bySig = new Map<string, RecordGroup[]>();
  const groups: RecordGroup[] = [];
  for (const record of sorted) {
    const sig = signatureOf(record);
    const list = bySig.get(sig) ?? [];
    const last = list[list.length - 1];
    const lastMember = last?.members[last.members.length - 1];
    if (last && lastMember && record.startTime - lastMember.startTime <= windowMs) {
      last.members.push(record);
    } else {
      const group: RecordGroup = {
        key: sig,
        canonical: record,
        members: [record],
        strictMode: !!record.strictMode,
      };
      list.push(group);
      groups.push(group);
    }
    bySig.set(sig, list);
  }
  return groups;
}

export interface RecordFilter {
  method?: string;
  transport?: RequestRecord["transport"];
  status?: string;
  url?: string;
}

export function matchesFilter(record: RequestRecord, f: RecordFilter): boolean {
  if (f.method && record.method.toUpperCase() !== f.method.toUpperCase()) return false;
  if (f.transport && record.transport !== f.transport) return false;
  if (f.status && String(record.status) !== f.status) return false;
  if (f.url && !record.url.toLowerCase().includes(f.url.toLowerCase())) return false;
  return true;
}

export function filterRecords(records: RequestRecord[], f: RecordFilter): RequestRecord[] {
  return records.filter((r) => matchesFilter(r, f));
}

export function filterGroups(groups: RecordGroup[], f: RecordFilter): RecordGroup[] {
  return groups.filter((g) => matchesFilter(g.canonical, f));
}

export type Orientation = "horizontal" | "vertical";

export function routeForNodes(
  source: Pick<GraphNode, "parentId" | "x" | "y">,
  target: Pick<GraphNode, "parentId" | "x" | "y">,
  orientation: Orientation,
): EdgeRoute {
  if (source.parentId === target.parentId) {
    return orientation === "horizontal"
      ? { sourceSide: "right", targetSide: "left" }
      : { sourceSide: "bottom", targetSide: "top" };
  }

  if (orientation === "horizontal") {
    return source.y <= target.y
      ? { sourceSide: "bottom", targetSide: "top" }
      : { sourceSide: "top", targetSide: "bottom" };
  }

  return source.x <= target.x
    ? { sourceSide: "right", targetSide: "left" }
    : { sourceSide: "left", targetSide: "right" };
}

export function buildGraph(
  groups: RecordGroup[],
  showEdges: boolean,
  orientation: Orientation = "horizontal",
): Graph {
  const sorted = [...groups].sort((a, b) => a.canonical.seq - b.canonical.seq);
  const batchSizes = new Map<string, number>();
  const poolSizes = new Map<string, number>();
  for (const g of sorted) {
    const id = g.canonical.batchId;
    if (id) batchSizes.set(id, (batchSizes.get(id) ?? 0) + 1);
    if (g.canonical.poolId)
      poolSizes.set(g.canonical.poolId, (poolSizes.get(g.canonical.poolId) ?? 0) + 1);
  }
  const nodes: GraphNode[] = sorted.map((g, i) => ({
    id: g.canonical.requestId,
    seq: g.canonical.seq,
    method: g.canonical.method,
    url: g.canonical.url,
    status: g.canonical.status,
    transport: g.canonical.transport,
    error: g.canonical.error,
    timedOut: g.canonical.timedOut,
    poolId: g.canonical.poolId,
    poolSize: g.canonical.poolId ? (poolSizes.get(g.canonical.poolId) ?? 0) : 0,
    duration: g.canonical.duration,
    x: orientation === "horizontal" ? i * X_GAP : 0,
    y: orientation === "vertical" ? i * Y_GAP : 0,
    dupCount: g.members.length,
    strictMode: g.strictMode,
    memberIds: g.members.map((m) => m.requestId),
    batchId: g.canonical.batchId,
    batchSize: g.canonical.batchId ? (batchSizes.get(g.canonical.batchId) ?? 0) : 0,
  }));
  const edges: GraphEdge[] = [];
  if (showEdges) {
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
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
  return { nodes, edges };
}

export function buildGroupedGraph(
  groups: RecordGroup[],
  showEdges: boolean,
  orientation: Orientation = "horizontal",
): GroupedGraph {
  const batchSizes = new Map<string, number>();
  const poolSizes = new Map<string, number>();
  for (const g of groups) {
    const id = g.canonical.batchId;
    if (id) batchSizes.set(id, (batchSizes.get(id) ?? 0) + 1);
    if (g.canonical.poolId)
      poolSizes.set(g.canonical.poolId, (poolSizes.get(g.canonical.poolId) ?? 0) + 1);
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
      transport: g.canonical.transport,
      error: g.canonical.error,
      timedOut: g.canonical.timedOut,
      poolId: g.canonical.poolId,
      poolSize: g.canonical.poolId ? (poolSizes.get(g.canonical.poolId) ?? 0) : 0,
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
      domainNodes.push({
        id: dId,
        domain: d.domain,
        color: d.color,
        x: 0,
        y: cursor,
        width,
        height,
      });
      cursor += height + DOMAIN_GAP;
    } else {
      domainNodes.push({
        id: dId,
        domain: d.domain,
        color: d.color,
        x: cursor,
        y: 0,
        width,
        height,
      });
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

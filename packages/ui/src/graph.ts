import type { RequestRecord } from "@http-tracker/shared";

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
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  gap?: number;
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
export const X_GAP = 240;
export const Y_GAP = 120;
export const DUPLICATE_WINDOW_MS = 200;

export function methodColor(method: string): string {
  return METHOD_COLORS[method.toUpperCase()] ?? OTHER_METHOD_COLOR;
}

export type StatusClass = "success" | "warning" | "error";

export function statusClass(status: number): StatusClass {
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
  status?: string;
  url?: string;
}

export function matchesFilter(record: RequestRecord, f: RecordFilter): boolean {
  if (f.method && record.method.toUpperCase() !== f.method.toUpperCase()) return false;
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

export function buildGraph(
  groups: RecordGroup[],
  showEdges: boolean,
  orientation: Orientation = "horizontal",
): Graph {
  const sorted = [...groups].sort((a, b) => a.canonical.seq - b.canonical.seq);
  const batchSizes = new Map<string, number>();
  for (const g of sorted) {
    const id = g.canonical.batchId;
    if (id) batchSizes.set(id, (batchSizes.get(id) ?? 0) + 1);
  }
  const nodes: GraphNode[] = sorted.map((g, i) => ({
    id: g.canonical.requestId,
    seq: g.canonical.seq,
    method: g.canonical.method,
    url: g.canonical.url,
    status: g.canonical.status,
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

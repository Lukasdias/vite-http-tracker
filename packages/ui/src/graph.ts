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
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
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

export function methodColor(method: string): string {
  return METHOD_COLORS[method.toUpperCase()] ?? OTHER_METHOD_COLOR;
}

export interface RecordFilter {
  method?: string;
  status?: string;
  url?: string;
}

export function filterRecords(records: RequestRecord[], f: RecordFilter): RequestRecord[] {
  return records.filter((r) => {
    if (f.method && r.method.toUpperCase() !== f.method.toUpperCase()) return false;
    if (f.status && String(r.status) !== f.status) return false;
    if (f.url && !r.url.toLowerCase().includes(f.url.toLowerCase())) return false;
    return true;
  });
}

export function buildGraph(records: RequestRecord[], showEdges: boolean): Graph {
  const sorted = [...records].sort((a, b) => a.seq - b.seq);
  const nodes: GraphNode[] = sorted.map((r, i) => ({
    id: r.requestId,
    seq: r.seq,
    method: r.method,
    url: r.url,
    status: r.status,
    duration: r.duration,
    x: i * X_GAP,
    y: 0,
  }));
  const edges: GraphEdge[] = [];
  if (showEdges) {
    for (let i = 1; i < nodes.length; i++) {
      const prev = nodes[i - 1];
      const cur = nodes[i];
      if (prev && cur) edges.push({ id: "e" + i, source: prev.id, target: cur.id });
    }
  }
  return { nodes, edges };
}

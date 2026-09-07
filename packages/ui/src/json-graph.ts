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
      const obj = v as Record<string, JsonValue>;
      for (const key of Object.keys(obj)) {
        const child = obj[key];
        if (child !== undefined) stack.push(child);
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
  const queue: Pending[] = [{ id: "$", key: "$", value, depth: 0, collapsed: collapsed.has("$") }];
  const levels = new Map<number, number>();
  let edgeSeq = 0;

  while (queue.length) {
    const p = queue.shift();
    if (!p) continue;
    const kind = kindOf(p.value);

    if (kind === "object" || kind === "array") {
      const entries = Array.isArray(p.value)
        ? p.value.map((v, i) => ({ key: String(i), value: v }))
        : Object.entries(p.value as Record<string, JsonValue>).map(([key, v]) => ({
            key,
            value: v,
          }));
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
          if (childKind === "object" || childKind === "array" || nested !== undefined) {
            queue.push({
              id: childId,
              key: e.key,
              value: nested !== undefined ? (JSON.parse(nested) as JsonValue) : e.value,
              depth: p.depth + 1,
              collapsed: collapsed.has(childId),
            });
          } else {
            nodes.push({
              id: childId,
              key: e.key,
              kind: childKind,
              value: scalarText(e.value, childKind),
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

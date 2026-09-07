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
export const ARC_RADIUS = 180;

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

interface TreeNode {
  id: string;
  key: string;
  kind: JsonKind;
  value?: string;
  depth: number;
  childCount: number;
  children: TreeNode[];
  x: number;
  y: number;
}

function buildNode(
  id: string,
  key: string,
  value: JsonValue,
  depth: number,
  collapsed: ReadonlySet<string>,
): TreeNode {
  const kind = kindOf(value);
  if (kind === "object" || kind === "array") {
    const entries = Array.isArray(value)
      ? value.map((v, i) => ({ key: String(i), value: v }))
      : Object.entries(value as Record<string, JsonValue>).map(([k, v]) => ({ key: k, value: v }));
    let childCount = 0;
    for (const e of entries) childCount += countJsonNodes(e.value);
    const children: TreeNode[] = [];
    if (!collapsed.has(id)) {
      for (const e of entries) {
        const childId = `${id}.${e.key}`;
        const nested = jsonString(e.value);
        const childValue = nested !== undefined ? (JSON.parse(nested) as JsonValue) : e.value;
        children.push(buildNode(childId, e.key, childValue, depth + 1, collapsed));
      }
    }
    return { id, key, kind, depth, childCount, children, x: 0, y: 0 };
  }
  return {
    id,
    key,
    kind,
    value: scalarText(value, kind),
    depth,
    childCount: 0,
    children: [],
    x: 0,
    y: 0,
  };
}

function leafCount(node: TreeNode): number {
  if (node.children.length === 0) return 1;
  let sum = 0;
  for (const c of node.children) sum += leafCount(c);
  return sum;
}

function place(node: TreeNode, depth: number, a0: number, a1: number): void {
  const angle = (a0 + a1) / 2;
  node.x = depth * ARC_RADIUS * Math.cos(angle);
  node.y = depth * ARC_RADIUS * Math.sin(angle);
  if (node.children.length === 0) return;
  const total = node.children.reduce((s, c) => s + leafCount(c), 0);
  let cursor = a0;
  for (const c of node.children) {
    const span = total > 0 ? (leafCount(c) / total) * (a1 - a0) : (a1 - a0) / node.children.length;
    place(c, depth + 1, cursor, cursor + span);
    cursor += span;
  }
}

function flatten(node: TreeNode, outNodes: JsonGraphNode[], outEdges: JsonGraphEdge[]): void {
  outNodes.push({
    id: node.id,
    key: node.key,
    kind: node.kind,
    value: node.value,
    depth: node.depth,
    childCount: node.childCount,
    x: node.x,
    y: node.y,
  });
  for (const c of node.children) {
    outEdges.push({ id: "jg" + outEdges.length, source: node.id, target: c.id, label: c.key });
    flatten(c, outNodes, outEdges);
  }
}

export function buildJsonGraph(value: JsonValue, collapsed: ReadonlySet<string>): JsonGraphResult {
  const count = countJsonNodes(value);
  if (count > MAX_GRAPH_NODES) return { ok: false, count };

  const root = buildNode("$", "$", value, 0, collapsed);
  place(root, 0, 0, Math.PI * 2);
  const nodes: JsonGraphNode[] = [];
  const edges: JsonGraphEdge[] = [];
  flatten(root, nodes, edges);
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

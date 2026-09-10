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
}

export interface JsonGraph {
  nodes: JsonGraphNode[];
  edges: JsonGraphEdge[];
  rootId: string;
}

export type JsonGraphResult = { ok: true; graph: JsonGraph } | { ok: false; count: number };

export const MAX_GRAPH_NODES = 2000;
export const JSON_NODE_WIDTH = 280;
export const X_GAP = JSON_NODE_WIDTH + 60;
export const Y_GAP = 40;

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

function layoutTree(node: TreeNode, depth: number, cursor: { value: number }): void {
  node.x = depth * X_GAP;
  if (node.children.length === 0) {
    node.y = cursor.value;
    cursor.value += Y_GAP;
    return;
  }
  let sumY = 0;
  for (const c of node.children) {
    layoutTree(c, depth + 1, cursor);
    sumY += c.y;
  }
  node.y = sumY / node.children.length;
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
    outEdges.push({ id: "jg" + outEdges.length, source: node.id, target: c.id });
    flatten(c, outNodes, outEdges);
  }
}

export function buildJsonGraph(value: JsonValue, collapsed: ReadonlySet<string>): JsonGraphResult {
  const count = countJsonNodes(value);
  if (count > MAX_GRAPH_NODES) return { ok: false, count };

  const root = buildNode("$", "$", value, 0, collapsed);
  const cursor = { value: 0 };
  layoutTree(root, 0, cursor);
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

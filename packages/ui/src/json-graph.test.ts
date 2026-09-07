import { describe, expect, test } from "bun:test";
import {
  ARC_RADIUS,
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

  test("places nodes on concentric arcs", () => {
    const g = ok(buildJsonGraph(tree, new Set()));
    const byId = new Map(g.nodes.map((n) => [n.id, n]));
    const root = byId.get("$");
    const users = byId.get("$.users");
    const total = byId.get("$.total");
    const users0 = byId.get("$.users.0");
    expect(root?.x).toBeCloseTo(0, 5);
    expect(root?.y).toBeCloseTo(0, 5);
    const r1 = Math.hypot(users?.x ?? 0, users?.y ?? 0);
    expect(r1).toBeCloseTo(ARC_RADIUS, 5);
    const r1b = Math.hypot(total?.x ?? 0, total?.y ?? 0);
    expect(r1b).toBeCloseTo(ARC_RADIUS, 5);
    const r2 = Math.hypot(users0?.x ?? 0, users0?.y ?? 0);
    expect(r2).toBeCloseTo(2 * ARC_RADIUS, 5);
    expect(users?.x).not.toBe(total?.x);
    expect(users?.y).not.toBe(total?.y);
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

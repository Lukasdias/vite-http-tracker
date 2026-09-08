import { describe, expect, test } from "bun:test";
import {
  X_GAP,
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

  test("creates edges between parent and children", () => {
    const g = ok(buildJsonGraph(tree, new Set()));
    const sources = new Set(g.edges.map((e) => e.source));
    expect(sources.has("$")).toBe(true);
    expect(sources.has("$.users")).toBe(true);
    expect(g.edges.some((e) => e.target === "$.users")).toBe(true);
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

  test("lays out nodes left-to-right by depth, siblings stacked", () => {
    const g = ok(buildJsonGraph(tree, new Set()));
    const byId = new Map(g.nodes.map((n) => [n.id, n]));
    const root = byId.get("$");
    const users = byId.get("$.users");
    const total = byId.get("$.total");
    const users0 = byId.get("$.users.0");
    expect(root?.x).toBe(0);
    expect(users?.x).toBe(X_GAP);
    expect(total?.x).toBe(X_GAP);
    expect(users0?.x).toBe(2 * X_GAP);
    expect(users?.y).not.toBe(total?.y);
    expect(users0?.y).not.toBe(users?.y);
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

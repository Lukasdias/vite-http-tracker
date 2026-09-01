import { describe, expect, test } from "bun:test";
import type { RequestRecord } from "@http-tracker/shared";
import { buildGraph, filterRecords, methodColor, OTHER_METHOD_COLOR } from "./graph.js";

const mk = (partial: Partial<RequestRecord>): RequestRecord => ({
  requestId: partial.requestId ?? "id",
  seq: partial.seq ?? 1,
  method: partial.method ?? "GET",
  url: partial.url ?? "/x",
  status: partial.status ?? 200,
  startTime: partial.startTime ?? 1,
  endTime: partial.endTime ?? 1,
  duration: partial.duration ?? 0,
});

describe("methodColor", () => {
  test("returns known method color and a fallback otherwise", () => {
    expect(methodColor("GET")).toBe("#4ad295");
    expect(methodColor("get")).toBe("#4ad295");
    expect(methodColor("PATCH")).toBe(OTHER_METHOD_COLOR);
  });
});

describe("filterRecords", () => {
  const recs = [
    mk({ requestId: "a", method: "GET", url: "/users", status: 200 }),
    mk({ requestId: "b", method: "POST", url: "/users", status: 201 }),
    mk({ requestId: "c", method: "GET", url: "/orders", status: 404 }),
  ];
  test("filters by method", () => {
    expect(filterRecords(recs, { method: "GET" }).map((r) => r.requestId)).toEqual(["a", "c"]);
  });
  test("filters by status", () => {
    expect(filterRecords(recs, { status: "404" }).map((r) => r.requestId)).toEqual(["c"]);
  });
  test("filters by url substring", () => {
    expect(filterRecords(recs, { url: "orders" }).map((r) => r.requestId)).toEqual(["c"]);
  });
  test("empty filter returns all", () => {
    expect(filterRecords(recs, {}).length).toBe(3);
  });
});

describe("buildGraph", () => {
  const recs = [
    mk({ requestId: "a", seq: 2 }),
    mk({ requestId: "b", seq: 1 }),
    mk({ requestId: "c", seq: 3 }),
  ];
  test("orders nodes by seq and lays out left to right", () => {
    const { nodes } = buildGraph(recs, false);
    expect(nodes.map((n) => n.seq)).toEqual([1, 2, 3]);
    expect(nodes[0]!.x).toBeLessThan(nodes[1]!.x);
    expect(nodes[1]!.x).toBeLessThan(nodes[2]!.x);
  });
  test("produces sequence edges only when enabled", () => {
    expect(buildGraph(recs, false).edges.length).toBe(0);
    const edges = buildGraph(recs, true).edges;
    expect(edges.length).toBe(2);
    expect(edges[0]!.source).toBe("b");
    expect(edges[0]!.target).toBe("a");
    expect(edges[1]!.target).toBe("c");
  });
});

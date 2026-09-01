import { describe, expect, test } from "bun:test";
import type { RequestRecord } from "@http-tracker/shared";
import {
  buildGraph,
  filterGroups,
  groupRecords,
  matchesFilter,
  methodColor,
  statusClass,
  OTHER_METHOD_COLOR,
} from "./graph.js";

const mk = (partial: Partial<RequestRecord>): RequestRecord => ({
  requestId: partial.requestId ?? "id",
  seq: partial.seq ?? 1,
  method: partial.method ?? "GET",
  url: partial.url ?? "/x",
  status: partial.status ?? 200,
  startTime: partial.startTime ?? 1,
  endTime: partial.endTime ?? 1,
  duration: partial.duration ?? 0,
  strictMode: partial.strictMode ?? false,
  batchId: partial.batchId,
});

describe("methodColor", () => {
  test("returns known method color and a fallback otherwise", () => {
    expect(methodColor("GET")).toBe("#4ad295");
    expect(methodColor("get")).toBe("#4ad295");
    expect(methodColor("PATCH")).toBe(OTHER_METHOD_COLOR);
  });
});

describe("statusClass", () => {
  test("maps http status to a semantic class", () => {
    expect(statusClass(200)).toBe("success");
    expect(statusClass(304)).toBe("warning");
    expect(statusClass(404)).toBe("error");
    expect(statusClass(500)).toBe("error");
  });
});

describe("matchesFilter", () => {
  const recs = [
    mk({ requestId: "a", method: "GET", url: "/users", status: 200 }),
    mk({ requestId: "b", method: "POST", url: "/users", status: 201 }),
    mk({ requestId: "c", method: "GET", url: "/orders", status: 404 }),
  ];
  test("filters by method, status and url substring", () => {
    expect(recs.filter((r) => matchesFilter(r, { method: "GET" })).map((r) => r.requestId)).toEqual(
      ["a", "c"],
    );
    expect(recs.filter((r) => matchesFilter(r, { status: "404" })).map((r) => r.requestId)).toEqual(
      ["c"],
    );
    expect(recs.filter((r) => matchesFilter(r, { url: "orders" })).map((r) => r.requestId)).toEqual(
      ["c"],
    );
    expect(recs.filter((r) => matchesFilter(r, {})).length).toBe(3);
  });
});

describe("groupRecords", () => {
  test("groups identical signatures within the window", () => {
    const recs = [
      mk({ requestId: "a", seq: 1, url: "/todos/1", startTime: 0, strictMode: true }),
      mk({ requestId: "b", seq: 2, url: "/users/1", startTime: 1, strictMode: true }),
      mk({ requestId: "c", seq: 3, url: "/todos/1", startTime: 2, strictMode: true }),
      mk({ requestId: "d", seq: 4, url: "/users/1", startTime: 3, strictMode: true }),
    ];
    const groups = groupRecords(recs);
    expect(groups.length).toBe(2);
    const todos = groups.find((g) => g.canonical.url === "/todos/1")!;
    expect(todos.members.length).toBe(2);
    expect(todos.strictMode).toBe(true);
    expect(todos.members.map((m) => m.requestId)).toEqual(["a", "c"]);
  });
  test("keeps cheap timing apart", () => {
    const recs = [
      mk({ requestId: "a", seq: 1, url: "/todos/1", startTime: 0 }),
      mk({ requestId: "b", seq: 2, url: "/todos/1", startTime: 1000 }),
    ];
    expect(groupRecords(recs).length).toBe(2);
  });
});

describe("filterGroups", () => {
  const groups = groupRecords([
    mk({ requestId: "a", seq: 1, method: "GET", url: "/users", status: 200 }),
    mk({ requestId: "b", seq: 2, method: "GET", url: "/orders", status: 404 }),
  ]);
  test("filters by canonical record", () => {
    expect(filterGroups(groups, { status: "404" }).map((g) => g.canonical.requestId)).toEqual([
      "b",
    ]);
  });
});

describe("buildGraph", () => {
  test("orders nodes by seq, collapsing duplicate groups, and lays out left-right", () => {
    const groups = groupRecords([
      mk({ requestId: "a", seq: 2, url: "/b", strictMode: true }),
      mk({ requestId: "b", seq: 1, url: "/a" }),
      mk({ requestId: "c", seq: 3, url: "/b", strictMode: true }),
    ]);
    const { nodes, edges } = buildGraph(groups, true);
    expect(nodes.length).toBe(2);
    expect(nodes[0]!.id).toBe("b");
    expect(nodes[0]!.x).toBeLessThan(nodes[1]!.x);
    expect(nodes[0]!.dupCount).toBe(1);
    expect(nodes[1]!.dupCount).toBe(2);
    expect(nodes[1]!.strictMode).toBe(true);
    expect(nodes[1]!.id).toBe("a");
    expect(edges.length).toBe(1);
    expect(edges[0]!.source).toBe("b");
    expect(edges[0]!.target).toBe("a");
  });

  test("vertical orientation stacks nodes on the y axis", () => {
    const flat = [
      mk({ requestId: "x", seq: 1, url: "/a" }),
      mk({ requestId: "y", seq: 2, url: "/b" }),
    ];
    const { nodes } = buildGraph(groupRecords(flat), false, "vertical");
    expect(nodes[0]!.x).toBe(0);
    expect(nodes[1]!.x).toBe(0);
    expect(nodes[0]!.y).toBeLessThan(nodes[1]!.y);
  });

  test("edges connect consecutive calls in time order with a gap", () => {
    const flat = [
      mk({ requestId: "a", seq: 1, url: "/a", startTime: 0 }),
      mk({ requestId: "b", seq: 2, url: "/b", startTime: 40 }),
      mk({ requestId: "c", seq: 3, url: "/c", startTime: 120 }),
    ];
    const { edges } = buildGraph(groupRecords(flat), true);
    expect(edges.length).toBe(2);
    expect(edges[0]!.source).toBe("a");
    expect(edges[0]!.target).toBe("b");
    expect(edges[0]!.gap).toBe(40);
    expect(edges[1]!.source).toBe("b");
    expect(edges[1]!.target).toBe("c");
  });

  test("parallel requests are grouped as a batch", () => {
    const recs = [
      mk({ requestId: "a", seq: 1, url: "/todos/1", startTime: 0, endTime: 50, batchId: "b1" }),
      mk({ requestId: "b", seq: 2, url: "/posts/1", startTime: 1, endTime: 60, batchId: "b1" }),
    ];
    const { nodes } = buildGraph(groupRecords(recs), false);
    expect(nodes[0]!.batchSize).toBe(2);
    expect(nodes[1]!.batchSize).toBe(2);
  });
});

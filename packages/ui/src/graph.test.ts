import { describe, expect, test } from "bun:test";
import type { RequestRecord } from "@vite-http-tracker/shared";
import {
  buildGraph,
  buildGroupedGraph,
  routeForNodes,
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
  poolId: partial.poolId,
  transport: partial.transport,
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
  test("filters by transport", () => {
    const streams = [
      mk({ requestId: "sse", transport: "sse" }),
      mk({ requestId: "ws", transport: "websocket" }),
    ];
    expect(
      streams.filter((r) => matchesFilter(r, { transport: "sse" })).map((r) => r.requestId),
    ).toEqual(["sse"]);
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
  test("exposes pool membership and its size on pooled nodes", () => {
    const recs = [
      mk({ requestId: "a", seq: 1, url: "/users/1", poolId: "users" }),
      mk({ requestId: "b", seq: 2, url: "/users/2", poolId: "users" }),
      mk({ requestId: "c", seq: 3, url: "/posts/1" }),
    ];
    const { nodes } = buildGraph(groupRecords(recs), false);
    expect(nodes[0]!.poolId).toBe("users");
    expect(nodes[0]!.poolSize).toBe(2);
    expect(nodes[1]!.poolSize).toBe(2);
    expect(nodes[2]!.poolId).toBeUndefined();
  });
});

describe("buildGroupedGraph", () => {
  test("wraps request groups in domain containers with parentId and extent", () => {
    const recs = [
      mk({ requestId: "a", seq: 1, url: "https://api.example.com/v1/users" }),
      mk({ requestId: "b", seq: 2, url: "https://api.example.com/v1/posts" }),
      mk({ requestId: "c", seq: 3, url: "https://cdn.example.com/x.js" }),
    ];
    const { domainNodes, nodes, edges } = buildGroupedGraph(groupRecords(recs), true);
    expect(domainNodes.length).toBe(2);
    expect(domainNodes.map((d) => d.domain)).toEqual(["api.example.com", "cdn.example.com"]);
    expect(nodes.every((n) => n.parentId && n.extent === "parent")).toBe(true);
    expect(nodes[0]!.parentId).toBe("domain:api.example.com");
    expect(edges.length).toBe(2);
  });
  test("stacks containers vertically in horizontal orientation and sizes them", () => {
    const recs = [
      mk({ requestId: "a", seq: 1, url: "https://a.com/x" }),
      mk({ requestId: "b", seq: 2, url: "https://b.com/y" }),
    ];
    const { domainNodes } = buildGroupedGraph(groupRecords(recs), false, "horizontal");
    expect(domainNodes[0]!.y).toBe(0);
    expect(domainNodes[1]!.y).toBeGreaterThan(domainNodes[0]!.y);
    expect(domainNodes[0]!.width).toBeGreaterThan(0);
    expect(domainNodes[0]!.height).toBeGreaterThan(0);
  });
  test("places containers side by side in vertical orientation", () => {
    const recs = [
      mk({ requestId: "a", seq: 1, url: "https://a.com/x" }),
      mk({ requestId: "b", seq: 2, url: "https://b.com/y" }),
    ];
    const { domainNodes } = buildGroupedGraph(groupRecords(recs), false, "vertical");
    expect(domainNodes[0]!.x).toBe(0);
    expect(domainNodes[1]!.x).toBeGreaterThan(domainNodes[0]!.x);
    expect(domainNodes[0]!.y).toBe(0);
  });
});

describe("routeForNodes", () => {
  test("routes nodes in the same horizontal group from right to left", () => {
    expect(
      routeForNodes(
        { parentId: "domain:a", x: 0, y: 0 },
        { parentId: "domain:a", x: 360, y: 0 },
        "horizontal",
      ),
    ).toEqual({ sourceSide: "right", targetSide: "left" });
  });

  test("routes external horizontal connections through vertical sides", () => {
    expect(
      routeForNodes(
        { parentId: "domain:a", x: 0, y: 0 },
        { parentId: "domain:b", x: 0, y: 220 },
        "horizontal",
      ),
    ).toEqual({ sourceSide: "bottom", targetSide: "top" });
  });

  test("routes external vertical connections through horizontal sides", () => {
    expect(
      routeForNodes(
        { parentId: "domain:a", x: 0, y: 0 },
        { parentId: "domain:b", x: 360, y: 0 },
        "vertical",
      ),
    ).toEqual({ sourceSide: "right", targetSide: "left" });
  });
});

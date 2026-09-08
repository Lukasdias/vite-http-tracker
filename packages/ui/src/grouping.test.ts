import { describe, expect, test } from "bun:test";
import type { RequestRecord } from "@vite-http-tracker/shared";
import { groupRecords } from "./graph.js";
import { DOMAIN_COLORS, UNKNOWN_DOMAIN, domainOf, partitionByDomain, pathOf } from "./grouping.js";

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

describe("domainOf", () => {
  test("extracts hostname from absolute urls", () => {
    expect(domainOf("https://api.example.com/v1/users")).toBe("api.example.com");
    expect(domainOf("http://localhost:3000/api")).toBe("localhost");
  });
  test("falls back to the unknown sentinel for unparseable urls", () => {
    expect(domainOf("/api/users")).toBe(UNKNOWN_DOMAIN);
  });
});

describe("pathOf", () => {
  test("returns path plus search for absolute urls", () => {
    expect(pathOf("https://api.example.com/v1/users?id=1")).toBe("/v1/users?id=1");
  });
  test("returns the raw url for relative urls", () => {
    expect(pathOf("/api/users")).toBe("/api/users");
  });
});

describe("partitionByDomain", () => {
  test("orders domains by first appearance then alphabetically and assigns colors", () => {
    const recs = [
      mk({ requestId: "a", seq: 1, url: "https://b.com/x" }),
      mk({ requestId: "b", seq: 2, url: "https://a.com/x" }),
      mk({ requestId: "c", seq: 3, url: "https://b.com/y" }),
    ];
    const domains = partitionByDomain(groupRecords(recs));
    expect(domains.map((d) => d.domain)).toEqual(["b.com", "a.com"]);
    expect(domains[0]!.color).toBe(DOMAIN_COLORS[0]!);
    expect(domains[1]!.color).toBe(DOMAIN_COLORS[1]!);
    expect(domains[0]!.groups.map((g) => g.canonical.url)).toEqual([
      "https://b.com/x",
      "https://b.com/y",
    ]);
  });
  test("cycles the palette when more than 12 domains appear", () => {
    const recs = Array.from({ length: 13 }, (_, i) =>
      mk({ requestId: `r${i}`, seq: i + 1, url: `https://d${i}.com/x` }),
    );
    const domains = partitionByDomain(groupRecords(recs));
    expect(domains.length).toBe(13);
    expect(domains[0]!.color).toBe(DOMAIN_COLORS[0]!);
    expect(domains[12]!.color).toBe(DOMAIN_COLORS[0]!);
  });
});

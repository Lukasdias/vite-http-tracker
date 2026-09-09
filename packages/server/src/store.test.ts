import { describe, expect, test } from "bun:test";
import { RequestStore } from "./store.js";

const mk = (seq: number, size: number) =>
  ({
    requestId: String(seq),
    seq,
    method: "GET",
    url: `u${seq}`,
    status: 200,
    startTime: 1,
    endTime: 1,
    duration: 0,
    bodySizeBytes: size,
  }) as never;

describe("RequestStore", () => {
  test("adds and snapshots in insertion order", () => {
    const s = new RequestStore({ byteCap: 1000 });
    s.add(mk(1, 10));
    s.add(mk(2, 10));
    expect(s.count()).toBe(2);
    expect(s.snapshot().map((r) => r.seq)).toEqual([1, 2]);
  });
  test("evicts oldest when over byte cap", () => {
    const s = new RequestStore({ byteCap: 100 });
    s.add(mk(1, 60));
    s.add(mk(2, 60));
    expect(s.count()).toBe(1);
    expect(s.snapshot()[0]?.seq).toBe(2);
  });
  test("clear empties store", () => {
    const s = new RequestStore({ byteCap: 1000 });
    s.add(mk(1, 10));
    s.clear();
    expect(s.count()).toBe(0);
  });
  test("ignores a replayed request id", () => {
    const s = new RequestStore({ byteCap: 1000 });
    expect(s.add(mk(1, 10))).toBe(true);
    expect(s.add(mk(1, 10))).toBe(false);
    expect(s.count()).toBe(1);
    expect(s.sizeInBytes).toBe(10);
  });
});

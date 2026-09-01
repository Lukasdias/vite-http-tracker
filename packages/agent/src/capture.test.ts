import { describe, expect, test } from "bun:test";
import { hashRequest, parseHeaders, serializeBody } from "./capture.js";

describe("serializeBody", () => {
  test("serializes JSON", () => {
    const r = serializeBody({ a: 1 });
    expect(r.body).toBe('{"a":1}');
    expect(r.truncated).toBe(false);
  });
  test("serializes string as-is", () => {
    expect(serializeBody("x=1")).toEqual({ body: "x=1", truncated: false, size: 3 });
  });
  test("marks null body", () => {
    expect(serializeBody(undefined)).toEqual({ body: undefined, truncated: false, size: 0 });
  });
  test("skips FormData bodies (not re-readable)", () => {
    const fd = new FormData();
    expect(serializeBody(fd).body).toBeUndefined();
  });
  test("truncates bodies over cap", () => {
    expect(serializeBody({ a: "x".repeat(10) }, 5).truncated).toBe(true);
  });
});

describe("parseHeaders", () => {
  test("reads from Headers object (keys are case-normalized)", () => {
    const h = new Headers({ "Content-Type": "application/json" });
    expect(parseHeaders(h)["content-type"]).toBe("application/json");
  });
  test("passes through plain object", () => {
    expect(parseHeaders({ A: "1" })).toEqual({ A: "1" });
  });
});

describe("hashRequest", () => {
  test("is stable and includes url", () => {
    expect(hashRequest("GET", "https://a/b")).toBe(hashRequest("GET", "https://a/b"));
    expect(hashRequest("GET", "https://a/b")).not.toBe(hashRequest("GET", "https://a/c"));
  });
  test("includes body", () => {
    expect(hashRequest("POST", "https://a/b", '{"x":1}')).not.toBe(hashRequest("POST", "https://a/b", '{"x":2}'));
  });
});

import { describe, expect, test } from "bun:test";
import { batchFor, hashRequest, parseHeaders, readStreamBody, serializeBody } from "./capture.js";
import { DEFAULT_BODY_CAP } from "@vite-http-tracker/shared";

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

describe("readStreamBody", () => {
  test("stops reading after the response body cap", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x".repeat(DEFAULT_BODY_CAP + 1)));
        controller.close();
      },
    });

    const result = await readStreamBody(stream);

    expect(result.body).toBeUndefined();
    expect(result.truncated).toBe(true);
    expect(result.size).toBeGreaterThan(DEFAULT_BODY_CAP);
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

describe("batchFor", () => {
  test("groups requests started within the turn window", () => {
    const a = batchFor(1000);
    expect(batchFor(1001)).toBe(a);
  });
  test("separates requests started far apart", () => {
    const a = batchFor(1000);
    expect(batchFor(2000)).not.toBe(a);
  });
});

describe("hashRequest", () => {
  test("is stable and includes url", () => {
    expect(hashRequest("GET", "https://a/b")).toBe(hashRequest("GET", "https://a/b"));
    expect(hashRequest("GET", "https://a/b")).not.toBe(hashRequest("GET", "https://a/c"));
  });
  test("includes body", () => {
    expect(hashRequest("POST", "https://a/b", '{"x":1}')).not.toBe(
      hashRequest("POST", "https://a/b", '{"x":2}'),
    );
  });
});

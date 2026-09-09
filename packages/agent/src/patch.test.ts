/// <reference lib="dom" />
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { DEFAULT_BODY_CAP } from "@vite-http-tracker/shared";
import { patchFetch } from "./patch-fetch.js";

beforeAll(() => {
  GlobalRegistrator.register();
});
afterAll(() => {
  GlobalRegistrator.unregister();
});

describe("patchFetch", () => {
  test("patches window.fetch and restores", () => {
    const original = window.fetch;
    const sink = { enqueue: () => {} };
    const restore = patchFetch(sink as never);
    expect(window.fetch).not.toBe(original);
    restore();
    expect(window.fetch).toBe(original);
  });
  test("emits a record when a fetch resolves", async () => {
    const captured: unknown[] = [];
    const res = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    window.fetch = (async () => res) as unknown as typeof window.fetch;
    const restore = patchFetch({ enqueue: (r: unknown) => captured.push(r) } as never);
    await window.fetch("/api/x");
    expect(captured.length).toBe(1);
    const rec = captured[0] as { method: string; url: string; status: number; requestHash: string };
    expect(rec.method).toBe("GET");
    expect(rec.url).toBe("/api/x");
    expect(rec.status).toBe(200);
    expect(typeof rec.requestHash).toBe("string");
    restore();
  });
  test("emits an error record when fetch rejects", async () => {
    const captured: Record<string, unknown>[] = [];
    window.fetch = (async () => {
      throw new DOMException("The operation was aborted", "AbortError");
    }) as unknown as typeof window.fetch;
    const restore = patchFetch({
      enqueue: (record: Record<string, unknown>) => captured.push(record),
    } as never);
    await expect(window.fetch("/slow")).rejects.toThrow("aborted");
    expect(captured[0]?.status).toBe(0);
    expect(captured[0]?.timedOut).toBe(true);
    restore();
  });
  test("does not retain a response body larger than the cap", async () => {
    const captured: Record<string, unknown>[] = [];
    const largeBody = "x".repeat(DEFAULT_BODY_CAP + 1);
    const response = new Response(largeBody, {
      status: 200,
      headers: {
        "content-type": "text/plain",
        "content-length": String(DEFAULT_BODY_CAP + 1),
      },
    });
    window.fetch = (async () => response) as unknown as typeof window.fetch;
    const restore = patchFetch({
      enqueue: (record: Record<string, unknown>) => captured.push(record),
    } as never);

    await window.fetch("/large");

    expect(captured[0]?.responseBody).toBeUndefined();
    expect(captured[0]?.bodyTruncated).toBe(true);
    expect(captured[0]?.bodySizeBytes).toBeGreaterThan(DEFAULT_BODY_CAP);
    restore();
  });
});

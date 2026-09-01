/// <reference lib="dom" />
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
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
});

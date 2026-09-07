import { describe, expect, test } from "bun:test";
import type { RequestRecord } from "@vite-http-tracker/shared";
import { toCurl } from "./curl.js";

function rec(overrides: Partial<RequestRecord>): RequestRecord {
  return {
    requestId: "r1",
    seq: 1,
    method: "GET",
    url: "http://api.test/data",
    status: 200,
    startTime: 0,
    endTime: 1,
    duration: 1,
    ...overrides,
  };
}

describe("toCurl", () => {
  test("simple GET omits the -X flag", () => {
    const c = toCurl(rec({}));
    expect(c).toBe("curl \\\n  'http://api.test/data'");
  });

  test("non-GET method is included", () => {
    const c = toCurl(rec({ method: "POST", url: "http://api.test/data" }));
    expect(c).toContain("-X POST");
  });

  test("emits headers with -H", () => {
    const c = toCurl(
      rec({ requestHeaders: { authorization: "Bearer abc", accept: "application/json" } }),
    );
    expect(c).toContain("-H 'authorization: Bearer abc'");
    expect(c).toContain("-H 'accept: application/json'");
  });

  test("emits body with --data-raw", () => {
    const c = toCurl(rec({ method: "POST", requestBody: '{"name":"x"}' }));
    expect(c).toContain('--data-raw \'{"name":"x"}\'');
  });

  test("escapes single quotes in headers and url", () => {
    const c = toCurl(rec({ url: "http://api.test/it's" }));
    expect(c).toContain(`'http://api.test/it'\\''s'`);
  });
});

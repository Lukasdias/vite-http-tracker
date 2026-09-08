import { describe, expect, test } from "bun:test";
import type { RequestRecord } from "@vite-http-tracker/shared";
import { buildAiContext } from "./context.js";
import type { RecordGroup } from "./graph.js";

function record(overrides: Partial<RequestRecord> = {}): RequestRecord {
  return {
    requestId: "request-1",
    seq: 1,
    method: "GET",
    url: "https://api.example.com/users/1",
    status: 200,
    startTime: 1,
    endTime: 10,
    duration: 9,
    ...overrides,
  };
}

describe("buildAiContext", () => {
  test("includes diagnosis data, nearby requests and curl", () => {
    const selected = record({
      requestHeaders: { authorization: "Bearer secret", accept: "application/json" },
      responseBody: '{"ok":false}',
      status: 0,
      error: "Failed to fetch",
      transport: "fetch",
      timedOut: false,
    });
    const before = record({ requestId: "before", seq: 0, url: "https://api.example.com/session" });
    const after = record({ requestId: "after", seq: 2, url: "https://api.example.com/retry" });
    const group: RecordGroup = {
      key: "GET|url",
      canonical: selected,
      members: [selected],
      strictMode: false,
    };

    const context = buildAiContext(selected, group, [before, selected, after]);

    expect(context).toContain("# HTTP Tracker context");
    expect(context).toContain("status=error");
    expect(context).toContain("https://api.example.com/session");
    expect(context).toContain("https://api.example.com/retry");
    expect(context).toContain("```sh");
    expect(context).toContain("authorization: [REDACTED]");
    expect(context).not.toContain("Bearer secret");
  });

  test("can include sensitive data only when explicitly requested", () => {
    const selected = record({ requestHeaders: { authorization: "Bearer secret" } });
    const context = buildAiContext(selected, null, [], false);
    expect(context).toContain("Bearer secret");
  });

  test("clips oversized bodies", () => {
    const context = buildAiContext(record({ responseBody: "x".repeat(5_000) }), null, []);
    expect(context).toContain("… [truncated]");
  });
});

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { startServer } from "./server.js";

let srv: Awaited<ReturnType<typeof startServer>>;
let wsUrl = "";
let eventsUrl = "";

beforeAll(async () => {
  srv = await startServer({ port: 0, token: "dev" });
  wsUrl = `ws://127.0.0.1:${srv.port}/ws?token=dev`;
  eventsUrl = `ws://127.0.0.1:${srv.port}/events?token=dev`;
});
afterAll(async () => {
  if (srv) await srv.close();
});

function nextType(ws: WebSocket, type: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    ws.onmessage = (ev) => {
      const m = JSON.parse(String(ev.data)) as Record<string, unknown>;
      if (m.type === type) resolve(m);
    };
  });
}

describe("agent WS ingestion", () => {
  test("a record sent on /events?token=dev reaches the dashboard", async () => {
    const dash = new WebSocket(wsUrl);
    const seen = nextType(dash, "records");
    const agent = new WebSocket(eventsUrl);
    await new Promise<void>((r) => {
      agent.onopen = () => r();
    });
    agent.send(
      JSON.stringify({
        type: "records",
        token: "dev",
        records: [
          {
            requestId: "a",
            seq: 5,
            method: "POST",
            url: "/x",
            status: 200,
            startTime: 1,
            endTime: 1,
            duration: 0,
          },
        ],
      }),
    );
    const msg = await seen;
    expect((msg.records as Array<{ url: string }>)[0]?.url).toBe("/x");
    dash.close();
    agent.close();
  });
});

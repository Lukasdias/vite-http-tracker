import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { startServer } from "./server.js";

let srv: Awaited<ReturnType<typeof startServer>>;
let base = "";
let wsUrl = "";

beforeAll(async () => {
  srv = await startServer({ port: 0, token: "dev" });
  base = `http://127.0.0.1:${srv.port}`;
  wsUrl = `ws://127.0.0.1:${srv.port}/ws?token=dev`;
});
afterAll(async () => { if (srv) await srv.close(); });

function connect(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error("ws error"));
  });
}

function nextMessage(ws: WebSocket, type: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    ws.onmessage = (ev) => {
      const m = JSON.parse(String(ev.data)) as Record<string, unknown>;
      if (m.type === type) resolve(m);
    };
  });
}

describe("e2e", () => {
  test("dashboard receives a snapshot on connect", async () => {
    const ws = await connect();
    const m = await nextMessage(ws, "snapshot");
    expect(m.type).toBe("snapshot");
    ws.close();
  });
  test("dashboard receives a record posted over HTTP", async () => {
    const ws = await connect();
    const seen = nextMessage(ws, "records");
    await fetch(base + "/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "dev", records: [{ requestId: "x", seq: 100, method: "GET", url: "/e2e", status: 200, startTime: 1, endTime: 1, duration: 0 }] }),
    });
    const m = await seen;
    expect((m.records as Array<{ url: string }>)[0]?.url).toBe("/e2e");
    ws.close();
  });
});

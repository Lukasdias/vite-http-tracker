import { afterAll, describe, expect, test } from "bun:test";
import { startServer } from "./server.js";

let srv: Awaited<ReturnType<typeof startServer>>;
let base = "";

describe("server", () => {
  test("starts and serves index", async () => {
    srv = await startServer({ port: 0, token: "dev" });
    base = `http://127.0.0.1:${srv.port}`;
    const res = await fetch(base + "/");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("http-tracker");
  });
  test("ingests records via POST /events", async () => {
    const body = { token: "dev", records: [{ requestId: "1", seq: 1, method: "GET", url: "/x", status: 200, startTime: 1, endTime: 1, duration: 0 }] };
    const res = await fetch(base + "/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    expect(res.status).toBe(200);
  });
  test("rejects ingestion without token", async () => {
    const body = { records: [{ requestId: "1", seq: 1, method: "GET", url: "/x", status: 200, startTime: 1, endTime: 1, duration: 0 }] };
    const res = await fetch(base + "/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    expect(res.status).toBe(401);
  });
  afterAll(async () => { if (srv) await srv.close(); });
});

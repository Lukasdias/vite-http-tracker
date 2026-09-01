import { Hono } from "hono";
import type { ServerWebSocket } from "bun";
import { DEFAULT_SERVER_PORT, DEFAULT_TOKEN, type RequestRecord } from "@http-tracker/shared";
import { RequestStore } from "./store.js";

export interface ServerOptions { port?: number; host?: string; token?: string; store?: RequestStore }

export function startServer(opts: ServerOptions = {}): Promise<{ port: number; close: () => Promise<void> }> {
  const host = "127.0.0.1";
  const token = opts.token ?? DEFAULT_TOKEN;
  const store = opts.store ?? new RequestStore();
  const dashboards = new Set<ServerWebSocket>();
  const app = new Hono();

  app.post("/events", async (c) => {
    const j = (await c.req.json()) as { token?: string; records?: RequestRecord[] };
    if (j.token !== token) return c.json({ error: "unauthorized" }, 401);
    for (const r of j.records ?? []) store.add(r);
    broadcast({ type: "records", records: j.records ?? [] });
    return c.json({ ok: true });
  });

  app.get("/", async () => {
    const file = Bun.file(new URL("../public/index.html", import.meta.url).pathname);
    return new Response(await file.text(), { headers: { "content-type": "text/html" } });
  });

  app.get("/app.js", async () => {
    const file = Bun.file(new URL("../public/app.js", import.meta.url).pathname);
    return new Response(await file.text(), { headers: { "content-type": "application/javascript" } });
  });

  function broadcast(payload: { type: string; records?: RequestRecord[] }): void {
    const data = JSON.stringify(payload);
    for (const d of dashboards) { try { d.send(data); } catch {} }
  }

  const isWs = (req: Request): boolean => (req.headers.get("upgrade") ?? "").toLowerCase() === "websocket";

  const server = Bun.serve({
    port: opts.port ?? DEFAULT_SERVER_PORT,
    hostname: host,
    fetch(req, srv) {
      const url = new URL(req.url);
      if (isWs(req)) {
        if (url.pathname !== "/events" && url.pathname !== "/ws") return new Response("not found", { status: 404 });
        if (url.searchParams.get("token") !== token) return new Response("unauthorized", { status: 401 });
        if (srv.upgrade(req)) return new Response(undefined, { status: 101 });
        return new Response("upgrade failed", { status: 400 });
      }
      return app.fetch(req);
    },
    websocket: {
      open(ws) {
        ws.send(JSON.stringify({ type: "snapshot", records: store.snapshot() }));
        dashboards.add(ws);
      },
      message(ws, message) {
        const msg = JSON.parse(String(message)) as { type?: string; token?: string; records?: RequestRecord[] };
        if (msg.type === "records") {
          if (msg.token !== token) return;
          for (const r of msg.records ?? []) store.add(r);
          ws.send(JSON.stringify({ type: "acked", count: msg.records?.length ?? 0 }));
          broadcast({ type: "records", records: msg.records ?? [] });
        } else if (msg.type === "clear") {
          if (msg.token !== token) return;
          store.clear();
          broadcast({ type: "clear" });
        }
      },
      close(ws) {
        dashboards.delete(ws);
      },
    },
  });

  return Promise.resolve({
    port: server.port as number,
    close: () => new Promise<void>((resolve) => { server.stop(true); resolve(); }),
  });
}

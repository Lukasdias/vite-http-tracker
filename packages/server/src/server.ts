import { join, extname } from "node:path";
import { Hono } from "hono";
import type { ServerWebSocket } from "bun";
import { DEFAULT_SERVER_PORT, DEFAULT_TOKEN, type RequestRecord } from "@vite-http-tracker/shared";
import { RequestStore } from "./store.js";

export interface ServerOptions {
  port?: number;
  host?: string;
  token?: string;
  store?: RequestStore;
}

export function startServer(
  opts: ServerOptions = {},
): Promise<{ port: number; close: () => Promise<void> }> {
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

  function broadcast(payload: { type: string; records?: RequestRecord[] }): void {
    const data = JSON.stringify(payload);
    for (const d of dashboards) {
      try {
        d.send(data);
      } catch {}
    }
  }

  const isWs = (req: Request): boolean =>
    (req.headers.get("upgrade") ?? "").toLowerCase() === "websocket";
  const UI_DIST = join(import.meta.dir, "../../ui/dist");
  const PUBLIC_DIR = join(import.meta.dir, "../public");
  const MIME: Record<string, string> = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".svg": "image/svg+xml",
    ".png": "image/png",
  };

  async function serveStatic(pathname: string): Promise<Response> {
    const clean = pathname.replace(/^\/+/, "");
    const distFile = clean ? join(UI_DIST, clean) : join(UI_DIST, "index.html");
    const publicFile = clean ? join(PUBLIC_DIR, clean) : join(PUBLIC_DIR, "index.html");
    for (const candidate of [distFile, publicFile]) {
      const f = Bun.file(candidate);
      if (await f.exists()) {
        const type = MIME[extname(candidate)] ?? "application/octet-stream";
        return new Response(f, { headers: { "content-type": type } });
      }
    }
    const spa = Bun.file(join(UI_DIST, "index.html"));
    if (await spa.exists()) {
      return new Response(spa, { headers: { "content-type": "text/html" } });
    }
    return new Response("Not found", { status: 404 });
  }

  const server = Bun.serve({
    port: opts.port ?? DEFAULT_SERVER_PORT,
    hostname: host,
    async fetch(req, srv) {
      const url = new URL(req.url);
      if (isWs(req)) {
        if (url.pathname !== "/events" && url.pathname !== "/ws")
          return new Response("not found", { status: 404 });
        if (url.searchParams.get("token") !== token)
          return new Response("unauthorized", { status: 401 });
        if (srv.upgrade(req)) return new Response(undefined, { status: 101 });
        return new Response("upgrade failed", { status: 400 });
      }
      if (req.method === "POST" && url.pathname === "/events") return app.fetch(req);
      return serveStatic(url.pathname);
    },
    websocket: {
      open(ws) {
        ws.send(JSON.stringify({ type: "snapshot", records: store.snapshot() }));
        dashboards.add(ws);
      },
      message(ws, message) {
        const msg = JSON.parse(String(message)) as {
          type?: string;
          token?: string;
          records?: RequestRecord[];
        };
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
    close: () =>
      new Promise<void>((resolve) => {
        server.stop(true);
        resolve();
      }),
  });
}

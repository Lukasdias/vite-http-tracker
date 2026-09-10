import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import { DEFAULT_SERVER_PORT, DEFAULT_TOKEN, type RequestRecord } from "@vite-http-tracker/shared";
import { parseRecordsMessage, parseRecordsPayload } from "./protocol.js";
import { RequestStore } from "./store.js";

export interface ServerOptions {
  port?: number;
  host?: string;
  token?: string;
  store?: RequestStore;
}

export function uiDistCandidates(moduleDir: string): string[] {
  return [join(moduleDir, "../../../ui/dist"), join(moduleDir, "../../ui/dist")];
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".woff2": "font/font-woff2",
  ".woff": "font/font-woff",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function requestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export async function startServer(
  opts: ServerOptions = {},
): Promise<{ port: number; close: () => Promise<void> }> {
  const host = "127.0.0.1";
  const token = opts.token ?? DEFAULT_TOKEN;
  const store = opts.store ?? new RequestStore();
  const dashboards = new Set<WebSocket>();
  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${host}`);
    if (req.method === "POST" && url.pathname === "/events") {
      let body: unknown;
      try {
        body = JSON.parse(await requestBody(req));
      } catch {
        respondJson(res, 400, { error: "invalid_json" });
        return;
      }
      if (!body || typeof body !== "object" || (body as Record<string, unknown>).token !== token) {
        respondJson(res, 401, { error: "unauthorized" });
        return;
      }
      const payload = parseRecordsPayload(body);
      if (!payload) {
        respondJson(res, 400, { error: "invalid_payload" });
        return;
      }
      const records = payload.records.filter((record) => store.add(record));
      if (records.length > 0) broadcast({ type: "records", records });
      respondJson(res, 200, { ok: true });
      return;
    }
    await serveStatic(url.pathname, res);
  });
  const websocketServer = new WebSocketServer({ noServer: true });

  function broadcast(payload: { type: string; records?: RequestRecord[] }): void {
    const data = JSON.stringify(payload);
    for (const dashboard of dashboards) {
      if (dashboard.readyState === dashboard.OPEN) dashboard.send(data);
    }
  }

  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", `http://${host}`);
    const validPath = url.pathname === "/events" || url.pathname === "/ws";
    if (!validPath || url.searchParams.get("token") !== token) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    websocketServer.handleUpgrade(req, socket, head, (ws) => {
      websocketServer.emit("connection", ws, req);
    });
  });

  websocketServer.on("connection", (ws) => {
    dashboards.add(ws);
    ws.send(JSON.stringify({ type: "snapshot", records: store.snapshot() }));
    ws.on("message", (message) => {
      let raw: unknown;
      try {
        raw = JSON.parse(message.toString());
      } catch {
        ws.send(JSON.stringify({ type: "error", error: "invalid_json" }));
        return;
      }
      if (!raw || typeof raw !== "object" || (raw as Record<string, unknown>).token !== token)
        return;
      const msg = parseRecordsMessage(raw);
      if (msg) {
        const records = msg.records.filter((record) => store.add(record));
        ws.send(JSON.stringify({ type: "acked", count: msg.records.length }));
        if (records.length > 0) broadcast({ type: "records", records });
      } else if ((raw as Record<string, unknown>).type === "clear") {
        store.clear();
        broadcast({ type: "clear" });
      } else {
        ws.send(JSON.stringify({ type: "error", error: "invalid_payload" }));
      }
    });
    ws.on("close", () => dashboards.delete(ws));
  });

  async function serveStatic(pathname: string, res: ServerResponse): Promise<void> {
    const clean = pathname.replace(/^\/+/, "");
    const paths = uiDistCandidates(import.meta.dirname).flatMap((directory) => [
      join(directory, clean || "index.html"),
      join(directory, "index.html"),
    ]);
    paths.push(join(import.meta.dirname, "../public", clean || "index.html"));
    for (const path of paths) {
      try {
        const data = await readFile(path);
        res.writeHead(200, { "content-type": MIME[extname(path)] ?? "application/octet-stream" });
        res.end(data);
        return;
      } catch {}
    }
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(opts.port ?? DEFAULT_SERVER_PORT, host, () => {
      httpServer.off("error", reject);
      resolve();
    });
  });

  return {
    port: (httpServer.address() as import("node:net").AddressInfo).port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        for (const dashboard of dashboards) dashboard.close();
        websocketServer.close();
        httpServer.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

function respondJson(res: ServerResponse, status: number, body: object): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

import { DEFAULT_SERVER_URL, DEFAULT_TOKEN } from "@vite-http-tracker/shared";
import { patchFetch } from "./patch-fetch.js";
import { patchXhr } from "./patch-xhr.js";
import { WsTransport } from "./transport.js";

export interface AgentOptions {
  serverUrl?: string;
  token?: string;
  strictMode?: boolean;
}

export function initAgent(opts: AgentOptions = {}): (() => void)[] {
  const token = opts.token ?? DEFAULT_TOKEN;
  let base: string;
  if (opts.serverUrl) {
    base = opts.serverUrl.replace(/^http/, "ws").replace(/\/$/, "");
  } else if (typeof window !== "undefined" && window.location && window.location.hostname) {
    base = `ws://${window.location.hostname}:4000`;
  } else {
    base = DEFAULT_SERVER_URL.replace(/^http/, "ws").replace(/\/$/, "");
  }
  const wsUrl = `${base}/events?token=${encodeURIComponent(token)}`;
  const transport = new WsTransport({ url: wsUrl, token });
  transport.connect();
  const strictMode = opts.strictMode ?? false;
  const restoreFetch = patchFetch({ enqueue: (r) => transport.enqueue(r) }, strictMode);
  const restoreXhr = patchXhr({ enqueue: (r) => transport.enqueue(r) }, strictMode);
  return [restoreFetch, restoreXhr];
}

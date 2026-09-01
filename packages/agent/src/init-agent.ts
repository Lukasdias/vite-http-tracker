import { DEFAULT_SERVER_URL, DEFAULT_TOKEN } from "@http-tracker/shared";
import { patchFetch } from "./patch-fetch.js";
import { patchXhr } from "./patch-xhr.js";
import { WsTransport } from "./transport.js";

export interface AgentOptions {
  serverUrl?: string;
  token?: string;
  strictMode?: boolean;
}

export function initAgent(opts: AgentOptions = {}): (() => void)[] {
  const wsUrl =
    (opts.serverUrl ?? DEFAULT_SERVER_URL).replace(/^http/, "ws").replace(/\/$/, "") + "/events";
  const transport = new WsTransport({ url: wsUrl, token: opts.token ?? DEFAULT_TOKEN });
  transport.connect();
  const restoreFetch = patchFetch({ enqueue: (r) => transport.enqueue(r) });
  const restoreXhr = patchXhr({ enqueue: (r) => transport.enqueue(r) });
  return [restoreFetch, restoreXhr];
}

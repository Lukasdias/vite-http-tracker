import { DEFAULT_SERVER_URL, DEFAULT_TOKEN } from "@vite-http-tracker/shared";
import { patchFetch } from "./patch-fetch.js";
import { patchXhr } from "./patch-xhr.js";
import { patchEventSource, patchWebSocket } from "./patch-streams.js";
import { WsTransport } from "./transport.js";
import { mountIndicator } from "./indicator.js";

export interface AgentOptions {
  serverUrl?: string;
  token?: string;
  strictMode?: boolean;
  indicator?: { logoUrl: string };
  captureStreamMessages?: boolean;
  maxStreamEventsPerConnection?: number;
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
  const dashboardUrl = `${base.replace(/^ws/, "http")}/?${new URLSearchParams({ token }).toString()}`;
  let indicator = opts.indicator
    ? mountIndicator({ logoUrl: opts.indicator.logoUrl, dashboardUrl })
    : undefined;
  const transport = new WsTransport({
    url: wsUrl,
    token,
    onConnectionChange: (state) => indicator?.setState(state),
  });
  transport.connect();
  const strictMode = opts.strictMode ?? false;
  const restoreFetch = patchFetch({ enqueue: (r) => transport.enqueue(r) }, strictMode);
  const restoreXhr = patchXhr({ enqueue: (r) => transport.enqueue(r) }, strictMode);
  const streamOptions = {
    captureMessages: opts.captureStreamMessages ?? false,
    maxMessages: opts.maxStreamEventsPerConnection,
  };
  const restoreEventSource = patchEventSource(
    { enqueue: (r) => transport.enqueue(r) },
    strictMode,
    streamOptions,
  );
  const restoreWebSocket = patchWebSocket(
    { enqueue: (r) => transport.enqueue(r) },
    strictMode,
    streamOptions,
  );
  return [
    restoreFetch,
    restoreXhr,
    restoreEventSource,
    restoreWebSocket,
    () => {
      transport.close();
      indicator?.remove();
      indicator = undefined;
    },
  ];
}

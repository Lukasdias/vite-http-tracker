import type { RequestRecord } from "@vite-http-tracker/shared";
import { batchFor, newId, nextSeq } from "./capture.js";
import { redactString } from "./redact.js";

interface StreamSink {
  enqueue(record: RequestRecord): void;
}

interface StreamOptions {
  captureMessages?: boolean;
  maxMessages?: number;
  ignoredUrl?: string;
}

const DEFAULT_MAX_MESSAGES = 100;

function streamRecord(
  url: string,
  method: string,
  transport: "sse" | "websocket",
  eventType: RequestRecord["eventType"],
  startTime: number,
  body: string | undefined,
  status: number,
  strictMode: boolean,
  poolId?: string,
): RequestRecord {
  const endTime = Date.now();
  return {
    requestId: newId(),
    seq: nextSeq(),
    method,
    url,
    status,
    startTime,
    endTime,
    duration: endTime - startTime,
    responseBody: body ? redactString(body) : undefined,
    bodySizeBytes: body?.length ?? 0,
    streaming: true,
    transport,
    eventType,
    strictMode,
    batchId: batchFor(startTime),
    poolId,
  };
}

export function patchEventSource(
  sink: StreamSink,
  strictMode = false,
  options: StreamOptions = {},
): () => void {
  const Original = window.EventSource;
  if (typeof Original !== "function") return () => {};
  const Patched = class extends Original {
    private readonly startedAt = Date.now();
    private readonly streamUrl: string;

    constructor(url: string | URL, eventSourceInitDict?: EventSourceInit) {
      super(url, eventSourceInitDict);
      this.streamUrl = typeof url === "string" ? url : url.toString();
      let messageCount = 0;
      this.addEventListener("open", () =>
        sink.enqueue(
          streamRecord(
            this.streamUrl,
            "SSE",
            "sse",
            "open",
            this.startedAt,
            undefined,
            200,
            strictMode,
          ),
        ),
      );
      if (options.captureMessages) {
        this.addEventListener("message", (event) => {
          if (messageCount >= (options.maxMessages ?? DEFAULT_MAX_MESSAGES)) return;
          messageCount++;
          sink.enqueue(
            streamRecord(
              this.streamUrl,
              "SSE",
              "sse",
              "message",
              this.startedAt,
              event.data,
              200,
              strictMode,
            ),
          );
        });
      }
      this.addEventListener("error", () =>
        sink.enqueue(
          streamRecord(
            this.streamUrl,
            "SSE",
            "sse",
            "error",
            this.startedAt,
            undefined,
            0,
            strictMode,
          ),
        ),
      );
    }
  };
  window.EventSource = Patched as typeof EventSource;
  return () => {
    window.EventSource = Original;
  };
}

export function patchWebSocket(
  sink: StreamSink,
  strictMode = false,
  options: StreamOptions = {},
): () => void {
  const Original = window.WebSocket;
  if (typeof Original !== "function") return () => {};
  const Patched = class extends Original {
    private readonly startedAt = Date.now();
    private readonly streamUrl: string;

    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols);
      this.streamUrl = typeof url === "string" ? url : url.toString();
      if (this.streamUrl === options.ignoredUrl) return;
      let messageCount = 0;
      this.addEventListener("open", () =>
        sink.enqueue(
          streamRecord(
            this.streamUrl,
            "WS",
            "websocket",
            "open",
            this.startedAt,
            undefined,
            101,
            strictMode,
          ),
        ),
      );
      if (options.captureMessages) {
        this.addEventListener("message", (event) => {
          if (messageCount >= (options.maxMessages ?? DEFAULT_MAX_MESSAGES)) return;
          messageCount++;
          sink.enqueue(
            streamRecord(
              this.streamUrl,
              "WS",
              "websocket",
              "message",
              this.startedAt,
              typeof event.data === "string" ? event.data : undefined,
              101,
              strictMode,
            ),
          );
        });
      }
      this.addEventListener("error", () =>
        sink.enqueue(
          streamRecord(
            this.streamUrl,
            "WS",
            "websocket",
            "error",
            this.startedAt,
            undefined,
            0,
            strictMode,
          ),
        ),
      );
      this.addEventListener("close", () =>
        sink.enqueue(
          streamRecord(
            this.streamUrl,
            "WS",
            "websocket",
            "close",
            this.startedAt,
            undefined,
            1000,
            strictMode,
          ),
        ),
      );
    }
  };
  window.WebSocket = Patched as typeof WebSocket;
  return () => {
    window.WebSocket = Original;
  };
}

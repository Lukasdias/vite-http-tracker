import { DEFAULT_BODY_CAP, type RequestRecord } from "@vite-http-tracker/shared";
import {
  batchFor,
  hashRequest,
  newId,
  nextSeq,
  parseRawHeaders,
  serializeBody,
} from "./capture.js";
import { redactHeaders, redactString } from "./redact.js";

interface XhrSink {
  enqueue(r: RequestRecord): void;
}

export function patchXhr(sink: XhrSink, strictMode = false): () => void {
  const Original = window.XMLHttpRequest;
  const Patched = class extends Original {
    private seq = nextSeq();
    private start = 0;
    private url = "";
    private method = "";
    private requestHeaders: Record<string, string> = {};
    private bodyResult = { body: undefined as string | undefined, truncated: false, size: 0 };
    open(method: string, url: string | URL): void {
      this.method = method.toUpperCase();
      this.url = typeof url === "string" ? url : url.toString();
      this.start = Date.now();
      super.open(method, url);
    }
    send(body?: Document | XMLHttpRequestBodyInit | null): void {
      const pending = serializeBody(body);
      this.bodyResult = pending;
      this.addEventListener("loadend", () => {
        const end = Date.now();
        const responseText = String(this.responseText ?? "");
        const responseSizeBytes = new TextEncoder().encode(responseText).byteLength;
        const responseBody = responseSizeBytes > DEFAULT_BODY_CAP ? undefined : responseText;
        const record: RequestRecord = {
          requestId: newId(),
          seq: this.seq,
          method: this.method,
          url: this.url,
          status: this.status,
          startTime: this.start,
          endTime: end,
          duration: end - this.start,
          requestHeaders: redactHeaders(this.requestHeaders),
          responseHeaders: redactHeaders(
            parseRawHeaders(this.getAllResponseHeaders()),
          ),
          requestBody: pending.body ? redactString(pending.body) : undefined,
          responseBody: responseBody === undefined ? undefined : redactString(responseBody),
          bodyTruncated: pending.truncated || responseSizeBytes > DEFAULT_BODY_CAP,
          bodySizeBytes: responseSizeBytes,
          requestHash: hashRequest(this.method, this.url, pending.body),
          strictMode,
          batchId: batchFor(this.start),
          transport: "xhr",
          poolId: this.requestHeaders["x-http-tracker-pool-id"],
        };
        sink.enqueue(record);
      });
      super.send(body);
    }
    setRequestHeader(name: string, value: string): void {
      this.requestHeaders[name.toLowerCase()] = value;
      super.setRequestHeader(name, value);
    }
  } as unknown as typeof XMLHttpRequest;

  window.XMLHttpRequest = Patched;
  return () => {
    window.XMLHttpRequest = Original;
  };
}

import { type RequestRecord } from "@http-tracker/shared";
import { hashRequest, newId, parseHeaders, serializeBody } from "./capture.js";
import { redactHeaders, redactString } from "./redact.js";

interface XhrSink {
  enqueue(r: RequestRecord): void;
}

export function patchXhr(sink: XhrSink, strictMode = false): () => void {
  const Original = window.XMLHttpRequest;
  let seqCounter = 0;
  const Patched = class extends Original {
    private seq = ++seqCounter;
    private start = 0;
    private url = "";
    private method = "";
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
        const record: RequestRecord = {
          requestId: newId(),
          seq: this.seq,
          method: this.method,
          url: this.url,
          status: this.status,
          startTime: this.start,
          endTime: end,
          duration: end - this.start,
          requestHeaders: {},
          responseHeaders: redactHeaders(
            parseHeaders(new Headers(this.getAllResponseHeaders() as unknown as HeadersInit)),
          ),
          requestBody: pending.body ? redactString(pending.body) : undefined,
          responseBody: redactString(String(this.responseText ?? "")),
          bodyTruncated: pending.truncated,
          bodySizeBytes: (this.responseText ?? "").length,
          requestHash: hashRequest(this.method, this.url, pending.body),
          strictMode,
        };
        sink.enqueue(record);
      });
      super.send(body);
    }
  } as unknown as typeof XMLHttpRequest;

  window.XMLHttpRequest = Patched;
  return () => {
    window.XMLHttpRequest = Original;
  };
}

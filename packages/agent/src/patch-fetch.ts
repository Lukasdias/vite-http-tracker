import { type RequestRecord, DEFAULT_BODY_CAP } from "@http-tracker/shared";
import { hashRequest, newId, parseHeaders, serializeBody } from "./capture.js";
import { redactHeaders, redactString } from "./redact.js";

let seqCounter = 0;

interface FetchSink { enqueue(r: RequestRecord): void }

export function patchFetch(sink: FetchSink): () => void {
  const original = window.fetch;
  const wrapped = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = (init?.method ?? "GET").toUpperCase();
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const startTime = Date.now();
    const bodyResult = serializeBody(init?.body);
    const requestHash = hashRequest(method, url, bodyResult.body);
    const seq = ++seqCounter;

    return original(input, init).then(async (res) => {
      const endTime = Date.now();
      const bodySize = res.headers.get("content-length");
      let responseBody: string | undefined;
      let truncated = false;
      let opaque = false;
      let streaming = false;
      try {
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("text/event-stream")) {
          streaming = true;
        } else if (bodySize && Number(bodySize) > DEFAULT_BODY_CAP) {
          truncated = true;
        } else if (res.body) {
          responseBody = String(await res.clone().text());
          if (responseBody.length > DEFAULT_BODY_CAP) { responseBody = undefined; truncated = true; }
        }
      } catch {
        opaque = true;
      }
      const record: RequestRecord = {
        requestId: newId(),
        seq,
        method,
        url,
        status: res.status,
        startTime,
        endTime,
        duration: endTime - startTime,
        requestHeaders: redactHeaders(parseHeaders(new Headers(init?.headers ?? {}))),
        responseHeaders: redactHeaders(parseHeaders(res.headers)),
        requestBody: bodyResult.body ? redactString(bodyResult.body) : undefined,
        responseBody: responseBody ? redactString(responseBody) : undefined,
        bodyTruncated: truncated || bodyResult.truncated,
        opaque,
        streaming,
        bodySizeBytes: responseBody ? responseBody.length : Number(bodySize ?? 0) || 0,
        requestHash,
      };
      sink.enqueue(record);
      return res;
    });
  };
  window.fetch = wrapped as typeof window.fetch;
  return () => { window.fetch = original; };
}

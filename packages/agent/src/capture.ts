import { DEFAULT_BODY_CAP, BATCH_WINDOW_MS } from "@vite-http-tracker/shared";

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

let lastBatchStart = 0;
let currentBatchId = "";
let seqCounter = 0;

export function nextSeq(): number {
  return ++seqCounter;
}

export function batchFor(startTime: number, windowMs = BATCH_WINDOW_MS): string {
  if (startTime >= lastBatchStart && startTime - lastBatchStart <= windowMs) {
    return currentBatchId;
  }
  lastBatchStart = startTime;
  currentBatchId = newId();
  return currentBatchId;
}

export interface BodyResult {
  body: string | undefined;
  truncated: boolean;
  size: number;
}

export async function readStreamBody(
  stream: ReadableStream<Uint8Array>,
  cap = DEFAULT_BODY_CAP,
): Promise<BodyResult> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      const chunk = next.value;
      size += chunk.byteLength;
      if (size > cap) {
        await reader.cancel();
        return { body: undefined, truncated: true, size };
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body: new TextDecoder().decode(bytes), truncated: false, size };
}

export function serializeBody(input: unknown, cap = DEFAULT_BODY_CAP): BodyResult {
  if (input == null) return { body: undefined, truncated: false, size: 0 };
  if (
    input instanceof FormData ||
    input instanceof ReadableStream ||
    input instanceof Blob ||
    input instanceof ArrayBuffer ||
    ArrayBuffer.isView(input)
  ) {
    const size = input instanceof Blob ? input.size : 0;
    return { body: undefined, truncated: false, size };
  }
  let text: string;
  if (typeof input === "string") {
    text = input;
  } else if (input instanceof URLSearchParams) {
    text = input.toString();
  } else if (typeof input === "object") {
    text = JSON.stringify(input);
  } else {
    return { body: undefined, truncated: false, size: 0 };
  }
  const size = new TextEncoder().encode(text).byteLength;
  if (size > cap) return { body: undefined, truncated: true, size };
  return { body: text, truncated: false, size };
}

export function hashRequest(method: string, url: string, body?: string): string {
  const input = `${method}\n${url}\n${body ?? ""}`;
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function parseHeaders(headers: Headers | Record<string, string>): Record<string, string> {
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }
  return { ...headers };
}

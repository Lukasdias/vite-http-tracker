import type { RequestRecord } from "@vite-http-tracker/shared";

export interface RecordsPayload {
  token: string;
  records: RequestRecord[];
}

export interface RecordsMessage extends RecordsPayload {
  type: "records";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === "boolean";
}

function isOptionalStringRecord(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isObject(value)) return false;
  return Object.values(value).every((item) => typeof item === "string");
}

function isOptionalEnum<T extends string>(value: unknown, values: readonly T[]): boolean {
  return value === undefined || (typeof value === "string" && values.includes(value as T));
}

export function isRequestRecord(value: unknown): value is RequestRecord {
  if (!isObject(value)) return false;
  if (typeof value.requestId !== "string" || value.requestId.length === 0) return false;
  const seq = value.seq;
  const duration = value.duration;
  const bodySizeBytes = value.bodySizeBytes;
  if (typeof seq !== "number" || !Number.isSafeInteger(seq) || seq < 0) return false;
  if (typeof value.method !== "string" || typeof value.url !== "string") return false;
  if (!Number.isFinite(value.status)) return false;
  if (!Number.isFinite(value.startTime) || !Number.isFinite(value.endTime)) return false;
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration < 0) return false;
  if (!isOptionalEnum(value.transport, ["fetch", "xhr", "sse", "websocket"] as const)) return false;
  if (!isOptionalString(value.error)) return false;
  if (!isOptionalBoolean(value.timedOut)) return false;
  if (!isOptionalEnum(value.eventType, ["open", "message", "error", "close"] as const))
    return false;
  if (!isOptionalString(value.poolId)) return false;
  if (!isOptionalString(value.initiator)) return false;
  if (!isOptionalStringRecord(value.requestHeaders)) return false;
  if (!isOptionalStringRecord(value.responseHeaders)) return false;
  if (!isOptionalString(value.requestBody) || !isOptionalString(value.responseBody)) return false;
  if (!isOptionalBoolean(value.bodyTruncated)) return false;
  if (!isOptionalBoolean(value.opaque) || !isOptionalBoolean(value.streaming)) return false;
  if (
    bodySizeBytes !== undefined &&
    (typeof bodySizeBytes !== "number" || !Number.isFinite(bodySizeBytes) || bodySizeBytes < 0)
  )
    return false;
  if (!isOptionalString(value.requestHash)) return false;
  if (!isOptionalBoolean(value.strictMode)) return false;
  if (!isOptionalString(value.batchId)) return false;
  return true;
}

export function parseRecordsPayload(value: unknown): RecordsPayload | null {
  if (!isObject(value) || typeof value.token !== "string" || !Array.isArray(value.records))
    return null;
  if (!value.records.every(isRequestRecord)) return null;
  return { token: value.token, records: value.records };
}

export function parseRecordsMessage(value: unknown): RecordsMessage | null {
  if (!isObject(value) || value.type !== "records") return null;
  const payload = parseRecordsPayload(value);
  return payload ? { ...payload, type: "records" } : null;
}

import type { RequestRecord } from "@vite-http-tracker/shared";
import { toCurl } from "./curl.js";
import type { RecordGroup } from "./graph.js";

const MAX_CONTEXT_LENGTH = 30_000;
const MAX_BODY_LENGTH = 4_000;
const CONTEXT_NEIGHBORS = 2;
const MARKDOWN_FENCE = "```";
const SENSITIVE_FIELD =
  /authorization|cookie|set-cookie|api[-_]?key|auth[-_]?token|token|password|secret/i;

function redactHeaders(
  headers: Record<string, string> | undefined,
  redactSensitive: boolean,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers ?? {}).map(([key, value]) => [
      key,
      redactSensitive && SENSITIVE_FIELD.test(key) ? "[REDACTED]" : value,
    ]),
  );
}

function redactText(value: string | undefined, redactSensitive: boolean): string | undefined {
  if (!value) return value;
  if (!redactSensitive) return value;
  return value.replace(
    /("?)(authorization|cookie|set-cookie|api[-_]?key|auth[-_]?token|token|password|secret)("?\s*:\s*")([^"\n]*)/gi,
    "$1$2$3[REDACTED]",
  );
}

function bodyBlock(label: string, body: string | undefined, redactSensitive: boolean): string {
  if (!body) return "";
  const clipped =
    body.length > MAX_BODY_LENGTH ? `${body.slice(0, MAX_BODY_LENGTH)}\n… [truncated]` : body;
  return `\n${label}:\n${MARKDOWN_FENCE}\n${redactText(clipped, redactSensitive)}\n${MARKDOWN_FENCE}\n`;
}

function statusOf(record: RequestRecord): string {
  if (record.timedOut) return "timeout";
  if (record.status === 0) return "error";
  return String(record.status);
}

function summary(record: RequestRecord): string {
  const details = [
    `status=${statusOf(record)}`,
    `duration=${record.duration}ms`,
    record.transport ? `transport=${record.transport}` : "",
    record.poolId ? `pool=${record.poolId}` : "",
    record.batchId ? `batch=${record.batchId}` : "",
    record.eventType ? `event=${record.eventType}` : "",
  ].filter(Boolean);
  return `- #${record.seq} ${record.method} ${record.url} (${details.join(", ")})`;
}

function recordDetails(record: RequestRecord, redactSensitive: boolean): string {
  const headers = Object.entries(redactHeaders(record.requestHeaders, redactSensitive));
  const headerBlock = headers.length
    ? `\nRequest headers:\n${headers.map(([key, value]) => `- ${key}: ${value}`).join("\n")}`
    : "";
  const flags = [
    record.bodyTruncated ? "body truncated" : "",
    record.opaque ? "opaque body" : "",
    record.streaming ? "streaming" : "",
    record.error ? `error: ${record.error}` : "",
  ].filter(Boolean);
  return `${headerBlock}${flags.length ? `\nFlags: ${flags.join(", ")}` : ""}${bodyBlock("Request body", record.requestBody, redactSensitive)}${bodyBlock("Response body", record.responseBody, redactSensitive)}`;
}

function safeCurl(record: RequestRecord, redactSensitive: boolean): string {
  return toCurl({
    ...record,
    requestHeaders: redactHeaders(record.requestHeaders, redactSensitive),
    requestBody: redactText(record.requestBody, redactSensitive),
  });
}

export function buildAiContext(
  record: RequestRecord,
  group: RecordGroup | null,
  records: RequestRecord[],
  redactSensitive = true,
): string {
  const sorted = [...records].sort((a, b) => a.seq - b.seq);
  const index = sorted.findIndex((item) => item.requestId === record.requestId);
  const start = Math.max(0, index - CONTEXT_NEIGHBORS);
  const end = index < 0 ? sorted.length : Math.min(sorted.length, index + CONTEXT_NEIGHBORS + 1);
  const nearby = sorted.slice(start, end).filter((item) => item.requestId !== record.requestId);
  const members = group?.members ?? [record];
  const context = [
    "# HTTP Tracker context",
    "",
    "## Selected request",
    summary(record),
    recordDetails(record, redactSensitive),
    "",
    "## Group",
    group && members.length > 1
      ? `${members.length} duplicate requests in this group.`
      : "No duplicate group.",
    members.length > 1 ? members.map(summary).join("\n") : "",
    "",
    "## Nearby timeline",
    nearby.length ? nearby.map(summary).join("\n") : "No nearby requests.",
    "",
    "## cURL",
    `${MARKDOWN_FENCE}sh`,
    safeCurl(record, redactSensitive),
    MARKDOWN_FENCE,
  ].join("\n");
  return context.length > MAX_CONTEXT_LENGTH
    ? `${context.slice(0, MAX_CONTEXT_LENGTH)}\n\n[Context clipped at ${MAX_CONTEXT_LENGTH} characters]`
    : context;
}

export async function copyText(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}

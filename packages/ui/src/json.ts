export type JsonKind = "object" | "array" | "string" | "number" | "boolean" | "null";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ParseResult = { ok: true; value: JsonValue } | { ok: false; reason: string };

export interface ParseParam {
  key: string;
  value: string;
}

export function parseJson(raw: string): ParseResult {
  const t = raw.trim();
  if (!t) return { ok: false, reason: "empty" };
  try {
    return { ok: true, value: JSON.parse(t) as JsonValue };
  } catch {
    return { ok: false, reason: "not JSON" };
  }
}

export function kindOf(value: unknown): JsonKind {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "object";
}

// A string value that itself holds JSON (starts with { or [ and parses).
// Lets us unwrap stringified objects nested inside a body.
export function jsonString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  if (!(t.startsWith("{") || t.startsWith("["))) return undefined;
  try {
    JSON.parse(t);
    return t;
  } catch {
    return undefined;
  }
}

export function countNodes(value: unknown, max: number): number {
  let count = 0;
  const stack: unknown[] = [value];
  while (stack.length) {
    const v = stack.pop();
    count++;
    if (count > max) return count;
    if (v === null || typeof v !== "object") continue;
    if (Array.isArray(v)) {
      for (const child of v) stack.push(child);
    } else {
      for (const key of Object.keys(v as Record<string, unknown>)) {
        stack.push((v as Record<string, unknown>)[key]);
      }
    }
  }
  return count;
}

// "a=1&b=two&c" -> [{a,1},{b,two},{c,""}]
export function parseParams(raw: string): ParseParam[] | undefined {
  const t = raw.trim();
  if (!t || !t.includes("=")) return undefined;
  const parts = t.split("&");
  if (parts.length < 1) return undefined;
  const params: ParseParam[] = [];
  for (const part of parts) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq === -1) {
      params.push({ key: decode(part), value: "" });
    } else {
      params.push({ key: decode(part.slice(0, eq)), value: decode(part.slice(eq + 1)) });
    }
  }
  return params.length ? params : undefined;
}

// URL query string -> key/value list, or undefined if none
export function queryParams(url: string): ParseParam[] | undefined {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return undefined;
  }
  const out: ParseParam[] = [];
  u.searchParams.forEach((value, key) => out.push({ key, value }));
  return out.length ? out : undefined;
}

function decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

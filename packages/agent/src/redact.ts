import { REDACTED_VALUE, SENSITIVE_FIELDS } from "@http-tracker/shared";

const fieldSet = new Set<string>(SENSITIVE_FIELDS);

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = fieldSet.has(k.toLowerCase()) ? REDACTED_VALUE : v;
  }
  return out;
}

export function redactString(input: string): string {
  let out = input;
  for (const field of SENSITIVE_FIELDS) {
    const re = new RegExp(`("${field}":\\s*")[^"]*(")`, "gi");
    out = out.replace(re, `$1${REDACTED_VALUE}$2`);
  }
  return out;
}

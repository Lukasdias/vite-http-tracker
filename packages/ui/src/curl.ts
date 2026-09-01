import type { RequestRecord } from "@http-tracker/shared";

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

export function toCurl(record: RequestRecord): string {
  const tokens: string[] = ["curl"];
  const method = record.method.toUpperCase();
  if (method !== "GET") tokens.push(`-X ${method}`);
  for (const [key, value] of Object.entries(record.requestHeaders ?? {})) {
    tokens.push(`-H ${shellQuote(`${key}: ${value}`)}`);
  }
  const body = record.requestBody?.trim();
  if (body) tokens.push(`--data-raw ${shellQuote(record.requestBody as string)}`);
  tokens.push(shellQuote(record.url));
  return tokens.join(" \\\n  ");
}

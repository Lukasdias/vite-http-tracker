import { describe, expect, test } from "bun:test";
import { redactHeaders, redactString } from "./redact.js";

describe("redactHeaders", () => {
  test("redacts sensitive keys case-insensitively", () => {
    const out = redactHeaders({ authorization: "Bearer x", "X-Api-Key": "k", Accept: "json" });
    expect(out.authorization).toBe("[REDACTED]");
    expect(out["X-Api-Key"]).toBe("[REDACTED]");
    expect(out.Accept).toBe("json");
  });
});

describe("redactString", () => {
  test("replaces sensitive tokens in JSON-like strings", () => {
    const out = redactString('{"token":"abc","password":"x","user":"a"}');
    expect(out).toBe('{"token":"[REDACTED]","password":"[REDACTED]","user":"a"}');
  });
  test("returns input unchanged if nothing sensitive", () => {
    expect(redactString('{"user":"a"}')).toBe('{"user":"a"}');
  });
});

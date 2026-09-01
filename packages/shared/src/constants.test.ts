import { describe, expect, test } from "bun:test";
import { DEFAULT_BODY_CAP, DEFAULT_TOKEN, REDACTED_VALUE, SENSITIVE_FIELDS } from "./constants.js";

describe("constants", () => {
  test("sensitive fields are lower-case and include authorization", () => {
    expect(SENSITIVE_FIELDS).toContain("authorization");
    expect(SENSITIVE_FIELDS).toContain("cookie");
  });
  test("body cap is 500KB", () => {
    expect(DEFAULT_BODY_CAP).toBe(500_000);
  });
  test("default token and redacted value are set", () => {
    expect(DEFAULT_TOKEN).toBe("dev");
    expect(REDACTED_VALUE).toBe("[REDACTED]");
  });
});

import { describe, expect, test } from "bun:test";
import { parseArgs } from "./cli.js";

describe("cli parseArgs", () => {
  test("defaults", () => {
    expect(parseArgs([])).toEqual({ port: 4000, token: "dev", open: true });
  });
  test("overrides", () => {
    expect(parseArgs(["--port", "5000", "--token", "abc", "--no-open"])).toEqual({
      port: 5000,
      token: "abc",
      open: false,
    });
  });
});

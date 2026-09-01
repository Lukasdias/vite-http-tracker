import { describe, expect, test } from "bun:test";
import { countNodes, jsonString, kindOf, parseJson, parseParams, queryParams } from "./json.js";

describe("parseJson", () => {
  test("parses an object body", () => {
    const r = parseJson('{"a":1,"b":[true,null]}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ a: 1, b: [true, null] });
  });

  test("parses a JSON string body", () => {
    const r = parseJson('"hello"');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("hello");
  });

  test("rejects plain text", () => {
    const r = parseJson("hello world");
    expect(r.ok).toBe(false);
  });

  test("rejects empty input", () => {
    expect(parseJson("").ok).toBe(false);
    expect(parseJson("   ").ok).toBe(false);
  });

  test("rejects malformed json", () => {
    expect(parseJson('{"a":}').ok).toBe(false);
  });
});

describe("kindOf", () => {
  test("classifies values", () => {
    expect(kindOf(null)).toBe("null");
    expect(kindOf([])).toBe("array");
    expect(kindOf({})).toBe("object");
    expect(kindOf("s")).toBe("string");
    expect(kindOf(4)).toBe("number");
    expect(kindOf(true)).toBe("boolean");
  });
});

describe("jsonString", () => {
  test("detects stringified json", () => {
    expect(jsonString('{"a":1}')).toBe('{"a":1}');
    expect(jsonString("[1,2]")).toBe("[1,2]");
    expect(jsonString("hello")).toBeUndefined();
    expect(jsonString('{"a"}')).toBeUndefined();
    expect(jsonString(42)).toBeUndefined();
  });
});

describe("countNodes", () => {
  test("counts scalar + container nodes", () => {
    expect(countNodes({ a: 1 }, 100)).toBe(2);
    expect(countNodes([1, 2], 100)).toBe(3);
    expect(countNodes(5, 100)).toBe(1);
  });

  test("caps at max", () => {
    const big = Array.from({ length: 50 }, (_, i) => i);
    expect(countNodes(big, 3)).toBeGreaterThan(3);
  });
});

describe("parseParams", () => {
  test("parses key/value pairs", () => {
    expect(parseParams("a=1&b=two")).toEqual([
      { key: "a", value: "1" },
      { key: "b", value: "two" },
    ]);
  });

  test("handles bare keys and empty values", () => {
    expect(parseParams("a=1&flag")).toEqual([
      { key: "a", value: "1" },
      { key: "flag", value: "" },
    ]);
  });

  test("decodes uri components", () => {
    expect(parseParams("q=hello%20world")).toEqual([{ key: "q", value: "hello world" }]);
  });

  test("rejects non-param text", () => {
    expect(parseParams("hello world")).toBeUndefined();
    expect(parseParams("")).toBeUndefined();
  });
});

describe("queryParams", () => {
  test("extracts query params", () => {
    expect(queryParams("http://x.test/a?foo=1&bar=baz")).toEqual([
      { key: "foo", value: "1" },
      { key: "bar", value: "baz" },
    ]);
  });

  test("returns undefined without query or invalid url", () => {
    expect(queryParams("http://x.test/a")).toBeUndefined();
    expect(queryParams("not a url")).toBeUndefined();
  });
});

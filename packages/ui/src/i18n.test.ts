import { describe, expect, test } from "bun:test";
import { isLocale, translate, locales } from "./i18n.js";

describe("i18n", () => {
  test("supports every configured locale", () => {
    expect(locales).toEqual(["en", "pt-BR", "es", "de", "zh-CN", "ja"]);
    expect(locales.every((locale) => isLocale(locale))).toBe(true);
  });

  test("translates labels and interpolates values", () => {
    expect(translate("pt-BR", "selectRequest")).toBe("Selecione uma requisição para inspecionar");
    expect(translate("zh-CN", "statusSummary", { status: 200, duration: 12, bytes: 64 })).toBe(
      "状态 200 · 12ms · 64 B",
    );
    expect(translate("ja", "duplicateCount", { count: 2, suffix: "" })).toBe("×2 件の重複");
  });
});

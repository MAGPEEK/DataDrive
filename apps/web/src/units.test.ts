import { describe, expect, it, vi } from "vitest";
import { ApiError, query, request } from "./api/http";
import { formatBytes } from "./format";
import { detectLanguage, translate } from "./i18n/I18nProvider";
import { de, en } from "./i18n/messages";

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [1023, "1,023 B"],
    [1024, "1 KB"],
    [1536, "1.5 KB"],
    [10 * 1024 * 1024, "10 MB"],
    [5 * 1024 ** 3, "5 GB"],
  ])("formats %i as %s", (bytes, expected) => {
    expect(formatBytes(bytes, "en")).toBe(expected);
  });

  it("uses the locale for separators", () => {
    expect(formatBytes(1536, "de")).toBe("1,5 KB");
  });
});

describe("i18n", () => {
  it("detects the language from the browser, a stored choice wins", () => {
    expect(detectLanguage(["de-DE", "en"], null)).toBe("de");
    expect(detectLanguage(["fr-FR"], null)).toBe("en");
    expect(detectLanguage(["de-DE"], "en")).toBe("en");
    expect(detectLanguage(["de-DE"], "xx")).toBe("de");
  });

  it("interpolates parameters", () => {
    expect(translate("en", "uploading", { name: "a.txt" })).toBe("Uploading a.txt…");
    expect(translate("de", "uploading", { name: "a.txt" })).toBe("a.txt wird hochgeladen …");
  });

  it("has the same keys in every language", () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  });
});

describe("http", () => {
  it("builds query strings and skips empty values", () => {
    expect(query({ a: "1", b: null, c: undefined, d: "x y" })).toBe("?a=1&d=x+y");
    expect(query({})).toBe("");
  });

  it("turns error responses into ApiError with the server code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "name_conflict", message: "m" }), { status: 409 }),
      ),
    );
    await expect(request("/x")).rejects.toMatchObject({ status: 409, code: "name_conflict" });
    await expect(request("/x")).rejects.toBeInstanceOf(ApiError);
  });

  it("copes with empty and non-JSON bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    await expect(request("/x")).resolves.toBeUndefined();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Bad Gateway", { status: 502 })),
    );
    await expect(request("/x")).rejects.toMatchObject({ status: 502, code: "unknown" });
  });
});

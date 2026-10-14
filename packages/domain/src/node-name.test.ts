import { describe, expect, it } from "vitest";
import { isValidNodeName } from "./node-name.js";

describe("isValidNodeName", () => {
  it.each(["report.docx", "Fotos 2026", "ä-ö-ü"])("accepts %s", (name) => {
    expect(isValidNodeName(name)).toBe(true);
  });

  it.each(["", ".", "..", " leading", "trailing ", "a/b", "a\b", "a:b", "x".repeat(256)])(
    "rejects %j",
    (name) => {
      expect(isValidNodeName(name)).toBe(false);
    },
  );
});

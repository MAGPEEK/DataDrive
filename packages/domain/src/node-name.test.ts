import { describe, expect, it } from "vitest";
import { isValidNodeName } from "./node-name.js";

describe("isValidNodeName (parity with the reference system)", () => {
  it.each([
    "report.docx",
    "Fotos 2026",
    "ä-ö-ü",
    "a:b",
    "what?",
    "a*b",
    "a<b>c",
    'q"q',
    "a|b",
    "...",
    "con",
    "😀",
    " leading",
    "trailing ",
    "Alpha.",
    "x".repeat(255),
    "ä".repeat(127),
    "😀".repeat(63),
  ])("accepts %j", (name) => {
    expect(isValidNodeName(name)).toBe(true);
  });

  it.each([
    "",
    ".",
    "..",
    "a/b",
    "a\\b",
    "x".repeat(256),
    "ä".repeat(128),
    "😀".repeat(64),
    "a\u0000b",
  ])("rejects %j", (name) => {
    expect(isValidNodeName(name)).toBe(false);
  });
});

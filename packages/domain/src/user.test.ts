import { describe, expect, it } from "vitest";
import {
  InvalidUsernameError,
  WeakPasswordError,
  assertStrongPassword,
  normalizeUsername,
} from "./user.js";

describe("normalizeUsername", () => {
  it("lowercases and trims", () => {
    expect(normalizeUsername("  Alice.B  ")).toBe("alice.b");
  });

  it.each(["ab", "-abc", "a b c", "ä-user", "x".repeat(33), ""])("rejects %j", (name) => {
    expect(() => normalizeUsername(name)).toThrow(InvalidUsernameError);
  });
});

describe("assertStrongPassword", () => {
  it("accepts long passwords including unicode", () => {
    expect(() => assertStrongPassword("correct horse battery")).not.toThrow();
    expect(() => assertStrongPassword("äöüäöüäöüä")).not.toThrow();
  });

  it("rejects short and oversized passwords", () => {
    expect(() => assertStrongPassword("short")).toThrow(WeakPasswordError);
    expect(() => assertStrongPassword("x".repeat(257))).toThrow(WeakPasswordError);
  });
});

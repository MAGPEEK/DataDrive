import { describe, expect, it } from "vitest";
import {
  InvalidDriveNameError,
  createPersonalDrive,
  maxRole,
  normalizeDriveName,
  roleAllows,
} from "./drive.js";

describe("roleAllows", () => {
  it.each([
    ["viewer", "read", true],
    ["viewer", "write", false],
    ["editor", "write", true],
    ["editor", "manage", false],
    ["manager", "manage", true],
    [null, "read", false],
  ] as const)("%s may %s: %s", (role, permission, expected) => {
    expect(roleAllows(role, permission)).toBe(expected);
  });
});

describe("maxRole", () => {
  it("returns the strongest role or null", () => {
    expect(maxRole(["viewer", "manager", "editor"])).toBe("manager");
    expect(maxRole(["viewer"])).toBe("viewer");
    expect(maxRole([])).toBeNull();
  });
});

describe("drives", () => {
  it("creates an unlimited personal drive with the user id", () => {
    const drive = createPersonalDrive("u1", "alice", new Date(0));
    expect(drive).toMatchObject({ id: "u1", kind: "personal", quotaBytes: null });
    expect(drive.settings.maxVersions).toBe(32);
  });

  it("validates names", () => {
    expect(normalizeDriveName("  Marketing ")).toBe("Marketing");
    expect(() => normalizeDriveName("   ")).toThrow(InvalidDriveNameError);
    expect(() => normalizeDriveName("x".repeat(101))).toThrow(InvalidDriveNameError);
  });
});

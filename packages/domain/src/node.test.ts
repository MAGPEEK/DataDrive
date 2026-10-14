import { describe, expect, it } from "vitest";
import { InvalidNameError, NameConflictError } from "./errors.js";
import {
  createFolder,
  moveNode,
  moveToTrash,
  renameNode,
  restoreFromTrash,
  type DriveNode,
} from "./node.js";

const now = new Date("2026-10-14T12:00:00Z");
const input = { id: "n1", driveId: "u1", parentId: null, name: "Fotos", now };

function folder(overrides: Partial<DriveNode> = {}): DriveNode {
  return { ...createFolder(input, []), ...overrides };
}

describe("createFolder", () => {
  it("creates an untrashed folder", () => {
    expect(createFolder(input, [])).toMatchObject({
      kind: "folder",
      name: "Fotos",
      trashedAt: null,
    });
  });

  it("rejects invalid names", () => {
    expect(() => createFolder({ ...input, name: "a/b" }, [])).toThrow(InvalidNameError);
  });

  it("rejects a sibling with the same name regardless of case", () => {
    const sibling = folder({ id: "n2", name: "fotos" });
    expect(() => createFolder(input, [sibling])).toThrow(NameConflictError);
  });

  it("ignores trashed siblings", () => {
    const sibling = folder({ id: "n2", trashedAt: now });
    expect(createFolder(input, [sibling]).name).toBe("Fotos");
  });
});

describe("trash", () => {
  it("marks a node as trashed and keeps the first trash time", () => {
    const trashed = moveToTrash(folder(), now);
    const later = new Date("2026-10-15T00:00:00Z");
    expect(moveToTrash(trashed, later).trashedAt).toEqual(now);
  });

  it("restores a node", () => {
    const trashed = moveToTrash(folder(), now);
    expect(restoreFromTrash(trashed, []).trashedAt).toBeNull();
  });

  it("refuses to restore into a name conflict", () => {
    const trashed = moveToTrash(folder(), now);
    const sibling = folder({ id: "n2" });
    expect(() => restoreFromTrash(trashed, [sibling])).toThrow(NameConflictError);
  });
});

describe("rename and move", () => {
  it("renames a node and rejects invalid or taken names", () => {
    const folder = createFolder(input, []);
    const other = { ...createFolder({ ...input, id: "n2", name: "Other" }, []) };
    expect(renameNode(folder, "Neu", [folder]).name).toBe("Neu");
    expect(renameNode(folder, "FOTOS", [folder]).name).toBe("FOTOS");
    expect(() => renameNode(folder, "a/b", [])).toThrow(InvalidNameError);
    expect(() => renameNode(folder, "other", [folder, other])).toThrow(NameConflictError);
  });

  it("moves a node and rejects a name clash at the target", () => {
    const folder = createFolder(input, []);
    const clash = createFolder({ ...input, id: "n2", parentId: "target" }, []);
    expect(moveNode(folder, "target", []).parentId).toBe("target");
    expect(() => moveNode(folder, "target", [clash])).toThrow(NameConflictError);
  });
});

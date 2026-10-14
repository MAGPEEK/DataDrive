import { describe, expect, it } from "vitest";
import type { NodeInfo } from "../api/types";
import { driveRoot, enterFolder, locationKey, popTo, currentFolder } from "../workspace/locations";
import { applyClick, emptySelection, neighbor, prune, selectAll } from "./selection";
import { sortNodes, toggleSort, uniqueName } from "./sorting";

const caps = {
  canRead: true,
  canWrite: true,
  canDelete: true,
  canRename: true,
  canShare: true,
  canDownload: true,
};

function node(
  name: string,
  kind: "file" | "folder" = "file",
  extra: Partial<NodeInfo> = {},
): NodeInfo {
  return {
    id: name,
    driveId: "d",
    parentId: null,
    name,
    kind,
    size: 0,
    createdAt: "2026-01-01T00:00:00Z",
    modifiedAt: "2026-01-01T00:00:00Z",
    trashedAt: null,
    starred: false,
    capabilities: caps,
    ...extra,
  };
}

const ids = ["a", "b", "c", "d", "e"];
const plain = { toggle: false, range: false };

describe("selection", () => {
  it("selects one item on a plain click and replaces the previous selection", () => {
    const first = applyClick(emptySelection, ids, { id: "b", ...plain });
    expect([...first.ids]).toEqual(["b"]);
    expect([...applyClick(first, ids, { id: "d", ...plain }).ids]).toEqual(["d"]);
  });

  it("toggles single items with ctrl or cmd", () => {
    let s = applyClick(emptySelection, ids, { id: "a", ...plain });
    s = applyClick(s, ids, { id: "c", ...{ toggle: true, range: false } });
    expect([...s.ids].sort()).toEqual(["a", "c"]);
    s = applyClick(s, ids, { id: "a", ...{ toggle: true, range: false } });
    expect([...s.ids]).toEqual(["c"]);
  });

  it("selects a range from the anchor in both directions", () => {
    const start = applyClick(emptySelection, ids, { id: "b", ...plain });
    expect([...applyClick(start, ids, { id: "d", ...{ toggle: false, range: true } }).ids]).toEqual(
      ["b", "c", "d"],
    );
    expect([...applyClick(start, ids, { id: "a", ...{ toggle: false, range: true } }).ids]).toEqual(
      ["a", "b"],
    );
  });

  it("treats a shift-click without anchor as a plain click", () => {
    expect([
      ...applyClick(emptySelection, ids, { id: "c", ...{ toggle: false, range: true } }).ids,
    ]).toEqual(["c"]);
  });

  it("selects all, prunes vanished items and moves with the keyboard", () => {
    expect(selectAll(ids).ids.size).toBe(5);
    const pruned = prune(selectAll(ids), ["a", "b"]);
    expect([...pruned.ids]).toEqual(["a", "b"]);
    expect(prune(pruned, ["a", "b"])).toBe(pruned);
    expect(neighbor(ids, "b", 1)).toBe("c");
    expect(neighbor(ids, "e", 1)).toBe("e");
    expect(neighbor(ids, "a", -1)).toBe("a");
    expect(neighbor(ids, null, 1)).toBe("a");
    expect(neighbor(ids, null, -1)).toBe("e");
    expect(neighbor([], null, 1)).toBeNull();
  });
});

describe("sorting", () => {
  it("lists folders first and orders names naturally", () => {
    const sorted = sortNodes(
      [
        node("b.txt"),
        node("Zeta", "folder"),
        node("a10.txt"),
        node("a2.txt"),
        node("alpha", "folder"),
      ],
      { key: "name", direction: "asc" },
    );
    expect(sorted.map((n) => n.name)).toEqual(["alpha", "Zeta", "a2.txt", "a10.txt", "b.txt"]);
  });

  it("sorts by size and modification date, descending too, keeping folders first", () => {
    const items = [
      node("small", "file", { size: 1 }),
      node("big", "file", { size: 9 }),
      node("dir", "folder"),
    ];
    expect(sortNodes(items, { key: "size", direction: "desc" }).map((n) => n.name)).toEqual([
      "dir",
      "big",
      "small",
    ]);
    const dated = [
      node("old", "file", { modifiedAt: "2025-01-01T00:00:00Z" }),
      node("new", "file", { modifiedAt: "2026-06-01T00:00:00Z" }),
    ];
    expect(sortNodes(dated, { key: "modified", direction: "desc" }).map((n) => n.name)).toEqual([
      "new",
      "old",
    ]);
  });

  it("toggles direction on the same key and resets on a new key", () => {
    expect(toggleSort({ key: "name", direction: "asc" }, "name")).toEqual({
      key: "name",
      direction: "desc",
    });
    expect(toggleSort({ key: "name", direction: "desc" }, "size")).toEqual({
      key: "size",
      direction: "asc",
    });
  });

  it("finds a free name for new folders", () => {
    expect(uniqueName("New folder", [])).toBe("New folder");
    expect(uniqueName("New folder", ["new FOLDER"])).toBe("New folder (2)");
    expect(uniqueName("New folder", ["New folder", "New folder (2)"])).toBe("New folder (3)");
  });
});

describe("locations", () => {
  it("builds the folder trail and keeps virtual lists out of folders", () => {
    const root = driveRoot("d");
    const inner = enterFolder(enterFolder(root, node("A", "folder")), node("B", "folder"));
    expect(currentFolder(inner)).toEqual({ driveId: "d", parentId: "B" });
    expect(popTo(inner, 1)).toMatchObject({ trail: [{ id: "A" }] });
    expect(currentFolder(popTo(inner, 0))).toEqual({ driveId: "d", parentId: null });
    expect(currentFolder({ kind: "recent" })).toBeNull();
    expect(popTo({ kind: "starred" }, 0)).toEqual({ kind: "starred" });
    expect(enterFolder({ kind: "recent" }, node("X", "folder"))).toMatchObject({
      kind: "drive",
      trail: [{ id: "X" }],
    });
  });

  it("gives every place its own key", () => {
    const keys = [
      driveRoot("d"),
      driveRoot("e"),
      { kind: "recent" as const },
      { kind: "starred" as const },
      { kind: "trash" as const, driveId: "d" },
      { kind: "search" as const, term: "x" },
      enterFolder(driveRoot("d"), node("A", "folder")),
    ].map(locationKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

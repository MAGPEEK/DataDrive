import { describe, expect, it, vi } from "vitest";
import type { NodeInfo } from "../api/types";
import { driveRoot } from "../workspace/locations";
import { itemActions, type ItemActionHandlers } from "./actions";

const caps = {
  canRead: true,
  canWrite: true,
  canDelete: true,
  canRename: true,
  canShare: true,
  canDownload: true,
};

const node = (name: string, extra: Partial<NodeInfo> = {}): NodeInfo => ({
  id: name,
  driveId: "d",
  parentId: null,
  name,
  kind: "file",
  size: 1,
  createdAt: "2026-01-01T00:00:00Z",
  modifiedAt: "2026-01-01T00:00:00Z",
  trashedAt: null,
  starred: false,
  capabilities: caps,
  ...extra,
});

const handlers = (): ItemActionHandlers => ({
  open: vi.fn(),
  download: vi.fn(),
  setStar: vi.fn(),
  rename: vi.fn(),
  moveTo: vi.fn(),
  trash: vi.fn(),
  restore: vi.fn(),
  showInFolder: vi.fn(),
});

const ids = (selected: NodeInfo[], location = driveRoot("d")) =>
  itemActions({ selected, location, handlers: handlers() }).map((a) => a.id);

describe("itemActions", () => {
  it("offers nothing without a selection", () => {
    expect(ids([])).toEqual([]);
  });

  it("offers the full set for one editable file", () => {
    expect(ids([node("a.txt")])).toEqual(["open", "download", "rename", "star", "move", "trash"]);
  });

  it("does not offer download for folders or when downloads are restricted", () => {
    expect(ids([node("F", { kind: "folder" })])).not.toContain("download");
    const restricted = node("a", { capabilities: { ...caps, canDownload: false } });
    expect(ids([restricted])).not.toContain("download");
  });

  it("offers only bulk actions for several items", () => {
    expect(ids([node("a"), node("b")])).toEqual(["star", "move", "trash"]);
  });

  it("hides editing actions for read-only items", () => {
    const readOnly = node("r", {
      capabilities: { ...caps, canWrite: false, canDelete: false, canRename: false },
    });
    expect(ids([readOnly])).toEqual(["open", "download", "star"]);
  });

  it("hides move and delete as soon as one selected item is not editable", () => {
    const readOnly = node("r", { capabilities: { ...caps, canWrite: false, canDelete: false } });
    expect(ids([node("a"), readOnly])).toEqual(["star"]);
  });

  it("stars everything first and unstars only when all are starred", () => {
    const h = handlers();
    const mixed = itemActions({
      selected: [node("a", { starred: true }), node("b")],
      location: driveRoot("d"),
      handlers: h,
    });
    expect(mixed.find((a) => a.id === "star")?.label).toBe("addStar");
    const allStarred = itemActions({
      selected: [node("a", { starred: true })],
      location: driveRoot("d"),
      handlers: h,
    });
    const star = allStarred.find((a) => a.id === "star");
    expect(star?.label).toBe("removeStar");
    star?.run();
    expect(h.setStar).toHaveBeenCalledWith([expect.objectContaining({ id: "a" })], false);
  });

  it("offers 'show in folder' only outside of drive folders", () => {
    expect(ids([node("a")], { kind: "recent" as const } as never)).toContain("show");
    expect(ids([node("a")])).not.toContain("show");
  });

  it("offers only restore in the recycle bin", () => {
    expect(ids([node("a")], { kind: "trash" as const, driveId: "d" } as never)).toEqual([
      "restore",
    ]);
  });
});

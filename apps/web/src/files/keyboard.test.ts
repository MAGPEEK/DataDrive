import { describe, expect, it, vi } from "vitest";
import type { NodeInfo } from "../api/types";
import { dispatchKey, type KeyCommands, type KeyLike } from "./keyboard";

const caps = {
  canRead: true,
  canWrite: true,
  canDelete: true,
  canRename: true,
  canShare: true,
  canDownload: true,
};
const node = (id: string, extra: Partial<NodeInfo["capabilities"]> = {}): NodeInfo => ({
  id,
  driveId: "d",
  parentId: null,
  name: id,
  kind: "file",
  size: 0,
  createdAt: "2026-01-01T00:00:00Z",
  modifiedAt: "2026-01-01T00:00:00Z",
  trashedAt: null,
  starred: false,
  capabilities: { ...caps, ...extra },
});

const key = (name: string, extra: Partial<KeyLike> = {}): KeyLike => ({
  key: name,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...extra,
});

function commands(): KeyCommands {
  return {
    step: vi.fn(),
    selectAll: vi.fn(),
    clear: vi.fn(),
    open: vi.fn(),
    rename: vi.fn(),
    trash: vi.fn(),
  };
}

const run = (event: KeyLike, selected: NodeInfo[] = [], inTrash = false) => {
  const c = commands();
  return { handled: dispatchKey(event, { selected, inTrash }, c), c };
};

describe("dispatchKey", () => {
  it("moves the selection with the arrow keys and extends it with shift", () => {
    const down = run(key("ArrowDown"));
    expect(down.handled).toBe(true);
    expect(down.c.step).toHaveBeenCalledWith(1, false);
    expect(run(key("ArrowUp", { shiftKey: true })).c.step).toHaveBeenCalledWith(-1, true);
  });

  it("selects all with ctrl or cmd + a and clears with escape", () => {
    expect(run(key("a", { ctrlKey: true })).c.selectAll).toHaveBeenCalled();
    expect(run(key("A", { metaKey: true })).c.selectAll).toHaveBeenCalled();
    expect(run(key("Escape")).c.clear).toHaveBeenCalled();
    expect(run(key("a")).handled).toBe(false);
  });

  it("opens and renames only a single selected item", () => {
    const one = node("a");
    expect(run(key("Enter"), [one]).c.open).toHaveBeenCalledWith(one);
    expect(run(key("F2"), [one]).c.rename).toHaveBeenCalledWith(one);
    expect(run(key("Enter"), [one, node("b")]).handled).toBe(false);
    expect(run(key("F2"), [node("a", { canRename: false })]).handled).toBe(false);
  });

  it("deletes with Delete or Backspace when allowed and never in the recycle bin", () => {
    const items = [node("a"), node("b")];
    expect(run(key("Delete"), items).c.trash).toHaveBeenCalledWith(items);
    expect(run(key("Backspace"), items).c.trash).toHaveBeenCalled();
    expect(run(key("Delete"), items, true).handled).toBe(false);
    expect(run(key("Delete"), [node("a", { canDelete: false })]).handled).toBe(false);
    expect(run(key("Delete")).handled).toBe(false);
  });

  it("ignores other keys", () => {
    expect(run(key("x"), [node("a")]).handled).toBe(false);
  });
});

import {
  ForbiddenError,
  InvalidMoveError,
  NameConflictError,
  NotFoundError,
} from "@datadrive/domain";
import { describe, expect, it } from "vitest";
import {
  describeNodes,
  listRecentUseCase,
  listStarredUseCase,
  pathOfUseCase,
  searchUseCase,
  setStarUseCase,
} from "./catalog.js";
import { downloadFileUseCase, uploadFileUseCase } from "./files.js";
import { createFolderUseCase, listChildrenUseCase, trashNodeUseCase } from "./folders.js";
import { moveNodeUseCase, renameNodeUseCase } from "./nodes-edit.js";
import { createTeamFolderUseCase, setMemberUseCase, updateDriveUseCase } from "./teams.js";
import { FixedClock } from "./testing/in-memory.js";
import { createWorld } from "./testing/world.js";

async function* bytes(text: string): AsyncGenerator<Uint8Array> {
  yield new TextEncoder().encode(text);
}

async function setup() {
  const world = createWorld();
  const alice = await world.user("alice");
  const bob = await world.user("bob");
  const admin = await world.user("root", "admin");
  const { deps } = world;
  const folder = (name: string, parentId: string | null = null) =>
    createFolderUseCase(deps, alice, { parentId, name });
  const file = (name: string, parentId: string | null = null) =>
    uploadFileUseCase(deps, alice, { parentId, name, content: bytes(name) }).then((r) => r.node);
  return { world, deps, alice, bob, admin, folder, file };
}

describe("rename", () => {
  it("renames, keeps the content and rejects clashes and strangers", async () => {
    const { deps, alice, bob, folder } = await setup();
    const a = await folder("A");
    await folder("B");
    expect((await renameNodeUseCase(deps, alice, { nodeId: a.id, name: "Neu" })).name).toBe("Neu");
    await expect(renameNodeUseCase(deps, alice, { nodeId: a.id, name: "b" })).rejects.toThrow(
      NameConflictError,
    );
    await expect(renameNodeUseCase(deps, bob, { nodeId: a.id, name: "X" })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("move", () => {
  it("moves into folders and back to the root", async () => {
    const { deps, alice, folder, file } = await setup();
    const target = await folder("Ziel");
    const doc = await file("a.txt");
    await moveNodeUseCase(deps, alice, { nodeId: doc.id, targetParentId: target.id });
    expect(await listChildrenUseCase(deps, alice, { parentId: target.id })).toHaveLength(1);
    await moveNodeUseCase(deps, alice, { nodeId: doc.id, targetParentId: null });
    expect(await listChildrenUseCase(deps, alice, { parentId: target.id })).toHaveLength(0);
  });

  it("refuses moves into itself, its subtree, files, other drives and name clashes", async () => {
    const { world, deps, alice, admin, folder, file } = await setup();
    const parent = await folder("P");
    const child = await folder("C", parent.id);
    const doc = await file("f.txt");
    await expect(
      moveNodeUseCase(deps, alice, { nodeId: parent.id, targetParentId: child.id }),
    ).rejects.toThrow(InvalidMoveError);
    await expect(
      moveNodeUseCase(deps, alice, { nodeId: parent.id, targetParentId: parent.id }),
    ).rejects.toThrow(InvalidMoveError);
    await expect(
      moveNodeUseCase(deps, alice, { nodeId: parent.id, targetParentId: doc.id }),
    ).rejects.toThrow(NotFoundError);
    const team = await createTeamFolderUseCase(deps, admin, "T");
    await setMemberUseCase(deps, admin, {
      driveId: team.id,
      subjectType: "user",
      subjectId: alice.id,
      role: "editor",
    });
    const teamFolder = await createFolderUseCase(deps, alice, {
      driveId: team.id,
      parentId: null,
      name: "Team",
    });
    await expect(
      moveNodeUseCase(deps, alice, { nodeId: doc.id, targetParentId: teamFolder.id }),
    ).rejects.toThrow(InvalidMoveError);
    await folder("F", parent.id);
    const other = await folder("F");
    await expect(
      moveNodeUseCase(deps, alice, { nodeId: other.id, targetParentId: parent.id }),
    ).rejects.toThrow(NameConflictError);
    expect(world.deps).toBe(deps);
  });
});

describe("stars", () => {
  it("are personal, list live items only and are checked for access", async () => {
    const { deps, alice, bob, folder } = await setup();
    const a = await folder("A");
    const b = await folder("B");
    await setStarUseCase(deps, alice, { nodeId: a.id, starred: true });
    await setStarUseCase(deps, alice, { nodeId: b.id, starred: true });
    await setStarUseCase(deps, alice, { nodeId: b.id, starred: false });
    expect((await listStarredUseCase(deps, alice)).map((n) => n.name)).toEqual(["A"]);
    expect(await listStarredUseCase(deps, bob)).toEqual([]);
    await expect(setStarUseCase(deps, bob, { nodeId: a.id, starred: true })).rejects.toThrow(
      NotFoundError,
    );
    await trashNodeUseCase(deps, alice, a.id);
    expect(await listStarredUseCase(deps, alice)).toEqual([]);
  });

  it("show up in node views per user", async () => {
    const { deps, alice, folder } = await setup();
    const a = await folder("A");
    await setStarUseCase(deps, alice, { nodeId: a.id, starred: true });
    const [view] = await describeNodes(deps, alice, [a]);
    expect(view).toMatchObject({ starred: true, capabilities: { canWrite: true, canShare: true } });
  });
});

describe("search and recent", () => {
  it("finds by name case-insensitively across accessible drives only", async () => {
    const { deps, alice, bob, admin, folder, file } = await setup();
    await folder("Urlaub 2026");
    const nested = await folder("Archiv");
    await file("urlaubsplan.txt", nested.id);
    expect(
      (await searchUseCase(deps, alice, { term: "URLAUB" })).map((n) => n.name).sort(),
    ).toEqual(["Urlaub 2026", "urlaubsplan.txt"]);
    expect(await searchUseCase(deps, bob, { term: "urlaub" })).toEqual([]);
    expect(await searchUseCase(deps, alice, { term: "   " })).toEqual([]);
    const team = await createTeamFolderUseCase(deps, admin, "T");
    await setMemberUseCase(deps, admin, {
      driveId: team.id,
      subjectType: "user",
      subjectId: bob.id,
      role: "viewer",
    });
    await createFolderUseCase(deps, admin, { driveId: team.id, parentId: null, name: "x" }).catch(
      () => undefined,
    );
  });

  it("lists recently modified files, newest first, without trash", async () => {
    const { world, deps, alice, file } = await setup();
    const clock = world.deps.clock as FixedClock;
    const old = await file("old.txt");
    clock.advance(60_000);
    await file("new.txt");
    clock.advance(60_000);
    const gone = await file("gone.txt");
    await trashNodeUseCase(deps, alice, gone.id);
    expect((await listRecentUseCase(deps, alice)).map((n) => n.name)).toEqual([
      "new.txt",
      old.name,
    ]);
  });
});

describe("path", () => {
  it("returns the folders above a node from the root down", async () => {
    const { deps, alice, bob, folder, file } = await setup();
    const a = await folder("A");
    const b = await folder("B", a.id);
    const doc = await file("f.txt", b.id);
    expect((await pathOfUseCase(deps, alice, doc.id)).map((n) => n.name)).toEqual(["A", "B"]);
    await expect(pathOfUseCase(deps, bob, doc.id)).rejects.toThrow(NotFoundError);
  });
});

describe("restricted downloads", () => {
  it("block viewers but not editors", async () => {
    const { deps, alice, bob, admin } = await setup();
    const team = await createTeamFolderUseCase(deps, admin, "T");
    await setMemberUseCase(deps, admin, {
      driveId: team.id,
      subjectType: "user",
      subjectId: alice.id,
      role: "editor",
    });
    await setMemberUseCase(deps, admin, {
      driveId: team.id,
      subjectType: "user",
      subjectId: bob.id,
      role: "viewer",
    });
    const { node } = await uploadFileUseCase(deps, alice, {
      driveId: team.id,
      parentId: null,
      name: "a.txt",
      content: bytes("x"),
    });
    await updateDriveUseCase(deps, admin, {
      driveId: team.id,
      settings: { restrictDownloads: true },
    });
    await expect(downloadFileUseCase(deps, bob, node.id)).rejects.toThrow(ForbiddenError);
    expect((await downloadFileUseCase(deps, alice, node.id)).node.id).toBe(node.id);
    const [view] = await describeNodes(deps, bob, [node]);
    expect(view?.capabilities.canDownload).toBe(false);
  });
});

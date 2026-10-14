import { NameConflictError, NotFoundError, NotInTrashError } from "@datadrive/domain";
import { describe, expect, it } from "vitest";
import {
  createFolderUseCase,
  listChildrenUseCase,
  listTrashUseCase,
  restoreNodeUseCase,
  trashNodeUseCase,
} from "./folders.js";
import { createWorld } from "./testing/world.js";

const root = { parentId: null };

describe("trash listing", () => {
  it("lists trashed nodes, newest first, and empties after restore", async () => {
    const world = createWorld();
    const alice = await world.user("alice");
    const clock = world.deps.clock as { advance(ms: number): void };
    const a = await createFolderUseCase(world.deps, alice, { ...root, name: "A" });
    const b = await createFolderUseCase(world.deps, alice, { ...root, name: "B" });
    await trashNodeUseCase(world.deps, alice, a.id);
    clock.advance(1000);
    await trashNodeUseCase(world.deps, alice, b.id);
    const names = (await listTrashUseCase(world.deps, alice, undefined)).map((n) => n.name);
    expect(names).toEqual(["B", "A"]);
    await restoreNodeUseCase(world.deps, alice, a.id);
    expect(await listTrashUseCase(world.deps, alice, undefined)).toHaveLength(1);
  });

  it("is hidden from other users", async () => {
    const world = createWorld();
    const alice = await world.user("alice");
    const bob = await world.user("bob");
    await expect(listTrashUseCase(world.deps, bob, alice.id)).rejects.toThrow(NotFoundError);
  });
});

describe("folders", () => {
  it("creates and lists folders in the personal drive", async () => {
    const world = createWorld();
    const alice = await world.user("alice");
    await createFolderUseCase(world.deps, alice, { ...root, name: "Fotos" });
    const names = (await listChildrenUseCase(world.deps, alice, root)).map((n) => n.name);
    expect(names).toEqual(["Fotos"]);
  });

  it("creates nested folders in the drive of the parent", async () => {
    const world = createWorld();
    const alice = await world.user("alice");
    const parent = await createFolderUseCase(world.deps, alice, { ...root, name: "A" });
    const child = await createFolderUseCase(world.deps, alice, { parentId: parent.id, name: "B" });
    expect(child.driveId).toBe(alice.id);
    expect(await listChildrenUseCase(world.deps, alice, { parentId: parent.id })).toHaveLength(1);
  });

  it("rejects duplicate names", async () => {
    const world = createWorld();
    const alice = await world.user("alice");
    await createFolderUseCase(world.deps, alice, { ...root, name: "A" });
    await expect(createFolderUseCase(world.deps, alice, { ...root, name: "a" })).rejects.toThrow(
      NameConflictError,
    );
  });

  it("keeps personal drives separated", async () => {
    const world = createWorld();
    const alice = await world.user("alice");
    const bob = await world.user("bob");
    const folder = await createFolderUseCase(world.deps, alice, { ...root, name: "A" });
    expect(await listChildrenUseCase(world.deps, bob, root)).toEqual([]);
    await expect(
      listChildrenUseCase(world.deps, bob, { driveId: alice.id, parentId: null }),
    ).rejects.toThrow(NotFoundError);
    await expect(listChildrenUseCase(world.deps, bob, { parentId: folder.id })).rejects.toThrow(
      NotFoundError,
    );
    await expect(trashNodeUseCase(world.deps, bob, folder.id)).rejects.toThrow(NotFoundError);
  });

  it("hides trashed folders and restores them", async () => {
    const world = createWorld();
    const alice = await world.user("alice");
    const folder = await createFolderUseCase(world.deps, alice, { ...root, name: "A" });
    await trashNodeUseCase(world.deps, alice, folder.id);
    expect(await listChildrenUseCase(world.deps, alice, root)).toEqual([]);
    await restoreNodeUseCase(world.deps, alice, folder.id);
    expect(await listChildrenUseCase(world.deps, alice, root)).toHaveLength(1);
  });

  it("only restores items that are in the trash", async () => {
    const world = createWorld();
    const alice = await world.user("alice");
    const folder = await createFolderUseCase(world.deps, alice, { ...root, name: "A" });
    await expect(restoreNodeUseCase(world.deps, alice, folder.id)).rejects.toThrow(NotInTrashError);
  });

  it("refuses to restore into a name conflict", async () => {
    const world = createWorld();
    const alice = await world.user("alice");
    const first = await createFolderUseCase(world.deps, alice, { ...root, name: "A" });
    await trashNodeUseCase(world.deps, alice, first.id);
    await createFolderUseCase(world.deps, alice, { ...root, name: "A" });
    await expect(restoreNodeUseCase(world.deps, alice, first.id)).rejects.toThrow(
      NameConflictError,
    );
  });
});

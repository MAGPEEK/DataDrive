import { describe, expect, it } from "vitest";
import { NameConflictError, NotFoundError, NotInTrashError } from "@datadrive/domain";
import {
  createFolderUseCase,
  listChildrenUseCase,
  restoreNodeUseCase,
  trashNodeUseCase,
} from "./folders.js";
import { testDependencies } from "./testing/in-memory.js";

const alice = "alice";
const bob = "bob";

describe("folders", () => {
  it("creates and lists folders in the personal root", async () => {
    const deps = testDependencies();
    await createFolderUseCase(deps, { ownerId: alice, parentId: null, name: "Fotos" });
    const names = (await listChildrenUseCase(deps, alice, null)).map((n) => n.name);
    expect(names).toEqual(["Fotos"]);
  });

  it("creates nested folders", async () => {
    const deps = testDependencies();
    const parent = await createFolderUseCase(deps, { ownerId: alice, parentId: null, name: "A" });
    await createFolderUseCase(deps, { ownerId: alice, parentId: parent.id, name: "B" });
    expect(await listChildrenUseCase(deps, alice, parent.id)).toHaveLength(1);
  });

  it("rejects duplicate names", async () => {
    const deps = testDependencies();
    await createFolderUseCase(deps, { ownerId: alice, parentId: null, name: "A" });
    await expect(
      createFolderUseCase(deps, { ownerId: alice, parentId: null, name: "a" }),
    ).rejects.toThrow(NameConflictError);
  });

  it("keeps users separated", async () => {
    const deps = testDependencies();
    const folder = await createFolderUseCase(deps, { ownerId: alice, parentId: null, name: "A" });
    expect(await listChildrenUseCase(deps, bob, null)).toEqual([]);
    await expect(listChildrenUseCase(deps, bob, folder.id)).rejects.toThrow(NotFoundError);
    await expect(trashNodeUseCase(deps, bob, folder.id)).rejects.toThrow(NotFoundError);
  });

  it("hides trashed folders and restores them", async () => {
    const deps = testDependencies();
    const folder = await createFolderUseCase(deps, { ownerId: alice, parentId: null, name: "A" });
    await trashNodeUseCase(deps, alice, folder.id);
    expect(await listChildrenUseCase(deps, alice, null)).toEqual([]);
    await restoreNodeUseCase(deps, alice, folder.id);
    expect(await listChildrenUseCase(deps, alice, null)).toHaveLength(1);
  });

  it("only restores items that are in the trash", async () => {
    const deps = testDependencies();
    const folder = await createFolderUseCase(deps, { ownerId: alice, parentId: null, name: "A" });
    await expect(restoreNodeUseCase(deps, alice, folder.id)).rejects.toThrow(NotInTrashError);
  });

  it("refuses to restore into a name conflict", async () => {
    const deps = testDependencies();
    const first = await createFolderUseCase(deps, { ownerId: alice, parentId: null, name: "A" });
    await trashNodeUseCase(deps, alice, first.id);
    await createFolderUseCase(deps, { ownerId: alice, parentId: null, name: "A" });
    await expect(restoreNodeUseCase(deps, alice, first.id)).rejects.toThrow(NameConflictError);
  });
});

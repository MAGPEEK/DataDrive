import { ForbiddenError, NotFoundError, QuotaExceededError } from "@datadrive/domain";
import { describe, expect, it } from "vitest";
import { downloadFileUseCase, downloadVersionUseCase, uploadFileUseCase } from "./files.js";
import { collectGarbageUseCase } from "./maintenance.js";
import { createTeamFolderUseCase, setMemberUseCase, updateDriveUseCase } from "./teams.js";
import { InMemoryBlockStore, type FixedClock } from "./testing/in-memory.js";
import { createWorld } from "./testing/world.js";
import { listVersionsUseCase, restoreVersionUseCase } from "./versions.js";

async function* bytes(text: string): AsyncGenerator<Uint8Array> {
  yield new TextEncoder().encode(text);
}

async function read(source: AsyncIterable<Uint8Array>): Promise<string> {
  let out = "";
  for await (const chunk of source) out += new TextDecoder().decode(chunk);
  return out;
}

async function setup() {
  const world = createWorld();
  const alice = await world.user("alice");
  const { deps } = world;
  const clock = deps.clock as FixedClock;
  const save = async (text: string) => {
    clock.advance(60_000);
    return uploadFileUseCase(deps, alice, {
      parentId: null,
      name: "doc.txt",
      content: bytes(text),
    });
  };
  return { world, deps, alice, clock, save };
}

describe("version history", () => {
  it("lists every upload as a version, newest first, with author and current flag", async () => {
    const { deps, alice, save } = await setup();
    const { node } = await save("eins");
    await save("zwei");
    await save("drei");
    const views = await listVersionsUseCase(deps, alice, node.id);
    expect(views.map((v) => v.version.size)).toEqual([4, 4, 4]);
    expect(views.map((v) => v.current)).toEqual([true, false, false]);
    expect(views[0]?.authorName).toBe("alice");
  });

  it("restores an old version as a new current version and keeps the history", async () => {
    const { deps, alice, clock, save } = await setup();
    const { node } = await save("alt!");
    await save("neuer text");
    const [, old] = await listVersionsUseCase(deps, alice, node.id);
    clock.advance(60_000);
    const restored = await restoreVersionUseCase(deps, alice, {
      nodeId: node.id,
      versionId: old?.version.id ?? "",
    });
    expect(restored.size).toBe(4);
    expect(await read((await downloadFileUseCase(deps, alice, node.id)).content)).toBe("alt!");
    const after = await listVersionsUseCase(deps, alice, node.id);
    expect(after).toHaveLength(3);
    expect(after[0]?.current).toBe(true);
  });

  it("downloads a specific version and rejects versions of other files", async () => {
    const { deps, alice, save } = await setup();
    const { node } = await save("erste");
    await save("zweite");
    const other = await uploadFileUseCase(deps, alice, {
      parentId: null,
      name: "x.txt",
      content: bytes("x"),
    });
    const [, first] = await listVersionsUseCase(deps, alice, node.id);
    const download = await downloadVersionUseCase(deps, alice, {
      nodeId: node.id,
      versionId: first?.version.id ?? "",
    });
    expect(await read(download.content)).toBe("erste");
    const foreign = (await listVersionsUseCase(deps, alice, other.node.id))[0]?.version.id ?? "";
    await expect(
      downloadVersionUseCase(deps, alice, { nodeId: node.id, versionId: foreign }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("version retention", () => {
  it("keeps only as many versions as the drive allows", async () => {
    const { deps, alice, save } = await setup();
    await updateDriveUseCase(
      deps,
      { id: "root", role: "admin" },
      { driveId: alice.id, settings: { maxVersions: 2 } },
    );
    const { node } = await save("v1");
    await save("v2");
    await save("v3");
    const views = await listVersionsUseCase(deps, alice, node.id);
    expect(views).toHaveLength(2);
    expect(views[0]?.current).toBe(true);
  });

  it("removes versions older than the retention period", async () => {
    const { deps, alice, clock, save } = await setup();
    await updateDriveUseCase(
      deps,
      { id: "root", role: "admin" },
      { driveId: alice.id, settings: { retentionDays: 7 } },
    );
    const { node } = await save("alt");
    clock.advance(10 * 24 * 60 * 60 * 1000);
    await save("neu");
    expect(await listVersionsUseCase(deps, alice, node.id)).toHaveLength(1);
  });

  it("never removes the current version, even with a cap of one", async () => {
    const { deps, alice, save } = await setup();
    await updateDriveUseCase(
      deps,
      { id: "root", role: "admin" },
      { driveId: alice.id, settings: { maxVersions: 1 } },
    );
    const { node } = await save("a");
    await save("b");
    const views = await listVersionsUseCase(deps, alice, node.id);
    expect(views.map((v) => v.current)).toEqual([true]);
  });
});

describe("access", () => {
  it("lets viewers read the history but not restore, and hides it from strangers", async () => {
    const { world, deps, alice, save } = await setup();
    const admin = await world.user("root", "admin");
    const bob = await world.user("bob");
    const carol = await world.user("carol");
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
      content: bytes("a"),
    });
    await uploadFileUseCase(deps, alice, {
      driveId: team.id,
      parentId: null,
      name: "a.txt",
      content: bytes("b"),
    });
    const [, old] = await listVersionsUseCase(deps, bob, node.id);
    expect(old).toBeDefined();
    await expect(
      restoreVersionUseCase(deps, bob, { nodeId: node.id, versionId: old?.version.id ?? "" }),
    ).rejects.toThrow(ForbiddenError);
    await expect(listVersionsUseCase(deps, carol, node.id)).rejects.toThrow(NotFoundError);
    void save;
  });

  it("checks the quota when an older, larger version is restored", async () => {
    const { deps, alice, save } = await setup();
    const { node } = await save("sehr langer alter text");
    await save("kurz");
    const [, old] = await listVersionsUseCase(deps, alice, node.id);
    await updateDriveUseCase(
      deps,
      { id: "root", role: "admin" },
      { driveId: alice.id, quotaBytes: 10 },
    );
    await expect(
      restoreVersionUseCase(deps, alice, { nodeId: node.id, versionId: old?.version.id ?? "" }),
    ).rejects.toThrow(QuotaExceededError);
  });
});

describe("garbage collection", () => {
  it("deletes blocks of pruned versions and keeps referenced and fresh blocks", async () => {
    const { deps, alice, clock, save } = await setup();
    await updateDriveUseCase(
      deps,
      { id: "root", role: "admin" },
      { driveId: alice.id, settings: { maxVersions: 1 } },
    );
    await save("aaaa");
    clock.advance(1000);
    await save("bbbb");
    const store = deps.blocks as InMemoryBlockStore;
    expect(store.blocks.size).toBe(2);

    const fresh = await collectGarbageUseCase(deps, 60 * 60 * 1000);
    expect(fresh).toEqual({ removed: 0, kept: 2 });

    clock.advance(2 * 60 * 60 * 1000);
    const result = await collectGarbageUseCase(deps, 60 * 60 * 1000);
    expect(result).toEqual({ removed: 1, kept: 1 });
    expect(store.blocks.size).toBe(1);
  });

  it("keeps blocks that are shared by several files", async () => {
    const { deps, alice, clock, save } = await setup();
    await save("same");
    await uploadFileUseCase(deps, alice, {
      parentId: null,
      name: "copy.txt",
      content: bytes("same"),
    });
    clock.advance(2 * 60 * 60 * 1000);
    expect((await collectGarbageUseCase(deps, 1000)).removed).toBe(0);
  });
});

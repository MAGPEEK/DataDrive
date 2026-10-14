import { ForbiddenError, NotFoundError, QuotaExceededError } from "@datadrive/domain";
import { describe, expect, it } from "vitest";
import { downloadFileUseCase, uploadFileUseCase } from "./files.js";
import { createFolderUseCase, listChildrenUseCase, trashNodeUseCase } from "./folders.js";
import {
  createGroupUseCase,
  createTeamFolderUseCase,
  listDrivesUseCase,
  removeMemberUseCase,
  setGroupMemberUseCase,
  setMemberUseCase,
  updateDriveUseCase,
} from "./teams.js";
import { createWorld } from "./testing/world.js";

async function* bytes(text: string): AsyncGenerator<Uint8Array> {
  yield new TextEncoder().encode(text);
}

async function setup() {
  const world = createWorld();
  const admin = await world.user("root", "admin");
  const alice = await world.user("alice");
  const bob = await world.user("bob");
  const carol = await world.user("carol");
  const team = await createTeamFolderUseCase(world.deps, admin, "Marketing");
  const member = (actor: { id: string }, role: "viewer" | "editor" | "manager") =>
    setMemberUseCase(world.deps, admin, {
      driveId: team.id,
      subjectType: "user",
      subjectId: actor.id,
      role,
    });
  return { world, deps: world.deps, admin, alice, bob, carol, team, member };
}

describe("team folders", () => {
  it("can only be created by admins", async () => {
    const { deps, alice } = await setup();
    await expect(createTeamFolderUseCase(deps, alice, "Secret")).rejects.toThrow(ForbiddenError);
  });

  it("are invisible to non-members and show up for members with their role", async () => {
    const { deps, alice, bob, team, member } = await setup();
    await member(alice, "viewer");
    await expect(
      listChildrenUseCase(deps, bob, { driveId: team.id, parentId: null }),
    ).rejects.toThrow(NotFoundError);
    const drives = await listDrivesUseCase(deps, alice);
    expect(drives.map((d) => [d.drive.name, d.role])).toEqual([
      ["alice", "manager"],
      ["Marketing", "viewer"],
    ]);
  });

  it("enforce the role: viewers read, editors write, nobody else enters", async () => {
    const { deps, alice, bob, member, team } = await setup();
    await member(alice, "editor");
    await member(bob, "viewer");
    const file = await uploadFileUseCase(deps, alice, {
      driveId: team.id,
      parentId: null,
      name: "plan.txt",
      content: bytes("plan"),
    });
    expect(await listChildrenUseCase(deps, bob, { driveId: team.id, parentId: null })).toHaveLength(
      1,
    );
    expect((await downloadFileUseCase(deps, bob, file.node.id)).node.name).toBe("plan.txt");
    await expect(
      createFolderUseCase(deps, bob, { driveId: team.id, parentId: null, name: "X" }),
    ).rejects.toThrow(ForbiddenError);
    await expect(trashNodeUseCase(deps, bob, file.node.id)).rejects.toThrow(ForbiddenError);
    await trashNodeUseCase(deps, alice, file.node.id);
  });

  it("admins manage members but do not read content without membership", async () => {
    const { deps, admin, team } = await setup();
    await expect(
      listChildrenUseCase(deps, admin, { driveId: team.id, parentId: null }),
    ).rejects.toThrow(NotFoundError);
  });

  it("let managers maintain members, others not", async () => {
    const { deps, alice, bob, carol, team, member } = await setup();
    await member(alice, "manager");
    await member(bob, "editor");
    const add = (actor: { id: string; role: "user" }) =>
      setMemberUseCase(deps, actor, {
        driveId: team.id,
        subjectType: "user",
        subjectId: carol.id,
        role: "viewer",
      });
    await expect(add(bob)).rejects.toThrow(ForbiddenError);
    await add(alice);
    await removeMemberUseCase(deps, alice, {
      driveId: team.id,
      subjectType: "user",
      subjectId: carol.id,
    });
    await expect(
      listChildrenUseCase(deps, carol, { driveId: team.id, parentId: null }),
    ).rejects.toThrow(NotFoundError);
  });

  it("grant access through groups and use the strongest role", async () => {
    const { world, deps, admin, alice, team, member } = await setup();
    const group = await createGroupUseCase(deps, admin, "Redaktion");
    await setGroupMemberUseCase(deps, admin, {
      groupId: group.id,
      userId: alice.id,
      present: true,
    });
    await setMemberUseCase(deps, admin, {
      driveId: team.id,
      subjectType: "group",
      subjectId: group.id,
      role: "editor",
    });
    await member(alice, "viewer");
    await createFolderUseCase(deps, alice, {
      driveId: team.id,
      parentId: null,
      name: "Von Gruppe",
    });
    await setGroupMemberUseCase(deps, admin, {
      groupId: group.id,
      userId: alice.id,
      present: false,
    });
    await expect(
      createFolderUseCase(deps, alice, { driveId: team.id, parentId: null, name: "Nicht mehr" }),
    ).rejects.toThrow(ForbiddenError);
    expect(world.deps).toBe(deps);
  });
});

describe("quotas", () => {
  it("reject uploads beyond the limit and count replacements correctly", async () => {
    const { deps, admin, alice, team, member } = await setup();
    await member(alice, "editor");
    await updateDriveUseCase(deps, admin, { driveId: team.id, quotaBytes: 10 });
    const put = (name: string, text: string) =>
      uploadFileUseCase(deps, alice, {
        driveId: team.id,
        parentId: null,
        name,
        content: bytes(text),
      });
    await put("a.txt", "123456");
    await expect(put("b.txt", "12345")).rejects.toThrow(QuotaExceededError);
    await put("a.txt", "1234567890");
    await expect(put("a.txt", "12345678901")).rejects.toThrow(QuotaExceededError);
    const usage = (await listDrivesUseCase(deps, alice)).find((d) => d.drive.id === team.id);
    expect(usage?.usedBytes).toBe(10);
  });

  it("apply to personal drives and can be removed", async () => {
    const { deps, admin, alice } = await setup();
    await updateDriveUseCase(deps, admin, { driveId: alice.id, quotaBytes: 3 });
    const put = (text: string) =>
      uploadFileUseCase(deps, alice, { parentId: null, name: "f.txt", content: bytes(text) });
    await expect(put("1234")).rejects.toThrow(QuotaExceededError);
    await updateDriveUseCase(deps, admin, { driveId: alice.id, quotaBytes: null });
    expect((await put("1234")).node.size).toBe(4);
  });

  it("store drive settings", async () => {
    const { deps, admin, team } = await setup();
    const updated = await updateDriveUseCase(deps, admin, {
      driveId: team.id,
      settings: { restrictDownloads: true, maxVersions: 10 },
    });
    expect(updated.settings).toEqual({
      restrictDownloads: true,
      watermark: false,
      fileLocking: false,
      maxVersions: 10,
    });
  });
});

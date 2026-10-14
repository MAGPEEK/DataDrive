import {
  DEFAULT_DRIVE_SETTINGS,
  createPersonalDrive,
  type Drive,
  type DriveNode,
  type FileVersion,
  type User,
} from "@datadrive/domain";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "./database.js";
import { PgStarRepository } from "./star-repository.js";
import {
  PgDriveRepository,
  PgGroupRepository,
  PgMembershipRepository,
} from "./team-repositories.js";
import {
  PgFileVersionRepository,
  PgNodeRepository,
  PgSessionRepository,
  PgUserRepository,
} from "./repositories.js";

const url = process.env.TEST_DATABASE_URL;
const schema = `t_${randomUUID().replaceAll("-", "")}`;
const now = new Date("2026-10-14T12:00:00Z");

const user = (id: string, username: string): User => ({
  id,
  username,
  passwordHash: "hash",
  role: "user",
  totpSecret: null,
  totpEnabled: false,
  disabled: false,
  createdAt: now,
});

const folder = (id: string, name: string, parentId: string | null = null): DriveNode => ({
  id,
  driveId: "u1",
  parentId,
  name,
  kind: "folder",
  size: 0,
  createdAt: now,
  modifiedAt: now,
  trashedAt: null,
  versionId: null,
});

describe.skipIf(url === undefined)("postgres adapters", () => {
  let pool: pg.Pool;

  beforeAll(async () => {
    const admin = createPool({ connectionString: url as string });
    await admin.query(`CREATE SCHEMA ${schema}`);
    await admin.end();
    pool = createPool({ connectionString: url as string, schema });
    await migrate(pool);
    await new PgUserRepository(pool).save(user("u1", "alice"));
    await new PgDriveRepository(pool).save(createPersonalDrive("u1", "alice", now));
  });

  afterAll(async () => {
    await pool.query(`DROP SCHEMA ${schema} CASCADE`);
    await pool.end();
  });

  it("applies migrations once", async () => {
    expect(await migrate(pool)).toEqual([]);
  });

  it("stores and updates users", async () => {
    const users = new PgUserRepository(pool);
    expect((await users.findByUsername("alice"))?.id).toBe("u1");
    await users.save({ ...user("u1", "alice"), totpEnabled: true, totpSecret: "S" });
    expect(await users.findById("u1")).toMatchObject({ totpEnabled: true, totpSecret: "S" });
    expect(await users.findById("missing")).toBeNull();
    expect(await users.count()).toBe(1);
  });

  it("stores sessions and cascades on user deletion", async () => {
    const sessions = new PgSessionRepository(pool);
    await sessions.save({ tokenHash: "h1", userId: "u1", createdAt: now, expiresAt: now });
    expect(await sessions.findByTokenHash("h1")).toMatchObject({ userId: "u1" });
    await sessions.deleteAllForUser("u1");
    expect(await sessions.findByTokenHash("h1")).toBeNull();
  });

  it("lists children per parent in name order and supports trashing", async () => {
    const nodes = new PgNodeRepository(pool);
    await nodes.save(folder("a", "beta"));
    await nodes.save(folder("b", "Alpha"));
    await nodes.save(folder("c", "inner", "a"));
    expect((await nodes.listChildren("u1", null)).map((n) => n.name)).toEqual(["Alpha", "beta"]);
    expect((await nodes.listChildren("u1", "a")).map((n) => n.name)).toEqual(["inner"]);
    await nodes.save({ ...folder("b", "Alpha"), trashedAt: now });
    expect((await nodes.findById("b"))?.trashedAt).toEqual(now);
  });

  it("enforces unique live names even if the domain check is bypassed", async () => {
    const nodes = new PgNodeRepository(pool);
    await expect(nodes.save(folder("d", "BETA"))).rejects.toThrow(/nodes_live_name_idx/u);
  });

  it("stores files with versions and block lists", async () => {
    const nodes = new PgNodeRepository(pool);
    const versions = new PgFileVersionRepository(pool);
    const file: DriveNode = { ...folder("f1", "report.pdf"), kind: "file" };
    await nodes.save(file);
    const version: FileVersion = {
      id: "v1",
      nodeId: "f1",
      size: 9_000_000_000,
      blockHashes: ["h1", "h2"],
      contentHash: "c1",
      createdAt: now,
      authorId: "u1",
    };
    await versions.save(version);
    await nodes.save({ ...file, size: version.size, versionId: "v1", modifiedAt: now });
    expect(await versions.findById("v1")).toEqual(version);
    expect(await nodes.findById("f1")).toMatchObject({ size: 9_000_000_000, versionId: "v1" });
    expect(await versions.findById("nope")).toBeNull();
  });

  it("sums used bytes per drive", async () => {
    const nodes = new PgNodeRepository(pool);
    expect(await nodes.usedBytes("u1")).toBe(9_000_000_000);
    expect(await nodes.usedBytes("empty-drive")).toBe(0);
  });

  it("stores drives with quota and settings", async () => {
    const drives = new PgDriveRepository(pool);
    const team: Drive = {
      id: "t1",
      kind: "team",
      name: "Marketing",
      quotaBytes: 5_000_000_000,
      settings: { ...DEFAULT_DRIVE_SETTINGS, watermark: true, maxVersions: 10 },
      createdAt: now,
    };
    await drives.save(team);
    expect(await drives.findById("t1")).toEqual(team);
    await drives.save({ ...team, quotaBytes: null });
    expect((await drives.findById("t1"))?.quotaBytes).toBeNull();
    expect((await drives.listTeamDrives()).map((d) => d.id)).toEqual(["t1"]);
    expect((await drives.findById("u1"))?.kind).toBe("personal");
  });

  it("resolves roles directly and through groups", async () => {
    const members = new PgMembershipRepository(pool);
    const groups = new PgGroupRepository(pool);
    await new PgUserRepository(pool).save(user("u2", "bob"));
    await groups.save({ id: "g1", name: "Redaktion", createdAt: now });
    await groups.addMember("g1", "u2");
    await members.set("t1", { subjectType: "group", subjectId: "g1", role: "editor" });
    await members.set("t1", { subjectType: "user", subjectId: "u2", role: "viewer" });
    expect((await members.rolesFor("u2", "t1")).sort()).toEqual(["editor", "viewer"]);
    expect(await members.rolesFor("u1", "t1")).toEqual([]);
    expect(await members.teamRolesForUser("u2")).toHaveLength(2);
    expect(await members.list("t1")).toHaveLength(2);

    await members.set("t1", { subjectType: "user", subjectId: "u2", role: "manager" });
    await members.remove("t1", "group", "g1");
    expect(await members.rolesFor("u2", "t1")).toEqual(["manager"]);
    await groups.removeMember("g1", "u2");
    expect(await groups.listMembers("g1")).toEqual([]);
    expect((await groups.findByName("Redaktion"))?.id).toBe("g1");
  });

  it("searches names case-insensitively and treats wildcards literally", async () => {
    const nodes = new PgNodeRepository(pool);
    await nodes.save(folder("s1", "Urlaub_2026"));
    await nodes.save(folder("s2", "urlaub 100%"));
    await nodes.save(folder("s3", "Anderes"));
    const names = async (term: string) =>
      (await nodes.search(["u1"], term, 10)).map((n) => n.name).sort();
    expect(await names("URLAUB")).toEqual(["Urlaub_2026", "urlaub 100%"]);
    expect(await names("_2026")).toEqual(["Urlaub_2026"]);
    expect(await names("100%")).toEqual(["urlaub 100%"]);
    expect(await names("%")).toEqual(["urlaub 100%"]);
    expect(await names("zzz")).toEqual([]);
  });

  it("lists recent files newest first and loads nodes by id", async () => {
    const nodes = new PgNodeRepository(pool);
    const older = {
      ...folder("r1", "old.txt"),
      kind: "file" as const,
      modifiedAt: new Date("2030-01-01T00:00:00Z"),
    };
    const newer = {
      ...folder("r2", "new.txt"),
      kind: "file" as const,
      modifiedAt: new Date("2030-01-02T00:00:00Z"),
    };
    await nodes.save(older);
    await nodes.save(newer);
    const recent = await nodes.recentFiles(["u1"], 2);
    expect(recent.map((n) => n.name)).toEqual(["new.txt", "old.txt"]);
    expect((await nodes.findByIds(["r1", "nope"])).map((n) => n.id)).toEqual(["r1"]);
    expect(await nodes.findByIds([])).toEqual([]);
  });

  it("keeps stars per user and removes them again", async () => {
    const stars = new PgStarRepository(pool);
    await stars.set("u1", "r1", true);
    await stars.set("u1", "r1", true);
    await stars.set("u2", "r2", true);
    expect(await stars.listStarredIds("u1")).toEqual(["r1"]);
    expect([...(await stars.starredAmong("u1", ["r1", "r2"]))]).toEqual(["r1"]);
    expect((await stars.starredAmong("u1", [])).size).toBe(0);
    await stars.set("u1", "r1", false);
    expect(await stars.listStarredIds("u1")).toEqual([]);
  });
});

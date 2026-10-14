import type { DriveNode, User } from "@datadrive/domain";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "./database.js";
import { PgNodeRepository, PgSessionRepository, PgUserRepository } from "./repositories.js";

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
  ownerId: "u1",
  parentId,
  name,
  kind: "folder",
  createdAt: now,
  trashedAt: null,
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
});

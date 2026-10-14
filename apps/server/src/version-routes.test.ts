import { beforeEach, describe, expect, it } from "vitest";
import { createTestContext, type TestContext } from "./test-support.js";

let ctx: TestContext;

beforeEach(async () => {
  ctx = await createTestContext();
});

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const call = async (user: string, method: Method, url: string, payload?: object) =>
  ctx.app.inject({ method, url, headers: await ctx.as(user), payload });

const put = async (user: string, text: string, query = "") =>
  ctx.app.inject({
    method: "PUT",
    url: `/api/v1/files?name=doc.txt${query}`,
    headers: { ...(await ctx.as(user)), "content-type": "application/octet-stream" },
    payload: text,
  });

interface VersionDto {
  id: string;
  size: number;
  current: boolean;
  authorName: string;
}

const versionsOf = async (user: string, id: string) =>
  (await call(user, "GET", `/api/v1/files/${id}/versions`)).json<VersionDto[]>();

describe("version api", () => {
  it("lists versions, downloads an old one and restores it", async () => {
    const { id } = (await put("alice", "erste fassung")).json<{ id: string }>();
    await put("alice", "zweite");
    const versions = await versionsOf("alice", id);
    expect(versions).toHaveLength(2);
    expect(versions[0]).toMatchObject({ current: true, authorName: "alice", size: 6 });
    const old = versions[1] as VersionDto;

    const download = await call("alice", "GET", `/api/v1/files/${id}/versions/${old.id}/content`);
    expect(download.body).toBe("erste fassung");
    expect(download.headers["content-disposition"]).toContain("doc.txt");

    const restored = await call("alice", "POST", `/api/v1/files/${id}/versions/${old.id}/restore`);
    expect(restored.json()).toMatchObject({ id, size: 13 });
    expect((await call("alice", "GET", `/api/v1/files/${id}/content`)).body).toBe("erste fassung");
    expect(await versionsOf("alice", id)).toHaveLength(3);
  });

  it("applies the retention settings of the drive", async () => {
    await ctx.as("root", "admin");
    const aliceId = await ctx.idOf("alice");
    const patch = await call("root", "PATCH", `/api/v1/drives/${aliceId}`, {
      settings: { maxVersions: 2, versionPolicy: "fifo", retentionDays: 30 },
    });
    expect(patch.json()).toMatchObject({
      settings: { maxVersions: 2, versionPolicy: "fifo", retentionDays: 30 },
    });
    const { id } = (await put("alice", "1")).json<{ id: string }>();
    await put("alice", "2");
    await put("alice", "3");
    expect(await versionsOf("alice", id)).toHaveLength(2);
  });

  it("validates the retention settings", async () => {
    await ctx.as("root", "admin");
    const aliceId = await ctx.idOf("alice");
    for (const settings of [
      { maxVersions: 33 },
      { versionPolicy: "random" },
      { retentionDays: 0 },
    ]) {
      expect(
        (await call("root", "PATCH", `/api/v1/drives/${aliceId}`, { settings })).statusCode,
      ).toBe(400);
    }
  });

  it("protects the history from strangers and rejects unknown versions", async () => {
    const { id } = (await put("alice", "geheim")).json<{ id: string }>();
    const [current] = await versionsOf("alice", id);
    expect((await call("bob", "GET", `/api/v1/files/${id}/versions`)).statusCode).toBe(404);
    expect(
      (await call("bob", "POST", `/api/v1/files/${id}/versions/${current?.id}/restore`)).statusCode,
    ).toBe(404);
    expect(
      (await call("alice", "GET", `/api/v1/files/${id}/versions/nope/content`)).statusCode,
    ).toBe(404);
    expect((await call("alice", "GET", "/api/v1/files/nope/versions")).statusCode).toBe(404);
  });

  it("lets viewers read the history but not restore", async () => {
    await ctx.as("root", "admin");
    const team = (await call("root", "POST", "/api/v1/team-folders", { name: "T" })).json<{
      id: string;
    }>();
    for (const [user, role] of [
      ["alice", "editor"],
      ["bob", "viewer"],
    ] as const) {
      await call("root", "PUT", `/api/v1/drives/${team.id}/members`, {
        subjectType: "user",
        subjectId: await ctx.idOf(user),
        role,
      });
    }
    const { id } = (await put("alice", "a", `&driveId=${team.id}`)).json<{ id: string }>();
    await put("alice", "bb", `&driveId=${team.id}`);
    const versions = await versionsOf("bob", id);
    expect(versions).toHaveLength(2);
    const restore = await call(
      "bob",
      "POST",
      `/api/v1/files/${id}/versions/${versions[1]?.id}/restore`,
    );
    expect(restore.statusCode).toBe(403);
  });
});

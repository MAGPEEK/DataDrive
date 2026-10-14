import { beforeEach, describe, expect, it } from "vitest";
import { createTestContext, type TestContext } from "./test-support.js";

let ctx: TestContext;

beforeEach(async () => {
  ctx = await createTestContext();
});

const call = async (
  user: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  payload?: object,
) => ctx.app.inject({ method, url, headers: await ctx.as(user), payload });

async function createTeam(name = "Marketing"): Promise<string> {
  const response = await call("root", "POST", "/api/v1/team-folders", { name });
  expect(response.statusCode).toBe(201);
  return response.json<{ id: string }>().id;
}

const addMember = async (team: string, user: string, role: string) =>
  call("root", "PUT", `/api/v1/drives/${team}/members`, {
    subjectType: "user",
    subjectId: await ctx.idOf(user),
    role,
  });

beforeEach(async () => {
  await ctx.as("root", "admin");
});

describe("team folder api", () => {
  it("lets only admins create team folders", async () => {
    expect((await call("alice", "POST", "/api/v1/team-folders", { name: "X" })).statusCode).toBe(
      403,
    );
    expect((await call("alice", "GET", "/api/v1/team-folders")).statusCode).toBe(403);
    await createTeam();
    expect((await call("root", "GET", "/api/v1/team-folders")).json()).toHaveLength(1);
  });

  it("shares files through roles and hides the folder from outsiders", async () => {
    const team = await createTeam();
    expect((await addMember(team, "alice", "editor")).statusCode).toBe(204);
    await addMember(team, "bob", "viewer");

    const upload = await ctx.app.inject({
      method: "PUT",
      url: `/api/v1/files?driveId=${team}&name=plan.txt`,
      headers: { ...(await ctx.as("alice")), "content-type": "application/octet-stream" },
      payload: "team plan",
    });
    expect(upload.statusCode).toBe(201);
    const { id } = upload.json<{ id: string }>();

    const bobList = await call("bob", "GET", `/api/v1/nodes?driveId=${team}`);
    expect(bobList.json()).toMatchObject([{ name: "plan.txt", driveId: team }]);
    expect((await call("bob", "GET", `/api/v1/files/${id}/content`)).body).toBe("team plan");
    expect(
      (await call("bob", "POST", "/api/v1/folders", { driveId: team, name: "Nope" })).statusCode,
    ).toBe(403);
    expect((await call("carol", "GET", `/api/v1/nodes?driveId=${team}`)).statusCode).toBe(404);
    expect((await call("carol", "GET", `/api/v1/files/${id}/content`)).statusCode).toBe(404);
  });

  it("lists my drives with role and usage", async () => {
    const team = await createTeam();
    await addMember(team, "alice", "viewer");
    const drives = (await call("alice", "GET", "/api/v1/drives")).json<
      { name: string; role: string; usedBytes: number }[]
    >();
    expect(drives.map((d) => [d.name, d.role])).toEqual([
      ["alice", "manager"],
      ["Marketing", "viewer"],
    ]);
  });

  it("enforces quotas with 413 and shows usage", async () => {
    const team = await createTeam();
    await addMember(team, "alice", "editor");
    expect(
      (await call("root", "PATCH", `/api/v1/drives/${team}`, { quotaBytes: 5 })).statusCode,
    ).toBe(200);
    const put = async (text: string) =>
      ctx.app.inject({
        method: "PUT",
        url: `/api/v1/files?driveId=${team}&name=f.txt`,
        headers: { ...(await ctx.as("alice")), "content-type": "application/octet-stream" },
        payload: text,
      });
    expect((await put("12345")).statusCode).toBe(201);
    const over = await put("123456");
    expect(over.statusCode).toBe(413);
    expect(over.json()).toMatchObject({ error: "quota_exceeded" });
  });

  it("manages groups and group based access", async () => {
    const team = await createTeam();
    const group = (await call("root", "POST", "/api/v1/groups", { name: "Redaktion" })).json<{
      id: string;
    }>();
    const alice = await ctx.idOf("alice");
    expect((await call("alice", "POST", "/api/v1/groups", { name: "X" })).statusCode).toBe(403);
    expect((await call("alice", "GET", "/api/v1/groups")).statusCode).toBe(403);
    await call("root", "PUT", `/api/v1/groups/${group.id}/members/${alice}`);
    await call("root", "PUT", `/api/v1/drives/${team}/members`, {
      subjectType: "group",
      subjectId: group.id,
      role: "viewer",
    });
    expect((await call("alice", "GET", `/api/v1/nodes?driveId=${team}`)).statusCode).toBe(200);
    await call("root", "DELETE", `/api/v1/groups/${group.id}/members/${alice}`);
    expect((await call("alice", "GET", `/api/v1/nodes?driveId=${team}`)).statusCode).toBe(404);
  });

  it("lets managers maintain members and validates input", async () => {
    const team = await createTeam();
    await addMember(team, "alice", "manager");
    const carol = await ctx.idOf("carol");
    const add = await call("alice", "PUT", `/api/v1/drives/${team}/members`, {
      subjectType: "user",
      subjectId: carol,
      role: "viewer",
    });
    expect(add.statusCode).toBe(204);
    expect((await call("alice", "GET", `/api/v1/drives/${team}/members`)).json()).toHaveLength(2);
    expect(
      (await call("alice", "DELETE", `/api/v1/drives/${team}/members/user/${carol}`)).statusCode,
    ).toBe(204);
    const bad = await call("alice", "PUT", `/api/v1/drives/${team}/members`, {
      subjectType: "user",
    });
    expect(bad.statusCode).toBe(400);
  });
});

describe("openapi", () => {
  it("documents the api without authentication", async () => {
    const response = await ctx.app.inject({ method: "GET", url: "/openapi.json" });
    const spec = response.json<{ openapi: string; paths: Record<string, unknown> }>();
    expect(response.statusCode).toBe(200);
    expect(spec.openapi).toMatch(/^3\./u);
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining([
        "/api/v1/folders",
        "/api/v1/files",
        "/api/v1/team-folders",
        "/api/v1/drives",
      ]),
    );
  });
});

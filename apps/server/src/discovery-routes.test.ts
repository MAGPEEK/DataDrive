import { beforeEach, describe, expect, it } from "vitest";
import { createTestContext, type TestContext } from "./test-support.js";

let ctx: TestContext;

beforeEach(async () => {
  ctx = await createTestContext();
});

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const call = async (user: string, method: Method, url: string, payload?: object) =>
  ctx.app.inject({ method, url, headers: await ctx.as(user), payload });

const folder = async (user: string, name: string, parentId?: string) =>
  (await call(user, "POST", "/api/v1/folders", { name, parentId })).json<{ id: string }>();

const upload = async (user: string, name: string, text: string, parentId?: string) =>
  ctx.app.inject({
    method: "PUT",
    url: `/api/v1/files?name=${encodeURIComponent(name)}${parentId ? `&parentId=${parentId}` : ""}`,
    headers: { ...(await ctx.as(user)), "content-type": "application/octet-stream" },
    payload: text,
  });

describe("node views", () => {
  it("carry the star and the capabilities of the caller", async () => {
    const a = await folder("alice", "A");
    const [before] = (await call("alice", "GET", "/api/v1/nodes")).json<
      { starred: boolean; capabilities: object }[]
    >();
    expect(before).toMatchObject({
      starred: false,
      capabilities: { canRead: true, canWrite: true, canShare: true, canDownload: true },
    });
    await call("alice", "PUT", `/api/v1/nodes/${a.id}/star`);
    const [after] = (await call("alice", "GET", "/api/v1/nodes")).json<{ starred: boolean }[]>();
    expect(after?.starred).toBe(true);
  });
});

describe("rename and move", () => {
  it("renames and moves nodes and maps conflicts", async () => {
    const a = await folder("alice", "A");
    const b = await folder("alice", "B");
    const renamed = await call("alice", "PATCH", `/api/v1/nodes/${a.id}`, { name: "Neu" });
    expect(renamed.json()).toMatchObject({ name: "Neu" });
    expect((await call("alice", "PATCH", `/api/v1/nodes/${a.id}`, { name: "b" })).statusCode).toBe(
      409,
    );
    expect(
      (await call("alice", "PATCH", `/api/v1/nodes/${a.id}`, { name: "x/y" })).statusCode,
    ).toBe(400);

    const moved = await call("alice", "POST", `/api/v1/nodes/${a.id}/move`, { parentId: b.id });
    expect(moved.json()).toMatchObject({ parentId: b.id });
    const into = await call("alice", "POST", `/api/v1/nodes/${b.id}/move`, { parentId: a.id });
    expect(into.statusCode).toBe(400);
    expect(into.json()).toMatchObject({ error: "invalid_move" });
    const home = await call("alice", "POST", `/api/v1/nodes/${a.id}/move`, { parentId: null });
    expect(home.json()).toMatchObject({ parentId: null });
    expect((await call("bob", "PATCH", `/api/v1/nodes/${a.id}`, { name: "X" })).statusCode).toBe(
      404,
    );
  });
});

describe("discovery", () => {
  it("lists starred items and removes the star again", async () => {
    const a = await folder("alice", "A");
    await call("alice", "PUT", `/api/v1/nodes/${a.id}/star`);
    expect((await call("alice", "GET", "/api/v1/starred")).json()).toMatchObject([
      { name: "A", starred: true },
    ]);
    await call("alice", "DELETE", `/api/v1/nodes/${a.id}/star`);
    expect((await call("alice", "GET", "/api/v1/starred")).json()).toEqual([]);
    expect((await call("bob", "PUT", `/api/v1/nodes/${a.id}/star`)).statusCode).toBe(404);
  });

  it("searches by name and validates the query", async () => {
    await folder("alice", "Urlaub 2026");
    const found = await call("alice", "GET", "/api/v1/search?q=urlaub");
    expect(found.json()).toMatchObject([{ name: "Urlaub 2026" }]);
    expect((await call("bob", "GET", "/api/v1/search?q=urlaub")).json()).toEqual([]);
    expect((await call("alice", "GET", "/api/v1/search")).statusCode).toBe(400);
  });

  it("lists recent files and the folder path of an item", async () => {
    const a = await folder("alice", "A");
    const inner = await folder("alice", "B", a.id);
    const file = (await upload("alice", "f.txt", "x", inner.id)).json<{ id: string }>();
    expect((await call("alice", "GET", "/api/v1/recent")).json()).toMatchObject([
      { name: "f.txt" },
    ]);
    const path = await call("alice", "GET", `/api/v1/nodes/${file.id}/path`);
    expect(path.json()).toMatchObject([{ name: "A" }, { name: "B" }]);
    expect((await call("bob", "GET", `/api/v1/nodes/${file.id}/path`)).statusCode).toBe(404);
  });
});

describe("restricted downloads", () => {
  it("answer 403 for viewers and report canDownload false", async () => {
    await ctx.as("root", "admin");
    const team = (await call("root", "POST", "/api/v1/team-folders", { name: "T" })).json<{
      id: string;
    }>();
    const put = (user: string, role: string) =>
      call("root", "PUT", `/api/v1/drives/${team.id}/members`, {
        subjectType: "user",
        subjectId: "",
        role,
        user,
      }).catch(() => undefined);
    void put;
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
    const created = await ctx.app.inject({
      method: "PUT",
      url: `/api/v1/files?driveId=${team.id}&name=a.txt`,
      headers: { ...(await ctx.as("alice")), "content-type": "application/octet-stream" },
      payload: "secret",
    });
    const { id } = created.json<{ id: string }>();
    await call("root", "PATCH", `/api/v1/drives/${team.id}`, {
      settings: { restrictDownloads: true },
    });
    expect((await call("bob", "GET", `/api/v1/files/${id}/content`)).statusCode).toBe(403);
    expect((await call("alice", "GET", `/api/v1/files/${id}/content`)).statusCode).toBe(200);
    const list = (await call("bob", "GET", `/api/v1/nodes?driveId=${team.id}`)).json<
      { capabilities: { canDownload: boolean } }[]
    >();
    expect(list[0]?.capabilities.canDownload).toBe(false);
  });
});

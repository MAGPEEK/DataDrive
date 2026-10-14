import { beforeEach, describe, expect, it } from "vitest";
import { createTestContext, type TestContext } from "./test-support.js";

let ctx: TestContext;

beforeEach(async () => {
  ctx = await createTestContext();
});

const upload = async (user: string, name: string, body: string | Buffer, parentId?: string) =>
  ctx.app.inject({
    method: "PUT",
    url: `/api/v1/files?name=${encodeURIComponent(name)}${parentId ? `&parentId=${parentId}` : ""}`,
    headers: { ...(await ctx.as(user)), "content-type": "application/octet-stream" },
    payload: body,
  });

const download = async (user: string, id: string) =>
  ctx.app.inject({
    method: "GET",
    url: `/api/v1/files/${id}/content`,
    headers: await ctx.as(user),
  });

describe("file upload and download", () => {
  it("round-trips binary content with metadata headers", async () => {
    const bytes = Buffer.from([0, 1, 2, 255, 254, 253, 10, 13, 0, 7]);
    const created = await upload("alice", "daten.bin", bytes);
    expect(created.statusCode).toBe(201);
    const node = created.json<{ id: string; size: number }>();
    expect(node.size).toBe(bytes.length);

    const response = await download("alice", node.id);
    expect(response.statusCode).toBe(200);
    expect(response.rawPayload.equals(bytes)).toBe(true);
    expect(response.headers["content-length"]).toBe(String(bytes.length));
    expect(response.headers["content-disposition"]).toContain("filename*=UTF-8''daten.bin");
    expect(response.headers["etag"]).toMatch(/^"[0-9a-f]{64}"$/u);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("answers 200 and serves the new content when uploading the same name again", async () => {
    const first = (await upload("alice", "a.txt", "one")).json<{ id: string }>();
    const second = await upload("alice", "a.txt", "second version");
    expect(second.statusCode).toBe(200);
    expect(second.json<{ id: string }>().id).toBe(first.id);
    expect((await download("alice", first.id)).body).toBe("second version");
  });

  it("supports unicode names and nested folders", async () => {
    const folder = (
      await ctx.app.inject({
        method: "POST",
        url: "/api/v1/folders",
        headers: await ctx.as("alice"),
        payload: { name: "Ordner" },
      })
    ).json<{ id: string }>();
    const created = await upload("alice", "Übersicht 2026.txt", "inhalt", folder.id);
    expect(created.statusCode).toBe(201);
    const response = await download("alice", created.json<{ id: string }>().id);
    expect(response.headers["content-disposition"]).toContain(
      "filename*=UTF-8''%C3%9Cbersicht%202026.txt",
    );
  });

  it("protects files from other users and requires authentication", async () => {
    const { id } = (await upload("alice", "geheim.txt", "x")).json<{ id: string }>();
    expect((await download("bob", id)).statusCode).toBe(404);
    const anonymous = await ctx.app.inject({ method: "GET", url: `/api/v1/files/${id}/content` });
    expect(anonymous.statusCode).toBe(401);
  });

  it("validates names and missing query parameters", async () => {
    expect((await upload("alice", "a/b", "x")).statusCode).toBe(400);
    const missing = await ctx.app.inject({
      method: "PUT",
      url: "/api/v1/files",
      headers: { ...(await ctx.as("alice")), "content-type": "application/octet-stream" },
      payload: "x",
    });
    expect(missing.statusCode).toBe(400);
  });

  it("lists uploaded files with their size", async () => {
    await upload("alice", "a.txt", "12345");
    const list = await ctx.app.inject({
      method: "GET",
      url: "/api/v1/nodes",
      headers: await ctx.as("alice"),
    });
    expect(list.json()).toMatchObject([{ name: "a.txt", kind: "file", size: 5 }]);
  });
});

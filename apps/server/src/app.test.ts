import { testDependencies } from "@datadrive/application";
import type { FastifyInstance } from "fastify";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

let app: FastifyInstance;

beforeEach(() => {
  app = buildApp({
    deps: testDependencies(),
    authenticate: (request) => (request.headers["x-test-user"] as string | undefined) ?? null,
  });
});

const as = (user: string) => ({ "x-test-user": user });

const createFolder = (user: string, name: string) =>
  app.inject({ method: "POST", url: "/api/v1/folders", headers: as(user), payload: { name } });

const listNodes = async (user: string): Promise<unknown[]> =>
  (await app.inject({ method: "GET", url: "/api/v1/nodes", headers: as(user) })).json();

const action = (user: string, id: string, verb: "trash" | "restore") =>
  app.inject({ method: "POST", url: `/api/v1/nodes/${id}/${verb}`, headers: as(user) });

describe("health", () => {
  it("reports ok without authentication", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.json()).toEqual({ status: "ok" });
  });
});

describe("folder api", () => {
  it("rejects unauthenticated calls", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/nodes" });
    expect(response.statusCode).toBe(401);
  });

  it("creates, lists, trashes and restores a folder", async () => {
    const created = await createFolder("alice", "Fotos");
    expect(created.statusCode).toBe(201);
    const { id } = created.json<{ id: string }>();
    expect(await listNodes("alice")).toHaveLength(1);

    await action("alice", id, "trash");
    expect(await listNodes("alice")).toHaveLength(0);

    await action("alice", id, "restore");
    expect(await listNodes("alice")).toHaveLength(1);
  });

  it("maps domain errors to http status codes", async () => {
    await createFolder("alice", "A");
    expect((await createFolder("alice", "a")).statusCode).toBe(409);
    expect((await createFolder("alice", "a/b")).statusCode).toBe(400);
    expect((await action("alice", "nope", "trash")).statusCode).toBe(404);
  });

  it("does not leak other users data", async () => {
    const { id } = (await createFolder("alice", "Geheim")).json<{ id: string }>();
    expect(await listNodes("bob")).toEqual([]);
    expect((await action("bob", id, "trash")).statusCode).toBe(404);
  });

  it("rejects malformed bodies", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/folders",
      headers: as("alice"),
      payload: { nope: 1 },
    });
    expect(response.statusCode).toBe(400);
  });
});

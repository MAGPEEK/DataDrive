import { FixedCodeTotp } from "@datadrive/application";
import type { LightMyRequestResponse } from "fastify";
import { beforeEach, describe, expect, it } from "vitest";
import { PASSWORD, createTestContext, type TestContext } from "./test-support.js";

let ctx: TestContext;

beforeEach(async () => {
  ctx = await createTestContext();
  await ctx.as("alice");
});

const login = (payload: Record<string, string>): Promise<LightMyRequestResponse> =>
  ctx.app.inject({ method: "POST", url: "/auth/login", payload });

const cookieOf = (response: LightMyRequestResponse): string =>
  `dd_session=${response.cookies.find((c) => c.name === "dd_session")?.value ?? ""}`;

describe("login", () => {
  it("sets an httpOnly strict session cookie that authenticates /auth/me", async () => {
    const response = await login({ username: "alice", password: PASSWORD });
    expect(response.statusCode).toBe(200);
    const cookie = response.cookies.find((c) => c.name === "dd_session");
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Strict", path: "/" });

    const me = await ctx.app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { cookie: cookieOf(response) },
    });
    expect(me.json()).toMatchObject({ username: "alice", role: "user" });
    expect(JSON.stringify(me.json())).not.toContain("passwordHash");
  });

  it("answers 401 with a generic code for bad credentials", async () => {
    const wrong = await login({ username: "alice", password: "wrong-password-1" });
    const unknown = await login({ username: "nobody", password: PASSWORD });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.json()).toEqual(wrong.json());
  });

  it("throttles repeated attempts", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i += 1) {
      statuses.push((await login({ username: "alice", password: "wrong-password-1" })).statusCode);
    }
    expect(statuses.at(-1)).toBe(429);
  });

  it("logout ends the session", async () => {
    const response = await login({ username: "alice", password: PASSWORD });
    const headers = { cookie: cookieOf(response) };
    await ctx.app.inject({ method: "POST", url: "/auth/logout", headers });
    expect((await ctx.app.inject({ method: "GET", url: "/auth/me", headers })).statusCode).toBe(
      401,
    );
  });
});

describe("totp", () => {
  it("requires a code after setup and confirmation", async () => {
    const headers = await ctx.as("alice");
    const setup = await ctx.app.inject({ method: "POST", url: "/api/v1/me/totp/setup", headers });
    expect(setup.json()).toMatchObject({
      secret: expect.any(String),
      uri: expect.stringContaining("otpauth://"),
    });

    const confirm = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/me/totp/confirm",
      headers,
      payload: { code: FixedCodeTotp.CODE },
    });
    expect(confirm.statusCode).toBe(204);

    const without = await login({ username: "alice", password: PASSWORD });
    expect(without.json()).toMatchObject({ error: "otp_required" });
    const withCode = await login({
      username: "alice",
      password: PASSWORD,
      otp: FixedCodeTotp.CODE,
    });
    expect(withCode.statusCode).toBe(200);
  });
});

describe("user administration", () => {
  it("lets admins create users and forbids everyone else", async () => {
    const admin = await ctx.as("root", "admin");
    const created = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/users",
      headers: admin,
      payload: { username: "carol", password: PASSWORD },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ username: "carol", role: "user" });

    const forbidden = await ctx.app.inject({
      method: "POST",
      url: "/api/v1/users",
      headers: await ctx.as("alice"),
      payload: { username: "dave", password: PASSWORD },
    });
    expect(forbidden.statusCode).toBe(403);
  });
});

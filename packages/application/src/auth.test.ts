import {
  InvalidCredentialsError,
  InvalidUsernameError,
  OtpRequiredError,
  UsernameTakenError,
  WeakPasswordError,
} from "@datadrive/domain";
import { describe, expect, it } from "vitest";
import {
  SESSION_TTL_MS,
  authenticateUseCase,
  beginTotpSetupUseCase,
  confirmTotpUseCase,
  createUserUseCase,
  loginUseCase,
  logoutUseCase,
} from "./auth.js";
import { FixedClock, testDependencies } from "./testing/in-memory.js";
import { FixedCodeTotp, testAuthDependencies } from "./testing/auth-fakes.js";

const password = "correct horse battery";
const newAlice = (deps = testAuthDependencies()) =>
  createUserUseCase(deps, { username: "Alice", password, role: "user" }).then((user) => ({
    deps,
    user,
  }));

describe("createUserUseCase", () => {
  it("normalizes the username and stores a hash, not the password", async () => {
    const { user } = await newAlice();
    expect(user.username).toBe("alice");
    expect(user.passwordHash).not.toContain(password.slice(0, 5) + "x");
    expect(user.totpEnabled).toBe(false);
  });

  it("rejects duplicates, bad names and weak passwords", async () => {
    const { deps } = await newAlice();
    const create = (username: string, pw = password) =>
      createUserUseCase(deps, { username, password: pw, role: "user" });
    await expect(create("ALICE")).rejects.toThrow(UsernameTakenError);
    await expect(create("a")).rejects.toThrow(InvalidUsernameError);
    await expect(create("bob", "short")).rejects.toThrow(WeakPasswordError);
  });
});

describe("login", () => {
  it("returns a token that authenticates the user", async () => {
    const { deps, user } = await newAlice();
    const result = await loginUseCase(deps, { username: " ALICE ", password });
    expect((await authenticateUseCase(deps, result.token))?.id).toBe(user.id);
  });

  it("gives the same error for wrong passwords and unknown users", async () => {
    const { deps } = await newAlice();
    await expect(
      loginUseCase(deps, { username: "alice", password: "wrong-password" }),
    ).rejects.toThrow(InvalidCredentialsError);
    await expect(loginUseCase(deps, { username: "nobody", password })).rejects.toThrow(
      InvalidCredentialsError,
    );
  });

  it("rejects disabled users", async () => {
    const { deps, user } = await newAlice();
    await deps.users.save({ ...user, disabled: true });
    await expect(loginUseCase(deps, { username: "alice", password })).rejects.toThrow(
      InvalidCredentialsError,
    );
  });

  it("logout invalidates the token", async () => {
    const { deps } = await newAlice();
    const { token } = await loginUseCase(deps, { username: "alice", password });
    await logoutUseCase(deps, token);
    expect(await authenticateUseCase(deps, token)).toBeNull();
  });

  it("expires sessions after the ttl", async () => {
    const clock = new FixedClock(new Date("2026-10-14T12:00:00Z"));
    const { deps } = await newAlice(testAuthDependencies({ ...testDependencies(), clock }));
    const { token } = await loginUseCase(deps, { username: "alice", password });
    clock.advance(SESSION_TTL_MS + 1);
    expect(await authenticateUseCase(deps, token)).toBeNull();
  });

  it("rejects unknown tokens", async () => {
    const { deps } = await newAlice();
    expect(await authenticateUseCase(deps, "garbage")).toBeNull();
  });
});

describe("totp", () => {
  async function aliceWithTotp() {
    const { deps, user } = await newAlice();
    await beginTotpSetupUseCase(deps, user.id);
    await confirmTotpUseCase(deps, user.id, FixedCodeTotp.CODE);
    return deps;
  }

  it("is not active until confirmed", async () => {
    const { deps, user } = await newAlice();
    await beginTotpSetupUseCase(deps, user.id);
    await expect(loginUseCase(deps, { username: "alice", password })).resolves.toBeDefined();
  });

  it("requires a valid code once active", async () => {
    const deps = await aliceWithTotp();
    await expect(loginUseCase(deps, { username: "alice", password })).rejects.toThrow(
      OtpRequiredError,
    );
    await expect(
      loginUseCase(deps, { username: "alice", password, otp: "000000" }),
    ).rejects.toThrow(InvalidCredentialsError);
    await expect(
      loginUseCase(deps, { username: "alice", password, otp: FixedCodeTotp.CODE }),
    ).resolves.toBeDefined();
  });

  it("refuses to confirm with a wrong code and revokes sessions on activation", async () => {
    const { deps, user } = await newAlice();
    const { token } = await loginUseCase(deps, { username: "alice", password });
    await beginTotpSetupUseCase(deps, user.id);
    await expect(confirmTotpUseCase(deps, user.id, "000000")).rejects.toThrow(
      InvalidCredentialsError,
    );
    await confirmTotpUseCase(deps, user.id, FixedCodeTotp.CODE);
    expect(await authenticateUseCase(deps, token)).toBeNull();
  });
});

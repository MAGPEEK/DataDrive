import { NotFoundError, OwnAccountError, WeakPasswordError } from "@datadrive/domain";
import { describe, expect, it } from "vitest";
import { authenticateUseCase, createUserUseCase, loginUseCase } from "./auth.js";
import { testAuthDependencies } from "./testing/auth-fakes.js";
import { updateUserUseCase } from "./user-admin.js";

const password = "correct horse battery";

async function setup() {
  const deps = testAuthDependencies();
  const admin = await createUserUseCase(deps, { username: "root", password, role: "admin" });
  const alice = await createUserUseCase(deps, { username: "alice", password, role: "user" });
  return { deps, admin, alice };
}

describe("updateUserUseCase", () => {
  it("changes the role", async () => {
    const { deps, admin, alice } = await setup();
    const updated = await updateUserUseCase(deps, admin.id, { userId: alice.id, role: "admin" });
    expect(updated.role).toBe("admin");
    expect((await deps.users.findById(alice.id))?.role).toBe("admin");
  });

  it("disables a user and ends all of their sessions", async () => {
    const { deps, admin, alice } = await setup();
    const { token } = await loginUseCase(deps, { username: "alice", password });
    await updateUserUseCase(deps, admin.id, { userId: alice.id, disabled: true });
    expect(await authenticateUseCase(deps, token)).toBeNull();
    await expect(loginUseCase(deps, { username: "alice", password })).rejects.toThrow();
  });

  it("sets a new password and ends sessions", async () => {
    const { deps, admin, alice } = await setup();
    const { token } = await loginUseCase(deps, { username: "alice", password });
    await updateUserUseCase(deps, admin.id, { userId: alice.id, password: "another long secret" });
    expect(await authenticateUseCase(deps, token)).toBeNull();
    const again = await loginUseCase(deps, { username: "alice", password: "another long secret" });
    expect(again.user.username).toBe("alice");
  });

  it("rejects weak passwords and unknown users", async () => {
    const { deps, admin, alice } = await setup();
    await expect(
      updateUserUseCase(deps, admin.id, { userId: alice.id, password: "short" }),
    ).rejects.toThrow(WeakPasswordError);
    await expect(
      updateUserUseCase(deps, admin.id, { userId: "nope", disabled: true }),
    ).rejects.toThrow(NotFoundError);
  });

  it("does not let administrators lock themselves out", async () => {
    const { deps, admin } = await setup();
    for (const change of [{ disabled: true }, { role: "user" as const }]) {
      await expect(
        updateUserUseCase(deps, admin.id, { userId: admin.id, ...change }),
      ).rejects.toThrow(OwnAccountError);
    }
  });
});

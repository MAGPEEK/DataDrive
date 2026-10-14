import {
  createUserUseCase,
  loginUseCase,
  testAuthDependencies,
  testDependencies,
  type AuthDependencies,
  type Dependencies,
} from "@datadrive/application";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";

export const PASSWORD = "correct horse battery";

export interface TestContext {
  readonly app: FastifyInstance;
  readonly deps: Dependencies;
  readonly auth: AuthDependencies;
  /** Creates the user (if needed), logs in and returns request headers with a bearer token. */
  as(username: string, role?: "admin" | "user"): Promise<{ authorization: string }>;
  /** The id of an existing user (creates the user if needed). */
  idOf(username: string): Promise<string>;
}

export async function createTestContext(): Promise<TestContext> {
  const deps = testDependencies();
  const auth = testAuthDependencies(deps);
  const app = await buildApp({ deps, auth });
  const known = new Set<string>();
  const ensure = async (username: string, role: "admin" | "user"): Promise<void> => {
    if (known.has(username)) return;
    await createUserUseCase(auth, { username, password: PASSWORD, role });
    known.add(username);
  };
  return {
    app,
    deps,
    auth,
    async as(username, role = "user") {
      await ensure(username, role);
      const { token } = await loginUseCase(auth, { username, password: PASSWORD });
      return { authorization: `Bearer ${token}` };
    },
    async idOf(username) {
      await ensure(username, "user");
      return (await auth.users.findByUsername(username))?.id as string;
    },
  };
}

import {
  createUserUseCase,
  loginUseCase,
  testAuthDependencies,
  testDependencies,
  type AuthDependencies,
} from "@datadrive/application";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";

export const PASSWORD = "correct horse battery";

export interface TestContext {
  readonly app: FastifyInstance;
  readonly auth: AuthDependencies;
  /** Creates the user (if needed), logs in and returns request headers with a bearer token. */
  as(username: string, role?: "admin" | "user"): Promise<{ authorization: string }>;
}

export async function createTestContext(): Promise<TestContext> {
  const auth = testAuthDependencies();
  const app = await buildApp({ deps: testDependencies(), auth });
  const known = new Set<string>();
  return {
    app,
    auth,
    async as(username, role = "user") {
      if (!known.has(username)) {
        await createUserUseCase(auth, { username, password: PASSWORD, role });
        known.add(username);
      }
      const { token } = await loginUseCase(auth, { username, password: PASSWORD });
      return { authorization: `Bearer ${token}` };
    },
  };
}

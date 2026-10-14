import type { Role } from "@datadrive/domain";
import type { Actor } from "../access.js";
import type { AuthDependencies } from "../auth-ports.js";
import { createUserUseCase } from "../auth.js";
import type { Dependencies } from "../ports.js";
import { testAuthDependencies } from "./auth-fakes.js";
import { testDependencies } from "./in-memory.js";

export const TEST_PASSWORD = "correct horse battery";

export interface World {
  readonly deps: Dependencies;
  readonly auth: AuthDependencies;
  /** Creates a user (with personal drive) and returns the matching actor. */
  user(username: string, role?: Role): Promise<Actor>;
}

export function createWorld(blockSize = 4): World {
  const deps = testDependencies(blockSize);
  const auth = testAuthDependencies(deps);
  return {
    deps,
    auth,
    async user(username, role = "user") {
      const created = await createUserUseCase(auth, { username, password: TEST_PASSWORD, role });
      return { id: created.id, role };
    },
  };
}

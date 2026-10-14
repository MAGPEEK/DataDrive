import type { PasswordHasher } from "@datadrive/application";
import { hash, verify } from "@node-rs/argon2";

/** Argon2id with OWASP-recommended minimum parameters (19 MiB, 2 iterations, 1 lane). */
const OPTIONS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export class Argon2Hasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return hash(password, OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }
}

import {
  createUserUseCase,
  type AuthDependencies,
  type Dependencies,
} from "@datadrive/application";
import { randomUUID } from "node:crypto";
import { Argon2Hasher } from "./adapters/argon2-hasher.js";
import { createPool, migrate } from "./adapters/postgres/database.js";
import {
  PgNodeRepository,
  PgSessionRepository,
  PgUserRepository,
} from "./adapters/postgres/repositories.js";
import { RandomTokenCodec } from "./adapters/token-codec.js";
import { Rfc6238Totp } from "./adapters/totp.js";
import { buildApp } from "./app.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") throw new Error(`Missing environment variable ${name}`);
  return value;
}

async function bootstrapAdmin(auth: AuthDependencies): Promise<void> {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (username === undefined || password === undefined) return;
  if ((await auth.users.count()) > 0) return;
  await createUserUseCase(auth, { username, password, role: "admin" });
  console.log(`Created initial admin "${username}"`);
}

async function main(): Promise<void> {
  const pool = createPool({ connectionString: requireEnv("DATABASE_URL") });
  await migrate(pool);

  const clock = { now: () => new Date() };
  const ids = { next: () => randomUUID() };
  const deps: Dependencies = { nodes: new PgNodeRepository(pool), clock, ids };
  const auth: AuthDependencies = {
    users: new PgUserRepository(pool),
    sessions: new PgSessionRepository(pool),
    hasher: new Argon2Hasher(),
    tokens: new RandomTokenCodec(),
    totp: new Rfc6238Totp(),
    clock,
    ids,
  };
  await bootstrapAdmin(auth);

  const app = await buildApp({ deps, auth, secureCookies: process.env.COOKIE_SECURE === "true" });
  await app.listen({ port: Number(process.env.SERVER_PORT ?? 3000), host: "0.0.0.0" });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

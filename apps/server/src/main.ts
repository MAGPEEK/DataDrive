import {
  createUserUseCase,
  type AuthDependencies,
  type Dependencies,
} from "@datadrive/application";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import { Argon2Hasher } from "./adapters/argon2-hasher.js";
import { createPool, migrate } from "./adapters/postgres/database.js";
import { FsBlockStore } from "./adapters/fs-block-store.js";
import {
  PgFileVersionRepository,
  PgNodeRepository,
  PgSessionRepository,
  PgUserRepository,
} from "./adapters/postgres/repositories.js";
import { PgStarRepository } from "./adapters/postgres/star-repository.js";
import { Sha256Hasher } from "./adapters/sha256-hasher.js";
import {
  PgDriveRepository,
  PgGroupRepository,
  PgMembershipRepository,
} from "./adapters/postgres/team-repositories.js";
import { RandomTokenCodec } from "./adapters/token-codec.js";
import { Rfc6238Totp } from "./adapters/totp.js";
import { buildApp } from "./app.js";
import { startMaintenance } from "./maintenance-job.js";

const BLOCK_SIZE_BYTES = 4 * 1024 * 1024;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

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

interface Runtime {
  readonly deps: Dependencies;
  readonly auth: AuthDependencies;
}

function createRuntime(pool: pg.Pool): Runtime {
  const deps: Dependencies = {
    users: new PgUserRepository(pool),
    nodes: new PgNodeRepository(pool),
    versions: new PgFileVersionRepository(pool),
    stars: new PgStarRepository(pool),
    drives: new PgDriveRepository(pool),
    memberships: new PgMembershipRepository(pool),
    groups: new PgGroupRepository(pool),
    blocks: new FsBlockStore(process.env.BLOCK_DIR ?? "/data/blocks"),
    hasher: new Sha256Hasher(),
    clock: { now: () => new Date() },
    ids: { next: () => randomUUID() },
    blockSize: BLOCK_SIZE_BYTES,
  };
  return { deps, auth: createAuth(pool, deps) };
}

function createAuth(pool: pg.Pool, deps: Dependencies): AuthDependencies {
  return {
    users: deps.users,
    drives: deps.drives,
    sessions: new PgSessionRepository(pool),
    hasher: new Argon2Hasher(),
    tokens: new RandomTokenCodec(),
    totp: new Rfc6238Totp(),
    clock: deps.clock,
    ids: deps.ids,
  };
}

async function main(): Promise<void> {
  const pool = createPool({ connectionString: requireEnv("DATABASE_URL") });
  await migrate(pool);
  const { deps, auth } = createRuntime(pool);
  await bootstrapAdmin(auth);

  const app = await buildApp({ deps, auth, secureCookies: process.env.COOKIE_SECURE === "true" });
  startMaintenance(deps, {
    intervalMs: HOUR_MS,
    graceMs: DAY_MS,
    log: (message) => console.log(message),
  });
  await app.listen({ port: Number(process.env.SERVER_PORT ?? 3000), host: "0.0.0.0" });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

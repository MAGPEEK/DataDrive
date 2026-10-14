import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

const MIGRATIONS_DIR = fileURLToPath(new URL("../../../migrations/", import.meta.url));

export interface PoolOptions {
  readonly connectionString: string;
  /** Isolates all tables in their own schema (used by tests). */
  readonly schema?: string;
}

export function createPool(options: PoolOptions): pg.Pool {
  const searchPath = options.schema === undefined ? undefined : `-c search_path=${options.schema}`;
  return new pg.Pool({ connectionString: options.connectionString, options: searchPath });
}

async function appliedVersions(pool: pg.Pool): Promise<Set<string>> {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const result = await pool.query<{ version: string }>("SELECT version FROM schema_migrations");
  return new Set(result.rows.map((row) => row.version));
}

async function applyMigration(pool: pg.Pool, version: string, sql: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function migrate(pool: pg.Pool): Promise<string[]> {
  const done = await appliedVersions(pool);
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  const applied: string[] = [];
  for (const file of files.filter((f) => !done.has(f))) {
    await applyMigration(pool, file, await readFile(MIGRATIONS_DIR + file, "utf8"));
    applied.push(file);
  }
  return applied;
}

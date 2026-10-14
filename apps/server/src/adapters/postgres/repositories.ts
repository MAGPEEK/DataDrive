import type {
  FileVersionRepository,
  NodeRepository,
  Session,
  SessionRepository,
  UserRepository,
} from "@datadrive/application";
import type { DriveNode, FileVersion, NodeKind, Role, User } from "@datadrive/domain";
import type pg from "pg";

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: Role;
  totp_secret: string | null;
  totp_enabled: boolean;
  disabled: boolean;
  created_at: Date;
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  username: row.username,
  passwordHash: row.password_hash,
  role: row.role,
  totpSecret: row.totp_secret,
  totpEnabled: row.totp_enabled,
  disabled: row.disabled,
  createdAt: row.created_at,
});

export class PgUserRepository implements UserRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findById(id: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
    return result.rows[0] === undefined ? null : toUser(result.rows[0]);
  }

  async findByUsername(username: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>("SELECT * FROM users WHERE username = $1", [
      username,
    ]);
    return result.rows[0] === undefined ? null : toUser(result.rows[0]);
  }

  async listAll(): Promise<User[]> {
    const result = await this.pool.query<UserRow>("SELECT * FROM users ORDER BY username");
    return result.rows.map(toUser);
  }

  async count(): Promise<number> {
    const result = await this.pool.query<{ n: string }>("SELECT count(*) AS n FROM users");
    return Number(result.rows[0]?.n ?? 0);
  }

  async save(user: User): Promise<void> {
    await this.pool.query(
      `INSERT INTO users (id, username, password_hash, role, totp_secret, totp_enabled, disabled, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         username = EXCLUDED.username, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
         totp_secret = EXCLUDED.totp_secret, totp_enabled = EXCLUDED.totp_enabled,
         disabled = EXCLUDED.disabled`,
      [
        user.id,
        user.username,
        user.passwordHash,
        user.role,
        user.totpSecret,
        user.totpEnabled,
        user.disabled,
        user.createdAt,
      ],
    );
  }
}

interface SessionRow {
  token_hash: string;
  user_id: string;
  created_at: Date;
  expires_at: Date;
}

export class PgSessionRepository implements SessionRepository {
  constructor(private readonly pool: pg.Pool) {}

  async save(session: Session): Promise<void> {
    await this.pool.query(
      "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)",
      [session.tokenHash, session.userId, session.createdAt, session.expiresAt],
    );
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const result = await this.pool.query<SessionRow>(
      "SELECT * FROM sessions WHERE token_hash = $1",
      [tokenHash],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return {
      tokenHash: row.token_hash,
      userId: row.user_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  }

  async delete(tokenHash: string): Promise<void> {
    await this.pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.pool.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
  }
}

interface NodeRow {
  id: string;
  drive_id: string;
  parent_id: string | null;
  name: string;
  kind: NodeKind;
  size: string;
  created_at: Date;
  modified_at: Date;
  trashed_at: Date | null;
  version_id: string | null;
}

const toNode = (row: NodeRow): DriveNode => ({
  id: row.id,
  driveId: row.drive_id,
  parentId: row.parent_id,
  name: row.name,
  kind: row.kind,
  size: Number(row.size),
  createdAt: row.created_at,
  modifiedAt: row.modified_at,
  trashedAt: row.trashed_at,
  versionId: row.version_id,
});

export class PgNodeRepository implements NodeRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findById(id: string): Promise<DriveNode | null> {
    const result = await this.pool.query<NodeRow>("SELECT * FROM nodes WHERE id = $1", [id]);
    return result.rows[0] === undefined ? null : toNode(result.rows[0]);
  }

  async listChildren(driveId: string, parentId: string | null): Promise<DriveNode[]> {
    const result = await this.pool.query<NodeRow>(
      "SELECT * FROM nodes WHERE drive_id = $1 AND parent_id IS NOT DISTINCT FROM $2 ORDER BY lower(name)",
      [driveId, parentId],
    );
    return result.rows.map(toNode);
  }

  async listTrashed(driveId: string): Promise<DriveNode[]> {
    const result = await this.pool.query<NodeRow>(
      "SELECT * FROM nodes WHERE drive_id = $1 AND trashed_at IS NOT NULL ORDER BY trashed_at DESC",
      [driveId],
    );
    return result.rows.map(toNode);
  }

  async search(driveIds: readonly string[], term: string, limit: number): Promise<DriveNode[]> {
    const pattern = `%${term.toLowerCase().replace(/[\\%_]/gu, "\\$&")}%`;
    const result = await this.pool.query<NodeRow>(
      `SELECT * FROM nodes WHERE drive_id = ANY($1) AND trashed_at IS NULL
         AND lower(name) LIKE $2 ESCAPE '\\' ORDER BY lower(name) LIMIT $3`,
      [[...driveIds], pattern, limit],
    );
    return result.rows.map(toNode);
  }

  async recentFiles(driveIds: readonly string[], limit: number): Promise<DriveNode[]> {
    const result = await this.pool.query<NodeRow>(
      `SELECT * FROM nodes WHERE drive_id = ANY($1) AND kind = 'file' AND trashed_at IS NULL
         ORDER BY modified_at DESC LIMIT $2`,
      [[...driveIds], limit],
    );
    return result.rows.map(toNode);
  }

  async findByIds(ids: readonly string[]): Promise<DriveNode[]> {
    if (ids.length === 0) return [];
    const result = await this.pool.query<NodeRow>("SELECT * FROM nodes WHERE id = ANY($1)", [
      [...ids],
    ]);
    return result.rows.map(toNode);
  }

  async usedBytes(driveId: string): Promise<number> {
    const result = await this.pool.query<{ total: string }>(
      "SELECT COALESCE(SUM(size), 0) AS total FROM nodes WHERE drive_id = $1",
      [driveId],
    );
    return Number(result.rows[0]?.total ?? 0);
  }

  async save(node: DriveNode): Promise<void> {
    await this.pool.query(
      `INSERT INTO nodes (id, drive_id, parent_id, name, kind, size, created_at, modified_at, trashed_at, version_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         parent_id = EXCLUDED.parent_id, name = EXCLUDED.name, size = EXCLUDED.size,
         modified_at = EXCLUDED.modified_at, trashed_at = EXCLUDED.trashed_at,
         version_id = EXCLUDED.version_id`,
      [
        node.id,
        node.driveId,
        node.parentId,
        node.name,
        node.kind,
        node.size,
        node.createdAt,
        node.modifiedAt,
        node.trashedAt,
        node.versionId,
      ],
    );
  }
}

interface VersionRow {
  id: string;
  node_id: string;
  size: string;
  block_hashes: string[];
  content_hash: string;
  created_at: Date;
  author_id: string;
}

const toVersion = (row: VersionRow): FileVersion => ({
  id: row.id,
  nodeId: row.node_id,
  size: Number(row.size),
  blockHashes: row.block_hashes,
  contentHash: row.content_hash,
  createdAt: row.created_at,
  authorId: row.author_id,
});

export class PgFileVersionRepository implements FileVersionRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findById(id: string): Promise<FileVersion | null> {
    const result = await this.pool.query<VersionRow>("SELECT * FROM file_versions WHERE id = $1", [
      id,
    ]);
    const row = result.rows[0];
    return row === undefined ? null : toVersion(row);
  }

  async listForNode(nodeId: string): Promise<FileVersion[]> {
    const result = await this.pool.query<VersionRow>(
      "SELECT * FROM file_versions WHERE node_id = $1 ORDER BY created_at DESC, id DESC",
      [nodeId],
    );
    return result.rows.map(toVersion);
  }

  async delete(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.pool.query("DELETE FROM file_versions WHERE id = ANY($1)", [[...ids]]);
  }

  async referencedBlockHashes(): Promise<Set<string>> {
    const result = await this.pool.query<{ hash: string }>(
      "SELECT DISTINCT unnest(block_hashes) AS hash FROM file_versions",
    );
    return new Set(result.rows.map((row) => row.hash));
  }

  async save(version: FileVersion): Promise<void> {
    await this.pool.query(
      `INSERT INTO file_versions (id, node_id, size, block_hashes, content_hash, created_at, author_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        version.id,
        version.nodeId,
        version.size,
        [...version.blockHashes],
        version.contentHash,
        version.createdAt,
        version.authorId,
      ],
    );
  }
}

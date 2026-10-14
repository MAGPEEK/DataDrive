import type {
  NodeRepository,
  Session,
  SessionRepository,
  UserRepository,
} from "@datadrive/application";
import type { DriveNode, NodeKind, Role, User } from "@datadrive/domain";
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
  owner_id: string;
  parent_id: string | null;
  name: string;
  kind: NodeKind;
  created_at: Date;
  trashed_at: Date | null;
}

const toNode = (row: NodeRow): DriveNode => ({
  id: row.id,
  ownerId: row.owner_id,
  parentId: row.parent_id,
  name: row.name,
  kind: row.kind,
  createdAt: row.created_at,
  trashedAt: row.trashed_at,
});

export class PgNodeRepository implements NodeRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findById(id: string): Promise<DriveNode | null> {
    const result = await this.pool.query<NodeRow>("SELECT * FROM nodes WHERE id = $1", [id]);
    return result.rows[0] === undefined ? null : toNode(result.rows[0]);
  }

  async listChildren(ownerId: string, parentId: string | null): Promise<DriveNode[]> {
    const result = await this.pool.query<NodeRow>(
      "SELECT * FROM nodes WHERE owner_id = $1 AND parent_id IS NOT DISTINCT FROM $2 ORDER BY lower(name)",
      [ownerId, parentId],
    );
    return result.rows.map(toNode);
  }

  async save(node: DriveNode): Promise<void> {
    await this.pool.query(
      `INSERT INTO nodes (id, owner_id, parent_id, name, kind, created_at, trashed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         parent_id = EXCLUDED.parent_id, name = EXCLUDED.name, trashed_at = EXCLUDED.trashed_at`,
      [node.id, node.ownerId, node.parentId, node.name, node.kind, node.createdAt, node.trashedAt],
    );
  }
}

import type { StarRepository } from "@datadrive/application";
import type pg from "pg";

export class PgStarRepository implements StarRepository {
  constructor(private readonly pool: pg.Pool) {}

  async set(userId: string, nodeId: string, starred: boolean): Promise<void> {
    if (starred) {
      await this.pool.query(
        "INSERT INTO stars (user_id, node_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [userId, nodeId],
      );
      return;
    }
    await this.pool.query("DELETE FROM stars WHERE user_id = $1 AND node_id = $2", [
      userId,
      nodeId,
    ]);
  }

  async starredAmong(userId: string, nodeIds: readonly string[]): Promise<Set<string>> {
    if (nodeIds.length === 0) return new Set();
    const result = await this.pool.query<{ node_id: string }>(
      "SELECT node_id FROM stars WHERE user_id = $1 AND node_id = ANY($2)",
      [userId, [...nodeIds]],
    );
    return new Set(result.rows.map((row) => row.node_id));
  }

  async listStarredIds(userId: string): Promise<string[]> {
    const result = await this.pool.query<{ node_id: string }>(
      "SELECT node_id FROM stars WHERE user_id = $1 ORDER BY created_at DESC",
      [userId],
    );
    return result.rows.map((row) => row.node_id);
  }
}

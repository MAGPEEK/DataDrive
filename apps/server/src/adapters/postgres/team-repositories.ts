import type {
  DriveRepository,
  GroupRepository,
  Member,
  MembershipRepository,
} from "@datadrive/application";
import type { Drive, DriveKind, DriveRole, Group, SubjectType } from "@datadrive/domain";
import type pg from "pg";

interface DriveRow {
  id: string;
  kind: DriveKind;
  name: string;
  quota_bytes: string | null;
  restrict_downloads: boolean;
  watermark: boolean;
  file_locking: boolean;
  max_versions: number;
  created_at: Date;
}

const toDrive = (row: DriveRow): Drive => ({
  id: row.id,
  kind: row.kind,
  name: row.name,
  quotaBytes: row.quota_bytes === null ? null : Number(row.quota_bytes),
  settings: {
    restrictDownloads: row.restrict_downloads,
    watermark: row.watermark,
    fileLocking: row.file_locking,
    maxVersions: row.max_versions,
  },
  createdAt: row.created_at,
});

export class PgDriveRepository implements DriveRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findById(id: string): Promise<Drive | null> {
    const result = await this.pool.query<DriveRow>("SELECT * FROM drives WHERE id = $1", [id]);
    return result.rows[0] === undefined ? null : toDrive(result.rows[0]);
  }

  async listTeamDrives(): Promise<Drive[]> {
    const result = await this.pool.query<DriveRow>(
      "SELECT * FROM drives WHERE kind = 'team' ORDER BY lower(name)",
    );
    return result.rows.map(toDrive);
  }

  async save(drive: Drive): Promise<void> {
    await this.pool.query(
      `INSERT INTO drives (id, kind, name, quota_bytes, restrict_downloads, watermark, file_locking, max_versions, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, quota_bytes = EXCLUDED.quota_bytes,
         restrict_downloads = EXCLUDED.restrict_downloads, watermark = EXCLUDED.watermark,
         file_locking = EXCLUDED.file_locking, max_versions = EXCLUDED.max_versions`,
      [
        drive.id,
        drive.kind,
        drive.name,
        drive.quotaBytes,
        drive.settings.restrictDownloads,
        drive.settings.watermark,
        drive.settings.fileLocking,
        drive.settings.maxVersions,
        drive.createdAt,
      ],
    );
  }
}

interface GroupRow {
  id: string;
  name: string;
  created_at: Date;
}

const toGroup = (row: GroupRow): Group => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
});

export class PgGroupRepository implements GroupRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findById(id: string): Promise<Group | null> {
    const result = await this.pool.query<GroupRow>("SELECT * FROM groups WHERE id = $1", [id]);
    return result.rows[0] === undefined ? null : toGroup(result.rows[0]);
  }

  async findByName(name: string): Promise<Group | null> {
    const result = await this.pool.query<GroupRow>("SELECT * FROM groups WHERE name = $1", [name]);
    return result.rows[0] === undefined ? null : toGroup(result.rows[0]);
  }

  async save(group: Group): Promise<void> {
    await this.pool.query(
      "INSERT INTO groups (id, name, created_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name",
      [group.id, group.name, group.createdAt],
    );
  }

  async listAll(): Promise<Group[]> {
    const result = await this.pool.query<GroupRow>("SELECT * FROM groups ORDER BY lower(name)");
    return result.rows.map(toGroup);
  }

  async addMember(groupId: string, userId: string): Promise<void> {
    await this.pool.query(
      "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [groupId, userId],
    );
  }

  async removeMember(groupId: string, userId: string): Promise<void> {
    await this.pool.query("DELETE FROM group_members WHERE group_id = $1 AND user_id = $2", [
      groupId,
      userId,
    ]);
  }

  async listMembers(groupId: string): Promise<string[]> {
    const result = await this.pool.query<{ user_id: string }>(
      "SELECT user_id FROM group_members WHERE group_id = $1",
      [groupId],
    );
    return result.rows.map((row) => row.user_id);
  }
}

interface MemberRow {
  subject_type: SubjectType;
  subject_id: string;
  role: DriveRole;
}

const MEMBER_MATCH = `
  (m.subject_type = 'user' AND m.subject_id = $1)
  OR (m.subject_type = 'group' AND m.subject_id IN (SELECT group_id FROM group_members WHERE user_id = $1))`;

export class PgMembershipRepository implements MembershipRepository {
  constructor(private readonly pool: pg.Pool) {}

  async set(driveId: string, member: Member): Promise<void> {
    await this.pool.query(
      `INSERT INTO drive_members (drive_id, subject_type, subject_id, role) VALUES ($1, $2, $3, $4)
       ON CONFLICT (drive_id, subject_type, subject_id) DO UPDATE SET role = EXCLUDED.role`,
      [driveId, member.subjectType, member.subjectId, member.role],
    );
  }

  async remove(driveId: string, subjectType: SubjectType, subjectId: string): Promise<void> {
    await this.pool.query(
      "DELETE FROM drive_members WHERE drive_id = $1 AND subject_type = $2 AND subject_id = $3",
      [driveId, subjectType, subjectId],
    );
  }

  async list(driveId: string): Promise<Member[]> {
    const result = await this.pool.query<MemberRow>(
      "SELECT subject_type, subject_id, role FROM drive_members WHERE drive_id = $1 ORDER BY subject_type, subject_id",
      [driveId],
    );
    return result.rows.map((r) => ({
      subjectType: r.subject_type,
      subjectId: r.subject_id,
      role: r.role,
    }));
  }

  async rolesFor(userId: string, driveId: string): Promise<DriveRole[]> {
    const result = await this.pool.query<{ role: DriveRole }>(
      `SELECT m.role FROM drive_members m WHERE m.drive_id = $2 AND (${MEMBER_MATCH})`,
      [userId, driveId],
    );
    return result.rows.map((r) => r.role);
  }

  async teamRolesForUser(userId: string): Promise<{ driveId: string; role: DriveRole }[]> {
    const result = await this.pool.query<{ drive_id: string; role: DriveRole }>(
      `SELECT m.drive_id, m.role FROM drive_members m WHERE ${MEMBER_MATCH}`,
      [userId],
    );
    return result.rows.map((r) => ({ driveId: r.drive_id, role: r.role }));
  }
}

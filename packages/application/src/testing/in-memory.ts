import type {
  User,
  Drive,
  DriveNode,
  DriveRole,
  FileVersion,
  Group,
  SubjectType,
} from "@datadrive/domain";
import { createHash } from "node:crypto";
import type { UserRepository } from "../auth-ports.js";
import type {
  BlockStore,
  Clock,
  ContentHasher,
  Dependencies,
  DriveRepository,
  FileVersionRepository,
  GroupRepository,
  IdGenerator,
  Member,
  MembershipRepository,
  NodeRepository,
  StarRepository,
  StoredBlock,
} from "../ports.js";

export class InMemoryUserRepository implements UserRepository {
  private readonly store = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.store.get(id) ?? null;
  }

  async findByUsername(username: string): Promise<User | null> {
    return [...this.store.values()].find((u) => u.username === username) ?? null;
  }

  async count(): Promise<number> {
    return this.store.size;
  }

  async listAll(): Promise<User[]> {
    return [...this.store.values()].sort((a, b) => a.username.localeCompare(b.username));
  }

  async save(user: User): Promise<void> {
    this.store.set(user.id, user);
  }
}

export class InMemoryNodeRepository implements NodeRepository {
  private readonly store = new Map<string, DriveNode>();

  async findById(id: string): Promise<DriveNode | null> {
    return this.store.get(id) ?? null;
  }

  async listChildren(driveId: string, parentId: string | null): Promise<DriveNode[]> {
    return [...this.store.values()].filter((n) => n.driveId === driveId && n.parentId === parentId);
  }

  async save(node: DriveNode): Promise<void> {
    this.store.set(node.id, node);
  }

  async listTrashed(driveId: string): Promise<DriveNode[]> {
    return [...this.store.values()]
      .filter((n) => n.driveId === driveId && n.trashedAt !== null)
      .sort((a, b) => (b.trashedAt as Date).getTime() - (a.trashedAt as Date).getTime());
  }

  async search(driveIds: readonly string[], term: string, limit: number): Promise<DriveNode[]> {
    const needle = term.toLowerCase();
    return [...this.store.values()]
      .filter((n) => driveIds.includes(n.driveId) && n.trashedAt === null)
      .filter((n) => n.name.toLowerCase().includes(needle))
      .slice(0, limit);
  }

  async recentFiles(driveIds: readonly string[], limit: number): Promise<DriveNode[]> {
    return [...this.store.values()]
      .filter((n) => driveIds.includes(n.driveId) && n.kind === "file" && n.trashedAt === null)
      .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime())
      .slice(0, limit);
  }

  async findByIds(ids: readonly string[]): Promise<DriveNode[]> {
    return ids.flatMap((id) => this.store.get(id) ?? []);
  }

  async usedBytes(driveId: string): Promise<number> {
    return [...this.store.values()]
      .filter((n) => n.driveId === driveId)
      .reduce((sum, n) => sum + n.size, 0);
  }
}

export class InMemoryStarRepository implements StarRepository {
  private readonly stars = new Set<string>();

  async set(userId: string, nodeId: string, starred: boolean): Promise<void> {
    if (starred) this.stars.add(`${userId}|${nodeId}`);
    else this.stars.delete(`${userId}|${nodeId}`);
  }

  async starredAmong(userId: string, nodeIds: readonly string[]): Promise<Set<string>> {
    return new Set(nodeIds.filter((id) => this.stars.has(`${userId}|${id}`)));
  }

  async listStarredIds(userId: string): Promise<string[]> {
    return [...this.stars]
      .filter((k) => k.startsWith(`${userId}|`))
      .map((k) => k.split("|")[1] as string);
  }
}

export class InMemoryFileVersionRepository implements FileVersionRepository {
  private readonly store = new Map<string, FileVersion>();

  async findById(id: string): Promise<FileVersion | null> {
    return this.store.get(id) ?? null;
  }

  async save(version: FileVersion): Promise<void> {
    this.store.set(version.id, version);
  }

  async listForNode(nodeId: string): Promise<FileVersion[]> {
    return [...this.store.values()]
      .filter((v) => v.nodeId === nodeId)
      .reverse()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async delete(ids: readonly string[]): Promise<void> {
    for (const id of ids) this.store.delete(id);
  }

  async referencedBlockHashes(): Promise<Set<string>> {
    return new Set([...this.store.values()].flatMap((v) => v.blockHashes));
  }
}

export class InMemoryDriveRepository implements DriveRepository {
  private readonly store = new Map<string, Drive>();

  async findById(id: string): Promise<Drive | null> {
    return this.store.get(id) ?? null;
  }

  async save(drive: Drive): Promise<void> {
    this.store.set(drive.id, drive);
  }

  async listTeamDrives(): Promise<Drive[]> {
    return [...this.store.values()].filter((d) => d.kind === "team");
  }
}

export class InMemoryGroupRepository implements GroupRepository {
  private readonly groups = new Map<string, Group>();
  private readonly members = new Map<string, Set<string>>();

  async findById(id: string): Promise<Group | null> {
    return this.groups.get(id) ?? null;
  }

  async findByName(name: string): Promise<Group | null> {
    return [...this.groups.values()].find((g) => g.name === name) ?? null;
  }

  async save(group: Group): Promise<void> {
    this.groups.set(group.id, group);
  }

  async listAll(): Promise<Group[]> {
    return [...this.groups.values()];
  }

  async addMember(groupId: string, userId: string): Promise<void> {
    this.members.set(groupId, (this.members.get(groupId) ?? new Set()).add(userId));
  }

  async removeMember(groupId: string, userId: string): Promise<void> {
    this.members.get(groupId)?.delete(userId);
  }

  async listMembers(groupId: string): Promise<string[]> {
    return [...(this.members.get(groupId) ?? [])];
  }
}

export class InMemoryMembershipRepository implements MembershipRepository {
  private readonly entries = new Map<string, Member & { driveId: string }>();

  constructor(private readonly groups: GroupRepository) {}

  private key(driveId: string, type: SubjectType, id: string): string {
    return `${driveId}|${type}|${id}`;
  }

  async set(driveId: string, member: Member): Promise<void> {
    this.entries.set(this.key(driveId, member.subjectType, member.subjectId), {
      ...member,
      driveId,
    });
  }

  async remove(driveId: string, type: SubjectType, id: string): Promise<void> {
    this.entries.delete(this.key(driveId, type, id));
  }

  async list(driveId: string): Promise<Member[]> {
    return [...this.entries.values()].filter((e) => e.driveId === driveId);
  }

  async teamRolesForUser(userId: string): Promise<{ driveId: string; role: DriveRole }[]> {
    const result: { driveId: string; role: DriveRole }[] = [];
    for (const entry of this.entries.values()) {
      if (await this.applies(entry, userId))
        result.push({ driveId: entry.driveId, role: entry.role });
    }
    return result;
  }

  async rolesFor(userId: string, driveId: string): Promise<DriveRole[]> {
    const roles: DriveRole[] = [];
    for (const entry of this.entries.values()) {
      if (entry.driveId === driveId && (await this.applies(entry, userId))) roles.push(entry.role);
    }
    return roles;
  }

  private async applies(entry: Member, userId: string): Promise<boolean> {
    if (entry.subjectType === "user") return entry.subjectId === userId;
    return (await this.groups.listMembers(entry.subjectId)).includes(userId);
  }
}

export class InMemoryBlockStore implements BlockStore {
  readonly blocks = new Map<string, Uint8Array>();
  readonly stored = new Map<string, Date>();

  constructor(private readonly clock: Clock = { now: () => new Date() }) {}

  async has(hash: string): Promise<boolean> {
    return this.blocks.has(hash);
  }

  async put(hash: string, data: Uint8Array): Promise<void> {
    this.blocks.set(hash, data);
    this.stored.set(hash, this.clock.now());
  }

  async get(hash: string): Promise<Uint8Array> {
    const data = this.blocks.get(hash);
    if (data === undefined) throw new Error(`Missing block ${hash}`);
    return data;
  }

  async *list(): AsyncGenerator<StoredBlock> {
    for (const [hash, modifiedAt] of [...this.stored]) yield { hash, modifiedAt };
  }

  async delete(hash: string): Promise<void> {
    this.blocks.delete(hash);
    this.stored.delete(hash);
  }
}

export class NodeCryptoHasher implements ContentHasher {
  sha256(data: Uint8Array): string {
    return createHash("sha256").update(data).digest("hex");
  }
}

export class FixedClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }

  advance(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}

export class SequentialIds implements IdGenerator {
  private counter = 0;

  next(): string {
    this.counter += 1;
    return `id-${this.counter}`;
  }
}

export function testDependencies(blockSize = 4): Dependencies {
  const groups = new InMemoryGroupRepository();
  const clock = new FixedClock(new Date("2026-10-14T12:00:00Z"));
  return {
    users: new InMemoryUserRepository(),
    nodes: new InMemoryNodeRepository(),
    versions: new InMemoryFileVersionRepository(),
    stars: new InMemoryStarRepository(),
    drives: new InMemoryDriveRepository(),
    memberships: new InMemoryMembershipRepository(groups),
    groups,
    blocks: new InMemoryBlockStore(clock),
    hasher: new NodeCryptoHasher(),
    clock,
    ids: new SequentialIds(),
    blockSize,
  };
}

import type {
  Drive,
  DriveNode,
  DriveRole,
  FileVersion,
  Group,
  SubjectType,
} from "@datadrive/domain";

export interface NodeRepository {
  findById(id: string): Promise<DriveNode | null>;
  listChildren(driveId: string, parentId: string | null): Promise<DriveNode[]>;
  save(node: DriveNode): Promise<void>;
  /** Sum of the current file sizes in the drive (trashed items included). */
  usedBytes(driveId: string): Promise<number>;
}

export interface FileVersionRepository {
  findById(id: string): Promise<FileVersion | null>;
  save(version: FileVersion): Promise<void>;
}

export interface DriveRepository {
  findById(id: string): Promise<Drive | null>;
  save(drive: Drive): Promise<void>;
  listTeamDrives(): Promise<Drive[]>;
}

export interface Member {
  readonly subjectType: SubjectType;
  readonly subjectId: string;
  readonly role: DriveRole;
}

export interface MembershipRepository {
  set(driveId: string, member: Member): Promise<void>;
  remove(driveId: string, subjectType: SubjectType, subjectId: string): Promise<void>;
  list(driveId: string): Promise<Member[]>;
  /** Roles of a user in a drive, from direct membership and from group membership. */
  rolesFor(userId: string, driveId: string): Promise<DriveRole[]>;
  /** All team drives a user belongs to (directly or via groups) with the roles found. */
  teamRolesForUser(userId: string): Promise<{ driveId: string; role: DriveRole }[]>;
}

export interface GroupRepository {
  findById(id: string): Promise<Group | null>;
  findByName(name: string): Promise<Group | null>;
  save(group: Group): Promise<void>;
  listAll(): Promise<Group[]>;
  addMember(groupId: string, userId: string): Promise<void>;
  removeMember(groupId: string, userId: string): Promise<void>;
  listMembers(groupId: string): Promise<string[]>;
}

/** Content-addressed storage for file blocks. */
export interface BlockStore {
  has(hash: string): Promise<boolean>;
  put(hash: string, data: Uint8Array): Promise<void>;
  get(hash: string): Promise<Uint8Array>;
}

export interface ContentHasher {
  sha256(data: Uint8Array): string;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

export interface Dependencies {
  readonly nodes: NodeRepository;
  readonly versions: FileVersionRepository;
  readonly drives: DriveRepository;
  readonly memberships: MembershipRepository;
  readonly groups: GroupRepository;
  readonly blocks: BlockStore;
  readonly hasher: ContentHasher;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /** Size of one content block in bytes. */
  readonly blockSize: number;
}

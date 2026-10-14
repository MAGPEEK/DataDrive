import {
  DEFAULT_DRIVE_SETTINGS,
  NotFoundError,
  UsernameTakenError,
  normalizeDriveName,
  roleAllows,
  type Drive,
  type DriveRole,
  type DriveSettings,
  type Group,
  type SubjectType,
} from "@datadrive/domain";
import { requireAdmin, requireDriveAccess, roleIn, type Actor } from "./access.js";
import type { Dependencies, Member } from "./ports.js";

export interface DriveOverview {
  readonly drive: Drive;
  readonly role: DriveRole;
  readonly usedBytes: number;
}

export async function createTeamFolderUseCase(
  deps: Dependencies,
  actor: Actor,
  name: string,
): Promise<Drive> {
  requireAdmin(actor);
  const drive: Drive = {
    id: deps.ids.next(),
    kind: "team",
    name: normalizeDriveName(name),
    quotaBytes: null,
    settings: DEFAULT_DRIVE_SETTINGS,
    createdAt: deps.clock.now(),
  };
  await deps.drives.save(drive);
  return drive;
}

export interface DriveChanges {
  readonly quotaBytes?: number | null;
  readonly settings?: Partial<DriveSettings>;
}

export async function updateDriveUseCase(
  deps: Dependencies,
  actor: Actor,
  changes: DriveChanges & { readonly driveId: string },
): Promise<Drive> {
  requireAdmin(actor);
  const drive = await deps.drives.findById(changes.driveId);
  if (drive === null) throw new NotFoundError(changes.driveId);
  const updated: Drive = {
    ...drive,
    quotaBytes: changes.quotaBytes === undefined ? drive.quotaBytes : changes.quotaBytes,
    settings: { ...drive.settings, ...changes.settings },
  };
  await deps.drives.save(updated);
  return updated;
}

async function requireManager(deps: Dependencies, actor: Actor, driveId: string): Promise<Drive> {
  if (actor.role === "admin") {
    const drive = await deps.drives.findById(driveId);
    if (drive === null) throw new NotFoundError(driveId);
    return drive;
  }
  return requireDriveAccess(deps, actor, { driveId, permission: "manage" });
}

export async function setMemberUseCase(
  deps: Dependencies,
  actor: Actor,
  command: { readonly driveId: string } & Member,
): Promise<void> {
  const { driveId, ...member } = command;
  const drive = await requireManager(deps, actor, driveId);
  if (drive.kind !== "team") throw new NotFoundError(driveId);
  await deps.memberships.set(driveId, member);
}

export async function removeMemberUseCase(
  deps: Dependencies,
  actor: Actor,
  command: {
    readonly driveId: string;
    readonly subjectType: SubjectType;
    readonly subjectId: string;
  },
): Promise<void> {
  await requireManager(deps, actor, command.driveId);
  await deps.memberships.remove(command.driveId, command.subjectType, command.subjectId);
}

export async function listMembersUseCase(
  deps: Dependencies,
  actor: Actor,
  driveId: string,
): Promise<Member[]> {
  await requireManager(deps, actor, driveId);
  return deps.memberships.list(driveId);
}

export async function listDrivesUseCase(
  deps: Dependencies,
  actor: Actor,
): Promise<DriveOverview[]> {
  const personal = await deps.drives.findById(actor.id);
  const memberships = await deps.memberships.teamRolesForUser(actor.id);
  const entries: { drive: Drive; role: DriveRole }[] = [];
  if (personal !== null) entries.push({ drive: personal, role: "manager" });
  for (const { driveId, role } of memberships) {
    const drive = await deps.drives.findById(driveId);
    if (drive !== null) entries.push({ drive, role });
  }
  return Promise.all(
    entries.map(async (e) => ({ ...e, usedBytes: await deps.nodes.usedBytes(e.drive.id) })),
  );
}

export async function listAllTeamFoldersUseCase(
  deps: Dependencies,
  actor: Actor,
): Promise<Drive[]> {
  requireAdmin(actor);
  return deps.drives.listTeamDrives();
}

export async function createGroupUseCase(
  deps: Dependencies,
  actor: Actor,
  name: string,
): Promise<Group> {
  requireAdmin(actor);
  const groupName = normalizeDriveName(name);
  if ((await deps.groups.findByName(groupName)) !== null) throw new UsernameTakenError();
  const group: Group = { id: deps.ids.next(), name: groupName, createdAt: deps.clock.now() };
  await deps.groups.save(group);
  return group;
}

export async function setGroupMemberUseCase(
  deps: Dependencies,
  actor: Actor,
  update: { readonly groupId: string; readonly userId: string; readonly present: boolean },
): Promise<void> {
  requireAdmin(actor);
  const { groupId, userId, present } = update;
  if ((await deps.groups.findById(groupId)) === null) throw new NotFoundError(groupId);
  if (present) await deps.groups.addMember(groupId, userId);
  else await deps.groups.removeMember(groupId, userId);
}

export async function canManageDrive(
  deps: Dependencies,
  actor: Actor,
  driveId: string,
): Promise<boolean> {
  return actor.role === "admin" || roleAllows(await roleIn(deps, actor, driveId), "manage");
}

import {
  ForbiddenError,
  NotFoundError,
  maxRole,
  roleAllows,
  type Drive,
  type DriveNode,
  type DriveRole,
  type Permission,
  type Role,
} from "@datadrive/domain";
import type { Dependencies } from "./ports.js";

export interface Actor {
  readonly id: string;
  readonly role: Role;
}

export async function roleIn(
  deps: Dependencies,
  actor: Actor,
  driveId: string,
): Promise<DriveRole | null> {
  const drive = await deps.drives.findById(driveId);
  if (drive === null) return null;
  if (drive.kind === "personal") return drive.id === actor.id ? "manager" : null;
  return maxRole(await deps.memberships.rolesFor(actor.id, driveId));
}

/** Missing drives and drives the actor cannot see look the same (not found); known drives enforce the permission. */
export interface DriveNeed {
  readonly driveId: string;
  readonly permission: Permission;
}

export interface NodeNeed {
  readonly nodeId: string;
  readonly permission: Permission;
}

export async function requireDriveAccess(
  deps: Dependencies,
  actor: Actor,
  need: DriveNeed,
): Promise<Drive> {
  const drive = await deps.drives.findById(need.driveId);
  const role = drive === null ? null : await roleIn(deps, actor, need.driveId);
  if (drive === null || role === null) throw new NotFoundError(need.driveId);
  if (!roleAllows(role, need.permission)) throw new ForbiddenError();
  return drive;
}

export interface NodeAccess {
  readonly node: DriveNode;
  readonly drive: Drive;
}

export async function requireNodeAccess(
  deps: Dependencies,
  actor: Actor,
  need: NodeNeed,
): Promise<NodeAccess> {
  const node = await deps.nodes.findById(need.nodeId);
  if (node === null) throw new NotFoundError(need.nodeId);
  try {
    const drive = await requireDriveAccess(deps, actor, {
      driveId: node.driveId,
      permission: need.permission,
    });
    return { node, drive };
  } catch (error) {
    if (error instanceof NotFoundError) throw new NotFoundError(need.nodeId);
    throw error;
  }
}

export function requireAdmin(actor: Actor): void {
  if (actor.role !== "admin") throw new ForbiddenError();
}

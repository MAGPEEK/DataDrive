import {
  NotFoundError,
  NotInTrashError,
  createFolder,
  moveToTrash,
  restoreFromTrash,
  type DriveNode,
} from "@datadrive/domain";
import { requireDriveAccess, requireNodeAccess, type Actor } from "./access.js";
import type { Dependencies } from "./ports.js";

export interface Location {
  /** Defaults to the actor's personal drive. Ignored when parentId is set (the parent decides). */
  readonly driveId?: string | undefined;
  readonly parentId: string | null;
}

export interface CreateFolderCommand extends Location {
  readonly name: string;
}

/** Resolves the drive and checks the permission for a location (a drive root or a folder). */
export async function resolveLocation(
  deps: Dependencies,
  actor: Actor,
  request: Location & { readonly permission: "read" | "write" },
): Promise<{ driveId: string; parentId: string | null }> {
  const { permission, parentId } = request;
  if (parentId === null) {
    const driveId = request.driveId ?? actor.id;
    await requireDriveAccess(deps, actor, { driveId, permission });
    return { driveId, parentId: null };
  }
  const { node } = await requireNodeAccess(deps, actor, { nodeId: parentId, permission });
  if (node.kind !== "folder") throw new NotFoundError(node.id);
  return { driveId: node.driveId, parentId: node.id };
}

export async function createFolderUseCase(
  deps: Dependencies,
  actor: Actor,
  command: CreateFolderCommand,
): Promise<DriveNode> {
  const { driveId, parentId } = await resolveLocation(deps, actor, {
    ...command,
    permission: "write",
  });
  const siblings = await deps.nodes.listChildren(driveId, parentId);
  const input = {
    id: deps.ids.next(),
    driveId,
    parentId,
    name: command.name,
    now: deps.clock.now(),
  };
  const folder = createFolder(input, siblings);
  await deps.nodes.save(folder);
  return folder;
}

export async function listChildrenUseCase(
  deps: Dependencies,
  actor: Actor,
  location: Location,
): Promise<DriveNode[]> {
  const { driveId, parentId } = await resolveLocation(deps, actor, {
    ...location,
    permission: "read",
  });
  const children = await deps.nodes.listChildren(driveId, parentId);
  return children.filter((node) => node.trashedAt === null);
}

/** The trash of a drive; only members who may change content (editor, manager) can see it. */
export async function listTrashUseCase(
  deps: Dependencies,
  actor: Actor,
  driveId: string | undefined,
): Promise<DriveNode[]> {
  const id = driveId ?? actor.id;
  await requireDriveAccess(deps, actor, { driveId: id, permission: "write" });
  return deps.nodes.listTrashed(id);
}

export async function trashNodeUseCase(
  deps: Dependencies,
  actor: Actor,
  id: string,
): Promise<DriveNode> {
  const { node } = await requireNodeAccess(deps, actor, { nodeId: id, permission: "write" });
  const trashed = moveToTrash(node, deps.clock.now());
  await deps.nodes.save(trashed);
  return trashed;
}

export async function restoreNodeUseCase(
  deps: Dependencies,
  actor: Actor,
  id: string,
): Promise<DriveNode> {
  const { node } = await requireNodeAccess(deps, actor, { nodeId: id, permission: "write" });
  if (node.trashedAt === null) throw new NotInTrashError(id);
  const siblings = await deps.nodes.listChildren(node.driveId, node.parentId);
  const restored = restoreFromTrash(node, siblings);
  await deps.nodes.save(restored);
  return restored;
}

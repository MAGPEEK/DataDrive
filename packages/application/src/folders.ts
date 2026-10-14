import {
  NotFoundError,
  NotInTrashError,
  createFolder,
  moveToTrash,
  restoreFromTrash,
  type DriveNode,
} from "@datadrive/domain";
import type { Dependencies } from "./ports.js";

export interface CreateFolderCommand {
  readonly ownerId: string;
  readonly parentId: string | null;
  readonly name: string;
}

async function requireOwned(deps: Dependencies, ownerId: string, id: string): Promise<DriveNode> {
  const node = await deps.nodes.findById(id);
  if (node === null || node.ownerId !== ownerId) throw new NotFoundError(id);
  return node;
}

export async function createFolderUseCase(
  deps: Dependencies,
  command: CreateFolderCommand,
): Promise<DriveNode> {
  if (command.parentId !== null) await requireOwned(deps, command.ownerId, command.parentId);
  const siblings = await deps.nodes.listChildren(command.ownerId, command.parentId);
  const folder = createFolder({ ...command, id: deps.ids.next(), now: deps.clock.now() }, siblings);
  await deps.nodes.save(folder);
  return folder;
}

export async function listChildrenUseCase(
  deps: Dependencies,
  ownerId: string,
  parentId: string | null,
): Promise<DriveNode[]> {
  if (parentId !== null) await requireOwned(deps, ownerId, parentId);
  const children = await deps.nodes.listChildren(ownerId, parentId);
  return children.filter((node) => node.trashedAt === null);
}

export async function trashNodeUseCase(
  deps: Dependencies,
  ownerId: string,
  id: string,
): Promise<DriveNode> {
  const node = await requireOwned(deps, ownerId, id);
  const trashed = moveToTrash(node, deps.clock.now());
  await deps.nodes.save(trashed);
  return trashed;
}

export async function restoreNodeUseCase(
  deps: Dependencies,
  ownerId: string,
  id: string,
): Promise<DriveNode> {
  const node = await requireOwned(deps, ownerId, id);
  if (node.trashedAt === null) throw new NotInTrashError(id);
  const siblings = await deps.nodes.listChildren(ownerId, node.parentId);
  const restored = restoreFromTrash(node, siblings);
  await deps.nodes.save(restored);
  return restored;
}

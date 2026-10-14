import {
  InvalidMoveError,
  NotFoundError,
  moveNode,
  renameNode,
  type DriveNode,
} from "@datadrive/domain";
import { requireNodeAccess, type Actor } from "./access.js";
import type { Dependencies } from "./ports.js";

export interface RenameCommand {
  readonly nodeId: string;
  readonly name: string;
}

export interface MoveCommand {
  readonly nodeId: string;
  /** The folder to move into; null moves to the root of the drive. */
  readonly targetParentId: string | null;
}

/** The chain of parents of a node, nearest parent first. */
export async function ancestorsOf(deps: Dependencies, node: DriveNode): Promise<DriveNode[]> {
  const chain: DriveNode[] = [];
  let parentId = node.parentId;
  while (parentId !== null) {
    const parent = await deps.nodes.findById(parentId);
    if (parent === null) break;
    chain.push(parent);
    parentId = parent.parentId;
  }
  return chain;
}

export async function renameNodeUseCase(
  deps: Dependencies,
  actor: Actor,
  command: RenameCommand,
): Promise<DriveNode> {
  const { node } = await requireNodeAccess(deps, actor, {
    nodeId: command.nodeId,
    permission: "write",
  });
  const siblings = await deps.nodes.listChildren(node.driveId, node.parentId);
  const renamed = renameNode(node, command.name, siblings);
  await deps.nodes.save(renamed);
  return renamed;
}

async function requireMoveTarget(
  deps: Dependencies,
  node: DriveNode,
  targetParentId: string,
): Promise<void> {
  const target = await deps.nodes.findById(targetParentId);
  if (target === null || target.kind !== "folder" || target.trashedAt !== null) {
    throw new NotFoundError(targetParentId);
  }
  if (target.driveId !== node.driveId) throw new InvalidMoveError("Items stay in their drive");
  const chain = [target, ...(await ancestorsOf(deps, target))];
  if (chain.some((n) => n.id === node.id)) {
    throw new InvalidMoveError("A folder cannot be moved into itself");
  }
}

export async function moveNodeUseCase(
  deps: Dependencies,
  actor: Actor,
  command: MoveCommand,
): Promise<DriveNode> {
  const { node } = await requireNodeAccess(deps, actor, {
    nodeId: command.nodeId,
    permission: "write",
  });
  if (command.targetParentId !== null) await requireMoveTarget(deps, node, command.targetParentId);
  const siblings = await deps.nodes.listChildren(node.driveId, command.targetParentId);
  const moved = moveNode(node, command.targetParentId, siblings);
  await deps.nodes.save(moved);
  return moved;
}

import { InvalidNameError, NameConflictError } from "./errors.js";
import { isValidNodeName } from "./node-name.js";

export type NodeKind = "file" | "folder";

export interface DriveNode {
  readonly id: string;
  readonly ownerId: string;
  readonly parentId: string | null;
  readonly name: string;
  readonly kind: NodeKind;
  readonly createdAt: Date;
  readonly trashedAt: Date | null;
}

export interface NewFolder {
  readonly id: string;
  readonly ownerId: string;
  readonly parentId: string | null;
  readonly name: string;
  readonly now: Date;
}

const sameName = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

export function createFolder(input: NewFolder, siblings: readonly DriveNode[]): DriveNode {
  if (!isValidNodeName(input.name)) throw new InvalidNameError(input.name);
  const clash = siblings.some((s) => s.trashedAt === null && sameName(s.name, input.name));
  if (clash) throw new NameConflictError(input.name);
  return {
    id: input.id,
    ownerId: input.ownerId,
    parentId: input.parentId,
    name: input.name,
    kind: "folder",
    createdAt: input.now,
    trashedAt: null,
  };
}

export function moveToTrash(node: DriveNode, now: Date): DriveNode {
  return node.trashedAt === null ? { ...node, trashedAt: now } : node;
}

export function restoreFromTrash(node: DriveNode, siblings: readonly DriveNode[]): DriveNode {
  const clash = siblings.some(
    (s) => s.id !== node.id && s.trashedAt === null && sameName(s.name, node.name),
  );
  if (clash) throw new NameConflictError(node.name);
  return { ...node, trashedAt: null };
}

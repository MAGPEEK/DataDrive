import { InvalidNameError, NameConflictError } from "./errors.js";
import { isValidNodeName } from "./node-name.js";

export type NodeKind = "file" | "folder";

export interface DriveNode {
  readonly id: string;
  readonly ownerId: string;
  readonly parentId: string | null;
  readonly name: string;
  readonly kind: NodeKind;
  /** Size in bytes of the current version (0 for folders and empty files). */
  readonly size: number;
  readonly createdAt: Date;
  readonly modifiedAt: Date;
  readonly trashedAt: Date | null;
  /** Current file version; null for folders. */
  readonly versionId: string | null;
}

export interface FileVersion {
  readonly id: string;
  readonly nodeId: string;
  readonly size: number;
  /** Ordered SHA-256 hashes of the content blocks. */
  readonly blockHashes: readonly string[];
  /** Hash over the ordered block hashes; equal content gives an equal hash. */
  readonly contentHash: string;
  readonly createdAt: Date;
  readonly authorId: string;
}

export interface NewNode {
  readonly id: string;
  readonly ownerId: string;
  readonly parentId: string | null;
  readonly name: string;
  readonly now: Date;
}

const sameName = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

export function findLiveSibling(
  siblings: readonly DriveNode[],
  name: string,
): DriveNode | undefined {
  return siblings.find((s) => s.trashedAt === null && sameName(s.name, name));
}

function createNode(kind: NodeKind, input: NewNode, siblings: readonly DriveNode[]): DriveNode {
  if (!isValidNodeName(input.name)) throw new InvalidNameError(input.name);
  if (findLiveSibling(siblings, input.name) !== undefined) throw new NameConflictError(input.name);
  return {
    id: input.id,
    ownerId: input.ownerId,
    parentId: input.parentId,
    name: input.name,
    kind,
    size: 0,
    createdAt: input.now,
    modifiedAt: input.now,
    trashedAt: null,
    versionId: null,
  };
}

export const createFolder = (input: NewNode, siblings: readonly DriveNode[]): DriveNode =>
  createNode("folder", input, siblings);

export const createFile = (input: NewNode, siblings: readonly DriveNode[]): DriveNode =>
  createNode("file", input, siblings);

export function attachVersion(node: DriveNode, version: FileVersion): DriveNode {
  return { ...node, size: version.size, modifiedAt: version.createdAt, versionId: version.id };
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

import {
  NameConflictError,
  NotFoundError,
  QuotaExceededError,
  attachVersion,
  createFile,
  findLiveSibling,
  type Drive,
  type DriveNode,
  type FileVersion,
} from "@datadrive/domain";
import { requireNodeAccess, type Actor } from "./access.js";
import { resolveLocation, type Location } from "./folders.js";
import type { Dependencies } from "./ports.js";

export interface UploadCommand extends Location {
  readonly name: string;
  readonly content: AsyncIterable<Uint8Array>;
}

export interface UploadResult {
  readonly node: DriveNode;
  /** True if the upload created a new file, false if it added a version to an existing one. */
  readonly created: boolean;
}

export interface Download {
  readonly node: DriveNode;
  readonly drive: Drive;
  readonly version: FileVersion;
  readonly content: AsyncIterable<Uint8Array>;
}

function concat(chunks: readonly Uint8Array[], length: number): Uint8Array {
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Re-slices an arbitrary chunk stream into blocks of exactly `size` bytes (the last may be shorter). */
export async function* toBlocks(
  source: AsyncIterable<Uint8Array>,
  size: number,
): AsyncGenerator<Uint8Array> {
  let pending: Uint8Array = new Uint8Array(0);
  for await (const chunk of source) {
    pending = concat([pending, chunk], pending.length + chunk.length);
    while (pending.length >= size) {
      yield pending.slice(0, size);
      pending = pending.slice(size);
    }
  }
  if (pending.length > 0) yield pending;
}

interface StoredContent {
  readonly blockHashes: string[];
  readonly size: number;
}

async function storeBlocks(
  deps: Dependencies,
  content: AsyncIterable<Uint8Array>,
  maxBytes: number,
): Promise<StoredContent> {
  const blockHashes: string[] = [];
  let size = 0;
  for await (const block of toBlocks(content, deps.blockSize)) {
    size += block.length;
    if (size > maxBytes) throw new QuotaExceededError();
    const hash = deps.hasher.sha256(block);
    if (!(await deps.blocks.has(hash))) await deps.blocks.put(hash, block);
    blockHashes.push(hash);
  }
  return { blockHashes, size };
}

interface Target {
  readonly node: DriveNode;
  readonly created: boolean;
  readonly driveId: string;
}

async function resolveTarget(
  deps: Dependencies,
  actor: Actor,
  command: UploadCommand,
): Promise<Target> {
  const { driveId, parentId } = await resolveLocation(deps, actor, {
    ...command,
    permission: "write",
  });
  const siblings = await deps.nodes.listChildren(driveId, parentId);
  const existing = findLiveSibling(siblings, command.name);
  if (existing === undefined) {
    const input = {
      id: deps.ids.next(),
      driveId,
      parentId,
      name: command.name,
      now: deps.clock.now(),
    };
    return { node: createFile(input, siblings), created: true, driveId };
  }
  if (existing.kind !== "file") throw new NameConflictError(command.name);
  return { node: existing, created: false, driveId };
}

async function availableBytes(deps: Dependencies, target: Target): Promise<number> {
  const drive = await deps.drives.findById(target.driveId);
  if (drive === null || drive.quotaBytes === null) return Number.POSITIVE_INFINITY;
  const used = await deps.nodes.usedBytes(target.driveId);
  return Math.max(0, drive.quotaBytes - used + target.node.size);
}

interface NewVersion {
  readonly node: DriveNode;
  readonly stored: StoredContent;
  readonly authorId: string;
}

function newVersion(deps: Dependencies, input: NewVersion): FileVersion {
  const { node, stored, authorId } = input;
  const listing = new TextEncoder().encode(stored.blockHashes.join("\n"));
  return {
    id: deps.ids.next(),
    nodeId: node.id,
    size: stored.size,
    blockHashes: stored.blockHashes,
    contentHash: deps.hasher.sha256(listing),
    createdAt: deps.clock.now(),
    authorId,
  };
}

export async function uploadFileUseCase(
  deps: Dependencies,
  actor: Actor,
  command: UploadCommand,
): Promise<UploadResult> {
  const target = await resolveTarget(deps, actor, command);
  const stored = await storeBlocks(deps, command.content, await availableBytes(deps, target));
  const version = newVersion(deps, { node: target.node, stored, authorId: actor.id });
  if (target.created) await deps.nodes.save(target.node);
  await deps.versions.save(version);
  const node = attachVersion(target.node, version);
  await deps.nodes.save(node);
  return { node, created: target.created };
}

async function* readBlocks(deps: Dependencies, version: FileVersion): AsyncGenerator<Uint8Array> {
  for (const hash of version.blockHashes) yield await deps.blocks.get(hash);
}

export async function downloadFileUseCase(
  deps: Dependencies,
  actor: Actor,
  id: string,
): Promise<Download> {
  const { node, drive } = await requireNodeAccess(deps, actor, { nodeId: id, permission: "read" });
  if (node.kind !== "file" || node.trashedAt !== null) throw new NotFoundError(id);
  const version = node.versionId === null ? null : await deps.versions.findById(node.versionId);
  if (version === null) throw new NotFoundError(id);
  return { node, drive, version, content: readBlocks(deps, version) };
}

import {
  NameConflictError,
  NotFoundError,
  attachVersion,
  createFile,
  findLiveSibling,
  type DriveNode,
  type FileVersion,
} from "@datadrive/domain";
import type { Dependencies } from "./ports.js";

export interface UploadCommand {
  readonly ownerId: string;
  readonly parentId: string | null;
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
): Promise<StoredContent> {
  const blockHashes: string[] = [];
  let size = 0;
  for await (const block of toBlocks(content, deps.blockSize)) {
    const hash = deps.hasher.sha256(block);
    if (!(await deps.blocks.has(hash))) await deps.blocks.put(hash, block);
    blockHashes.push(hash);
    size += block.length;
  }
  return { blockHashes, size };
}

async function requireParentFolder(deps: Dependencies, command: UploadCommand): Promise<void> {
  if (command.parentId === null) return;
  const parent = await deps.nodes.findById(command.parentId);
  if (parent === null || parent.ownerId !== command.ownerId || parent.kind !== "folder") {
    throw new NotFoundError(command.parentId);
  }
}

async function resolveTarget(deps: Dependencies, command: UploadCommand): Promise<UploadResult> {
  const siblings = await deps.nodes.listChildren(command.ownerId, command.parentId);
  const existing = findLiveSibling(siblings, command.name);
  if (existing === undefined) {
    const input = { ...command, id: deps.ids.next(), now: deps.clock.now() };
    return { node: createFile(input, siblings), created: true };
  }
  if (existing.kind !== "file") throw new NameConflictError(command.name);
  return { node: existing, created: false };
}

export async function uploadFileUseCase(
  deps: Dependencies,
  command: UploadCommand,
): Promise<UploadResult> {
  await requireParentFolder(deps, command);
  const target = await resolveTarget(deps, command);
  const stored = await storeBlocks(deps, command.content);
  const listHash = deps.hasher.sha256(new TextEncoder().encode(stored.blockHashes.join("\n")));
  const version: FileVersion = {
    id: deps.ids.next(),
    nodeId: target.node.id,
    size: stored.size,
    blockHashes: stored.blockHashes,
    contentHash: listHash,
    createdAt: deps.clock.now(),
    authorId: command.ownerId,
  };
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
  ownerId: string,
  id: string,
): Promise<Download> {
  const node = await deps.nodes.findById(id);
  if (
    node === null ||
    node.ownerId !== ownerId ||
    node.kind !== "file" ||
    node.trashedAt !== null
  ) {
    throw new NotFoundError(id);
  }
  const version = node.versionId === null ? null : await deps.versions.findById(node.versionId);
  if (version === null) throw new NotFoundError(id);
  return { node, version, content: readBlocks(deps, version) };
}

import type { DriveNode, FileVersion } from "@datadrive/domain";

export interface NodeRepository {
  findById(id: string): Promise<DriveNode | null>;
  listChildren(ownerId: string, parentId: string | null): Promise<DriveNode[]>;
  save(node: DriveNode): Promise<void>;
}

export interface FileVersionRepository {
  findById(id: string): Promise<FileVersion | null>;
  save(version: FileVersion): Promise<void>;
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
  readonly blocks: BlockStore;
  readonly hasher: ContentHasher;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /** Size of one content block in bytes. */
  readonly blockSize: number;
}

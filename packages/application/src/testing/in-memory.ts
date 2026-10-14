import type { DriveNode, FileVersion } from "@datadrive/domain";
import { createHash } from "node:crypto";
import type {
  BlockStore,
  Clock,
  ContentHasher,
  Dependencies,
  FileVersionRepository,
  IdGenerator,
  NodeRepository,
} from "../ports.js";

export class InMemoryNodeRepository implements NodeRepository {
  private readonly store = new Map<string, DriveNode>();

  async findById(id: string): Promise<DriveNode | null> {
    return this.store.get(id) ?? null;
  }

  async listChildren(ownerId: string, parentId: string | null): Promise<DriveNode[]> {
    return [...this.store.values()].filter((n) => n.ownerId === ownerId && n.parentId === parentId);
  }

  async save(node: DriveNode): Promise<void> {
    this.store.set(node.id, node);
  }
}

export class InMemoryFileVersionRepository implements FileVersionRepository {
  private readonly store = new Map<string, FileVersion>();

  async findById(id: string): Promise<FileVersion | null> {
    return this.store.get(id) ?? null;
  }

  async save(version: FileVersion): Promise<void> {
    this.store.set(version.id, version);
  }
}

export class InMemoryBlockStore implements BlockStore {
  readonly blocks = new Map<string, Uint8Array>();

  async has(hash: string): Promise<boolean> {
    return this.blocks.has(hash);
  }

  async put(hash: string, data: Uint8Array): Promise<void> {
    this.blocks.set(hash, data);
  }

  async get(hash: string): Promise<Uint8Array> {
    const data = this.blocks.get(hash);
    if (data === undefined) throw new Error(`Missing block ${hash}`);
    return data;
  }
}

export class NodeCryptoHasher implements ContentHasher {
  sha256(data: Uint8Array): string {
    return createHash("sha256").update(data).digest("hex");
  }
}

export class FixedClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }

  advance(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}

export class SequentialIds implements IdGenerator {
  private counter = 0;

  next(): string {
    this.counter += 1;
    return `id-${this.counter}`;
  }
}

export function testDependencies(blockSize = 4): Dependencies {
  return {
    nodes: new InMemoryNodeRepository(),
    versions: new InMemoryFileVersionRepository(),
    blocks: new InMemoryBlockStore(),
    hasher: new NodeCryptoHasher(),
    clock: new FixedClock(new Date("2026-10-14T12:00:00Z")),
    ids: new SequentialIds(),
    blockSize,
  };
}

import type { DriveNode } from "@datadrive/domain";

export interface NodeRepository {
  findById(id: string): Promise<DriveNode | null>;
  listChildren(ownerId: string, parentId: string | null): Promise<DriveNode[]>;
  save(node: DriveNode): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

export interface Dependencies {
  readonly nodes: NodeRepository;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

import type { DriveNode } from "@datadrive/domain";
import type { Clock, Dependencies, IdGenerator, NodeRepository } from "../ports.js";

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

export function testDependencies(): Dependencies {
  return {
    nodes: new InMemoryNodeRepository(),
    clock: new FixedClock(new Date("2026-10-14T12:00:00Z")),
    ids: new SequentialIds(),
  };
}

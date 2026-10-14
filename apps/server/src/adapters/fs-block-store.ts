import type { BlockStore, StoredBlock } from "@datadrive/application";
import { randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  readdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";

const HASH_PATTERN = /^[0-9a-f]{64}$/u;

/** Stores blocks as files named after their SHA-256, sharded by the first two hex digits. */
export class FsBlockStore implements BlockStore {
  constructor(private readonly root: string) {}

  private pathFor(hash: string): string {
    if (!HASH_PATTERN.test(hash)) throw new Error("Invalid block hash");
    return join(this.root, hash.slice(0, 2), hash);
  }

  async has(hash: string): Promise<boolean> {
    try {
      await access(this.pathFor(hash));
      return true;
    } catch {
      return false;
    }
  }

  async put(hash: string, data: Uint8Array): Promise<void> {
    const target = this.pathFor(hash);
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, data);
    await rename(temporary, target);
  }

  async get(hash: string): Promise<Uint8Array> {
    return readFile(this.pathFor(hash));
  }

  async *list(): AsyncGenerator<StoredBlock> {
    for (const shard of await readdir(this.root).catch(() => [])) {
      for (const name of await readdir(join(this.root, shard))) {
        if (!HASH_PATTERN.test(name)) continue;
        const info = await stat(join(this.root, shard, name));
        yield { hash: name, modifiedAt: info.mtime };
      }
    }
  }

  async delete(hash: string): Promise<void> {
    await unlink(this.pathFor(hash)).catch(() => undefined);
  }
}

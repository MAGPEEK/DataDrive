import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NodeCryptoHasher } from "@datadrive/application";
import { FsBlockStore } from "./fs-block-store.js";

let dir: string;
let store: FsBlockStore;
const hasher = new NodeCryptoHasher();
const data = new TextEncoder().encode("block content");
const hash = hasher.sha256(data);

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "blocks-"));
  store = new FsBlockStore(dir);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("FsBlockStore", () => {
  it("stores and returns blocks", async () => {
    expect(await store.has(hash)).toBe(false);
    await store.put(hash, data);
    expect(await store.has(hash)).toBe(true);
    expect(new TextDecoder().decode(await store.get(hash))).toBe("block content");
  });

  it("shards by the first two hex digits and leaves no temporary files", async () => {
    await store.put(hash, data);
    expect(await readdir(dir)).toEqual([hash.slice(0, 2)]);
    expect(await readdir(join(dir, hash.slice(0, 2)))).toEqual([hash]);
  });

  it("is idempotent for the same block", async () => {
    await store.put(hash, data);
    await store.put(hash, data);
    expect(await readdir(join(dir, hash.slice(0, 2)))).toHaveLength(1);
  });

  it("rejects hashes that could escape the root", async () => {
    await expect(store.get("../../etc/passwd")).rejects.toThrow("Invalid block hash");
    await expect(store.put("zz", data)).rejects.toThrow("Invalid block hash");
    expect(await store.has("../x")).toBe(false);
  });
});

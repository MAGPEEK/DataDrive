import { NameConflictError, NotFoundError } from "@datadrive/domain";
import { describe, expect, it } from "vitest";
import { createFolderUseCase, trashNodeUseCase } from "./folders.js";
import { downloadFileUseCase, toBlocks, uploadFileUseCase } from "./files.js";
import { InMemoryBlockStore } from "./testing/in-memory.js";
import { createWorld } from "./testing/world.js";

const text = (s: string): Uint8Array => new TextEncoder().encode(s);

async function* chunks(...parts: string[]): AsyncGenerator<Uint8Array> {
  for (const part of parts) yield text(part);
}

async function collect(source: AsyncIterable<Uint8Array>): Promise<string> {
  let out = "";
  for await (const chunk of source) out += new TextDecoder().decode(chunk);
  return out;
}

async function setup(blockSize = 4) {
  const world = createWorld(blockSize);
  const alice = await world.user("alice");
  const put = (name: string, ...parts: string[]) =>
    uploadFileUseCase(world.deps, alice, { parentId: null, name, content: chunks(...parts) });
  return { world, alice, put, deps: world.deps };
}

describe("toBlocks", () => {
  it("re-slices arbitrary chunks into fixed-size blocks", async () => {
    const blocks: string[] = [];
    for await (const block of toBlocks(chunks("ab", "cdefg", "h"), 3)) {
      blocks.push(new TextDecoder().decode(block));
    }
    expect(blocks).toEqual(["abc", "def", "gh"]);
  });

  it("yields nothing for empty input", async () => {
    const blocks: Uint8Array[] = [];
    for await (const block of toBlocks(chunks(), 3)) blocks.push(block);
    expect(blocks).toEqual([]);
  });
});

describe("uploadFileUseCase", () => {
  it("creates a file with size, blocks and version", async () => {
    const { deps, put } = await setup(4);
    const { node, created } = await put("a.txt", "hello world");
    expect(created).toBe(true);
    expect(node).toMatchObject({ kind: "file", name: "a.txt", size: 11 });
    const version = await deps.versions.findById(node.versionId as string);
    expect(version?.blockHashes).toHaveLength(3);
  });

  it("adds a new version when the name already exists", async () => {
    const { put } = await setup();
    const first = (await put("a.txt", "one")).node;
    const second = await put("A.TXT", "two!");
    expect(second.created).toBe(false);
    expect(second.node.id).toBe(first.id);
    expect(second.node.size).toBe(4);
    expect(second.node.versionId).not.toBe(first.versionId);
  });

  it("stores identical blocks only once", async () => {
    const { deps, put } = await setup(4);
    await put("a.txt", "abcdabcdabcd");
    await put("b.txt", "abcd");
    expect((deps.blocks as InMemoryBlockStore).blocks.size).toBe(1);
  });

  it("supports empty files", async () => {
    const { put } = await setup();
    const { node } = await put("empty.txt");
    expect(node.size).toBe(0);
    expect(node.versionId).not.toBeNull();
  });

  it("refuses to overwrite a folder and rejects bad parents and names", async () => {
    const { deps, alice } = await setup();
    const folder = await createFolderUseCase(deps, alice, { parentId: null, name: "Docs" });
    const put = (name: string, parentId: string | null) =>
      uploadFileUseCase(deps, alice, { parentId, name, content: chunks("x") });
    await expect(put("docs", null)).rejects.toThrow(NameConflictError);
    await expect(put("x.txt", "missing")).rejects.toThrow(NotFoundError);
    await expect(put("a/b", null)).rejects.toThrow();
    expect((await put("ok.txt", folder.id)).created).toBe(true);
  });
});

describe("downloadFileUseCase", () => {
  it("returns the stored bytes", async () => {
    const { deps, alice, put } = await setup(4);
    const { node } = await put("a.txt", "hello ", "world");
    expect(await collect((await downloadFileUseCase(deps, alice, node.id)).content)).toBe(
      "hello world",
    );
  });

  it("serves the newest version", async () => {
    const { deps, alice, put } = await setup(4);
    const { node } = await put("a.txt", "old");
    await put("a.txt", "new content");
    expect(await collect((await downloadFileUseCase(deps, alice, node.id)).content)).toBe(
      "new content",
    );
  });

  it("hides files from other users, folders and trashed files", async () => {
    const { world, deps, alice, put } = await setup();
    const bob = await world.user("bob");
    const { node } = await put("a.txt", "x");
    await expect(downloadFileUseCase(deps, bob, node.id)).rejects.toThrow(NotFoundError);
    const folder = await createFolderUseCase(deps, alice, { parentId: null, name: "F" });
    await expect(downloadFileUseCase(deps, alice, folder.id)).rejects.toThrow(NotFoundError);
    await trashNodeUseCase(deps, alice, node.id);
    await expect(downloadFileUseCase(deps, alice, node.id)).rejects.toThrow(NotFoundError);
  });
});

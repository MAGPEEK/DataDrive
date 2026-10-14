import { NameConflictError, NotFoundError } from "@datadrive/domain";
import { describe, expect, it } from "vitest";
import { createFolderUseCase, trashNodeUseCase } from "./folders.js";
import { downloadFileUseCase, toBlocks, uploadFileUseCase } from "./files.js";
import { InMemoryBlockStore, testDependencies } from "./testing/in-memory.js";

const alice = "alice";
const text = (s: string): Uint8Array => new TextEncoder().encode(s);

async function* chunks(...parts: string[]): AsyncGenerator<Uint8Array> {
  for (const part of parts) yield text(part);
}

async function collect(source: AsyncIterable<Uint8Array>): Promise<string> {
  let out = "";
  for await (const chunk of source) out += new TextDecoder().decode(chunk);
  return out;
}

const upload = (deps = testDependencies(), name = "a.txt", ...parts: string[]) =>
  uploadFileUseCase(deps, { ownerId: alice, parentId: null, name, content: chunks(...parts) }).then(
    (result) => ({ deps, ...result }),
  );

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
    const { node, created, deps } = await upload(testDependencies(4), "a.txt", "hello world");
    expect(created).toBe(true);
    expect(node).toMatchObject({ kind: "file", name: "a.txt", size: 11 });
    const version = await deps.versions.findById(node.versionId as string);
    expect(version?.blockHashes).toHaveLength(3);
  });

  it("adds a new version when the name already exists", async () => {
    const { deps, node: first } = await upload(testDependencies(), "a.txt", "one");
    const second = await uploadFileUseCase(deps, {
      ownerId: alice,
      parentId: null,
      name: "A.TXT",
      content: chunks("two!"),
    });
    expect(second.created).toBe(false);
    expect(second.node.id).toBe(first.id);
    expect(second.node.size).toBe(4);
    expect(second.node.versionId).not.toBe(first.versionId);
  });

  it("stores identical blocks only once", async () => {
    const deps = testDependencies(4);
    await upload(deps, "a.txt", "abcdabcdabcd");
    await upload(deps, "b.txt", "abcd");
    expect((deps.blocks as InMemoryBlockStore).blocks.size).toBe(1);
  });

  it("supports empty files", async () => {
    const { node } = await upload(testDependencies(), "empty.txt");
    expect(node.size).toBe(0);
    expect(node.versionId).not.toBeNull();
  });

  it("refuses to overwrite a folder and rejects bad parents and names", async () => {
    const deps = testDependencies();
    const folder = await createFolderUseCase(deps, {
      ownerId: alice,
      parentId: null,
      name: "Docs",
    });
    const put = (name: string, parentId: string | null) =>
      uploadFileUseCase(deps, { ownerId: alice, parentId, name, content: chunks("x") });
    await expect(put("docs", null)).rejects.toThrow(NameConflictError);
    await expect(put("x.txt", "missing")).rejects.toThrow(NotFoundError);
    await expect(put("a/b", null)).rejects.toThrow();
    expect((await put("ok.txt", folder.id)).created).toBe(true);
  });
});

describe("downloadFileUseCase", () => {
  it("returns the stored bytes", async () => {
    const { deps, node } = await upload(testDependencies(4), "a.txt", "hello ", "world");
    const download = await downloadFileUseCase(deps, alice, node.id);
    expect(await collect(download.content)).toBe("hello world");
  });

  it("serves the newest version", async () => {
    const { deps, node } = await upload(testDependencies(4), "a.txt", "old");
    await uploadFileUseCase(deps, {
      ownerId: alice,
      parentId: null,
      name: "a.txt",
      content: chunks("new content"),
    });
    expect(await collect((await downloadFileUseCase(deps, alice, node.id)).content)).toBe(
      "new content",
    );
  });

  it("hides files from other users, folders and trashed files", async () => {
    const { deps, node } = await upload(testDependencies(), "a.txt", "x");
    await expect(downloadFileUseCase(deps, "bob", node.id)).rejects.toThrow(NotFoundError);
    const folder = await createFolderUseCase(deps, { ownerId: alice, parentId: null, name: "F" });
    await expect(downloadFileUseCase(deps, alice, folder.id)).rejects.toThrow(NotFoundError);
    await trashNodeUseCase(deps, alice, node.id);
    await expect(downloadFileUseCase(deps, alice, node.id)).rejects.toThrow(NotFoundError);
  });
});

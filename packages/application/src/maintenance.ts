import type { Dependencies } from "./ports.js";

export interface GarbageResult {
  readonly removed: number;
  readonly kept: number;
}

/**
 * Deletes blocks that no version refers to any more (left over from pruned versions or failed uploads).
 * Blocks younger than `graceMs` are kept: an upload stores its blocks before it saves the version.
 */
export async function collectGarbageUseCase(
  deps: Dependencies,
  graceMs: number,
): Promise<GarbageResult> {
  const referenced = await deps.versions.referencedBlockHashes();
  const cutoff = deps.clock.now().getTime() - graceMs;
  let removed = 0;
  let kept = 0;
  for await (const block of deps.blocks.list()) {
    if (referenced.has(block.hash) || block.modifiedAt.getTime() > cutoff) {
      kept += 1;
      continue;
    }
    await deps.blocks.delete(block.hash);
    removed += 1;
  }
  return { removed, kept };
}

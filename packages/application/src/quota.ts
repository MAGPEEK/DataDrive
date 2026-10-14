import type { DriveNode } from "@datadrive/domain";
import type { Dependencies } from "./ports.js";

/**
 * How many bytes a file in the drive may grow to: the free quota plus the space the file
 * already uses (it is being replaced). Infinity without a quota.
 */
export async function availableBytes(deps: Dependencies, node: DriveNode): Promise<number> {
  const drive = await deps.drives.findById(node.driveId);
  if (drive === null || drive.quotaBytes === null) return Number.POSITIVE_INFINITY;
  const used = await deps.nodes.usedBytes(node.driveId);
  return Math.max(0, drive.quotaBytes - used + node.size);
}

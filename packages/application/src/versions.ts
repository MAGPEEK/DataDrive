import {
  NotFoundError,
  QuotaExceededError,
  attachVersion,
  versionsToRemove,
  type Drive,
  type DriveNode,
  type FileVersion,
  type RetentionPolicy,
} from "@datadrive/domain";
import { requireNodeAccess, type Actor, type NodeNeed } from "./access.js";
import type { Dependencies } from "./ports.js";
import { availableBytes } from "./quota.js";

export interface VersionView {
  readonly version: FileVersion;
  readonly current: boolean;
  readonly authorName: string;
}

export interface VersionTarget {
  readonly nodeId: string;
  readonly versionId: string;
}

export const retentionOf = (drive: Drive): RetentionPolicy => ({
  mode: drive.settings.versionPolicy,
  maxVersions: drive.settings.maxVersions,
  retentionDays: drive.settings.retentionDays,
});

/** Deletes the versions the drive's retention policy no longer wants. Returns how many were removed. */
export async function pruneVersions(
  deps: Dependencies,
  node: DriveNode,
  drive: Drive,
): Promise<number> {
  const versions = await deps.versions.listForNode(node.id);
  const doomed = versionsToRemove(versions, {
    currentId: node.versionId,
    policy: retentionOf(drive),
    now: deps.clock.now(),
  });
  if (doomed.length > 0) await deps.versions.delete(doomed);
  return doomed.length;
}

async function requireFile(deps: Dependencies, actor: Actor, need: NodeNeed) {
  const access = await requireNodeAccess(deps, actor, need);
  if (access.node.kind !== "file") throw new NotFoundError(need.nodeId);
  return access;
}

export async function listVersionsUseCase(
  deps: Dependencies,
  actor: Actor,
  nodeId: string,
): Promise<VersionView[]> {
  const { node } = await requireFile(deps, actor, { nodeId, permission: "read" });
  const versions = await deps.versions.listForNode(node.id);
  const names = new Map<string, string>();
  for (const authorId of new Set(versions.map((v) => v.authorId))) {
    names.set(authorId, (await deps.users.findById(authorId))?.username ?? "?");
  }
  return versions.map((version) => ({
    version,
    current: version.id === node.versionId,
    authorName: names.get(version.authorId) ?? "?",
  }));
}

export async function findVersion(
  deps: Dependencies,
  node: DriveNode,
  versionId: string,
): Promise<FileVersion> {
  const version = await deps.versions.findById(versionId);
  if (version === null || version.nodeId !== node.id) throw new NotFoundError(versionId);
  return version;
}

/** Makes an old version the current one again by copying it as a new version (history stays intact). */
export async function restoreVersionUseCase(
  deps: Dependencies,
  actor: Actor,
  target: VersionTarget,
): Promise<DriveNode> {
  const { node, drive } = await requireFile(deps, actor, {
    nodeId: target.nodeId,
    permission: "write",
  });
  const old = await findVersion(deps, node, target.versionId);
  if (old.size > (await availableBytes(deps, node))) throw new QuotaExceededError();
  const restored: FileVersion = {
    ...old,
    id: deps.ids.next(),
    createdAt: deps.clock.now(),
    authorId: actor.id,
  };
  await deps.versions.save(restored);
  const updated = attachVersion(node, restored);
  await deps.nodes.save(updated);
  await pruneVersions(deps, updated, drive);
  return updated;
}

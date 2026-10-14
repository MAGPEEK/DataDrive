import { capabilitiesFor, type Capabilities, type Drive, type DriveNode } from "@datadrive/domain";
import { requireNodeAccess, roleIn, type Actor } from "./access.js";
import { ancestorsOf } from "./nodes-edit.js";
import type { Dependencies } from "./ports.js";

/** A node as one user sees it: with the star of that user and what they may do with it. */
export interface NodeView {
  readonly node: DriveNode;
  readonly starred: boolean;
  readonly capabilities: Capabilities;
}

const SEARCH_LIMIT = 100;
const RECENT_LIMIT = 50;

/** Ids of all drives the actor can open: the personal drive plus team drives they belong to. */
export async function accessibleDriveIds(deps: Dependencies, actor: Actor): Promise<string[]> {
  const memberships = await deps.memberships.teamRolesForUser(actor.id);
  return [actor.id, ...new Set(memberships.map((m) => m.driveId))];
}

async function capabilitiesPerDrive(
  deps: Dependencies,
  actor: Actor,
  nodes: readonly DriveNode[],
): Promise<Map<string, Capabilities>> {
  const result = new Map<string, Capabilities>();
  for (const driveId of new Set(nodes.map((n) => n.driveId))) {
    const drive: Drive | null = await deps.drives.findById(driveId);
    if (drive === null) continue;
    result.set(driveId, capabilitiesFor(await roleIn(deps, actor, driveId), drive.settings));
  }
  return result;
}

export async function describeNodes(
  deps: Dependencies,
  actor: Actor,
  nodes: readonly DriveNode[],
): Promise<NodeView[]> {
  const starred = await deps.stars.starredAmong(
    actor.id,
    nodes.map((n) => n.id),
  );
  const capabilities = await capabilitiesPerDrive(deps, actor, nodes);
  return nodes.flatMap((node) => {
    const caps = capabilities.get(node.driveId);
    return caps === undefined ? [] : [{ node, starred: starred.has(node.id), capabilities: caps }];
  });
}

export async function listRecentUseCase(deps: Dependencies, actor: Actor): Promise<DriveNode[]> {
  return deps.nodes.recentFiles(await accessibleDriveIds(deps, actor), RECENT_LIMIT);
}

export interface SearchCommand {
  readonly term: string;
  /** Limits the search to one drive; by default all accessible drives are searched. */
  readonly driveId?: string | undefined;
}

export async function searchUseCase(
  deps: Dependencies,
  actor: Actor,
  command: SearchCommand,
): Promise<DriveNode[]> {
  const term = command.term.trim();
  if (term === "") return [];
  const all = await accessibleDriveIds(deps, actor);
  const driveIds = command.driveId === undefined ? all : all.filter((id) => id === command.driveId);
  return deps.nodes.search(driveIds, term, SEARCH_LIMIT);
}

export async function listStarredUseCase(deps: Dependencies, actor: Actor): Promise<DriveNode[]> {
  const nodes = await deps.nodes.findByIds(await deps.stars.listStarredIds(actor.id));
  const readable: DriveNode[] = [];
  for (const node of nodes) {
    if (node.trashedAt !== null) continue;
    if ((await roleIn(deps, actor, node.driveId)) !== null) readable.push(node);
  }
  return readable;
}

export async function setStarUseCase(
  deps: Dependencies,
  actor: Actor,
  command: { readonly nodeId: string; readonly starred: boolean },
): Promise<void> {
  await requireNodeAccess(deps, actor, { nodeId: command.nodeId, permission: "read" });
  await deps.stars.set(actor.id, command.nodeId, command.starred);
}

/** The folders above a node, from the drive root down (for breadcrumbs). */
export async function pathOfUseCase(
  deps: Dependencies,
  actor: Actor,
  nodeId: string,
): Promise<DriveNode[]> {
  const { node } = await requireNodeAccess(deps, actor, { nodeId, permission: "read" });
  return (await ancestorsOf(deps, node)).reverse();
}

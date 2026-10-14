import {
  describeNodes,
  type Actor,
  type Dependencies,
  type NodeView,
} from "@datadrive/application";
import type { DriveNode, User } from "@datadrive/domain";
import type { FastifyRequest } from "fastify";

export const currentActor = (request: FastifyRequest): Actor => {
  const user = request.user as User;
  return { id: user.id, role: user.role };
};

export const toNodeDto = ({ node, starred, capabilities }: NodeView) => ({
  id: node.id,
  driveId: node.driveId,
  parentId: node.parentId,
  name: node.name,
  kind: node.kind,
  size: node.size,
  createdAt: node.createdAt.toISOString(),
  modifiedAt: node.modifiedAt.toISOString(),
  trashedAt: node.trashedAt?.toISOString() ?? null,
  starred,
  capabilities,
});

export async function viewsOf(
  deps: Dependencies,
  request: FastifyRequest,
  nodes: readonly DriveNode[],
) {
  const views = await describeNodes(deps, currentActor(request), nodes);
  return views.map(toNodeDto);
}

export async function viewOf(deps: Dependencies, request: FastifyRequest, node: DriveNode) {
  return (await viewsOf(deps, request, [node]))[0];
}

const nullableString = { type: ["string", "null"] } as const;

const capabilitiesSchema = {
  type: "object",
  properties: {
    canRead: { type: "boolean" },
    canWrite: { type: "boolean" },
    canDelete: { type: "boolean" },
    canRename: { type: "boolean" },
    canShare: { type: "boolean" },
    canDownload: { type: "boolean" },
  },
} as const;

export const nodeSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    driveId: { type: "string" },
    parentId: nullableString,
    name: { type: "string" },
    kind: { type: "string", enum: ["file", "folder"] },
    size: { type: "integer" },
    createdAt: { type: "string", format: "date-time" },
    modifiedAt: { type: "string", format: "date-time" },
    trashedAt: { type: ["string", "null"], format: "date-time" },
    starred: { type: "boolean" },
    capabilities: capabilitiesSchema,
  },
} as const;

export const nodeListSchema = { type: "array", items: nodeSchema } as const;

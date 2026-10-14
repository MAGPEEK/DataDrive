import {
  createFolderUseCase,
  listChildrenUseCase,
  restoreNodeUseCase,
  trashNodeUseCase,
  type Actor,
  type Dependencies,
} from "@datadrive/application";
import type { DriveNode, User } from "@datadrive/domain";
import type { FastifyInstance, FastifyRequest } from "fastify";

interface NodeDto {
  id: string;
  driveId: string;
  parentId: string | null;
  name: string;
  kind: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
  trashedAt: string | null;
}

export const toNodeDto = (node: DriveNode): NodeDto => ({
  id: node.id,
  driveId: node.driveId,
  parentId: node.parentId,
  name: node.name,
  kind: node.kind,
  size: node.size,
  createdAt: node.createdAt.toISOString(),
  modifiedAt: node.modifiedAt.toISOString(),
  trashedAt: node.trashedAt?.toISOString() ?? null,
});

export const currentActor = (request: FastifyRequest): Actor => {
  const user = request.user as User;
  return { id: user.id, role: user.role };
};

interface FolderBody {
  driveId?: string | null;
  parentId?: string | null;
  name: string;
}

interface IdParams {
  id: string;
}

const nullableString = { type: ["string", "null"] };

const nodeSchema = {
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
  },
} as const;

const folderSchema = {
  tags: ["nodes"],
  summary: "Create a folder",
  body: {
    type: "object",
    required: ["name"],
    properties: { driveId: nullableString, parentId: nullableString, name: { type: "string" } },
    additionalProperties: false,
  },
  response: { 201: nodeSchema },
};

const listSchema = {
  tags: ["nodes"],
  summary: "List the live children of a drive root or folder",
  querystring: {
    type: "object",
    properties: { driveId: { type: "string" }, parentId: { type: "string" } },
    additionalProperties: false,
  },
  response: { 200: { type: "array", items: nodeSchema } },
};

const trashSchema = {
  tags: ["nodes"],
  summary: "Move a node to the trash",
  response: { 200: nodeSchema },
};
const restoreSchema = {
  tags: ["nodes"],
  summary: "Restore a node from the trash",
  response: { 200: nodeSchema },
};

function registerFolderRoutes(app: FastifyInstance, deps: Dependencies): void {
  app.post<{ Body: FolderBody }>(
    "/api/v1/folders",
    { schema: folderSchema },
    async (req, reply) => {
      const { name, parentId = null, driveId } = req.body;
      const folder = await createFolderUseCase(deps, currentActor(req), {
        name,
        parentId,
        driveId: driveId ?? undefined,
      });
      return reply.status(201).send(toNodeDto(folder));
    },
  );

  app.get<{ Querystring: { driveId?: string; parentId?: string } }>(
    "/api/v1/nodes",
    { schema: listSchema },
    async (req) => {
      const { driveId, parentId = null } = req.query;
      const children = await listChildrenUseCase(deps, currentActor(req), { driveId, parentId });
      return children.map(toNodeDto);
    },
  );
}

function registerTrashRoutes(app: FastifyInstance, deps: Dependencies): void {
  app.post<{ Params: IdParams }>("/api/v1/nodes/:id/trash", { schema: trashSchema }, async (req) =>
    toNodeDto(await trashNodeUseCase(deps, currentActor(req), req.params.id)),
  );

  app.post<{ Params: IdParams }>(
    "/api/v1/nodes/:id/restore",
    { schema: restoreSchema },
    async (req) => toNodeDto(await restoreNodeUseCase(deps, currentActor(req), req.params.id)),
  );
}

export function registerNodeRoutes(app: FastifyInstance, deps: Dependencies): void {
  registerFolderRoutes(app, deps);
  registerTrashRoutes(app, deps);
}

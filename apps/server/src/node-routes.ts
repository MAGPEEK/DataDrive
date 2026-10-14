import {
  createFolderUseCase,
  listChildrenUseCase,
  restoreNodeUseCase,
  trashNodeUseCase,
  type Dependencies,
} from "@datadrive/application";
import type { DriveNode, User } from "@datadrive/domain";
import type { FastifyInstance, FastifyRequest } from "fastify";

interface NodeDto {
  id: string;
  parentId: string | null;
  name: string;
  kind: string;
  createdAt: string;
  trashedAt: string | null;
}

export const toNodeDto = (node: DriveNode): NodeDto => ({
  id: node.id,
  parentId: node.parentId,
  name: node.name,
  kind: node.kind,
  createdAt: node.createdAt.toISOString(),
  trashedAt: node.trashedAt?.toISOString() ?? null,
});

export const currentUserId = (request: FastifyRequest): string => (request.user as User).id;

interface FolderBody {
  parentId?: string | null;
  name: string;
}

interface IdParams {
  id: string;
}

const folderSchema = {
  body: {
    type: "object",
    required: ["name"],
    properties: { parentId: { type: ["string", "null"] }, name: { type: "string" } },
    additionalProperties: false,
  },
};

function registerFolderRoutes(app: FastifyInstance, deps: Dependencies): void {
  app.post<{ Body: FolderBody }>(
    "/api/v1/folders",
    { schema: folderSchema },
    async (req, reply) => {
      const { name, parentId = null } = req.body;
      const ownerId = currentUserId(req);
      const folder = await createFolderUseCase(deps, { ownerId, parentId, name });
      return reply.status(201).send(toNodeDto(folder));
    },
  );

  app.get<{ Querystring: { parentId?: string } }>("/api/v1/nodes", async (req) => {
    const children = await listChildrenUseCase(
      deps,
      currentUserId(req),
      req.query.parentId ?? null,
    );
    return children.map(toNodeDto);
  });
}

function registerTrashRoutes(app: FastifyInstance, deps: Dependencies): void {
  app.post<{ Params: IdParams }>("/api/v1/nodes/:id/trash", async (req) =>
    toNodeDto(await trashNodeUseCase(deps, currentUserId(req), req.params.id)),
  );

  app.post<{ Params: IdParams }>("/api/v1/nodes/:id/restore", async (req) =>
    toNodeDto(await restoreNodeUseCase(deps, currentUserId(req), req.params.id)),
  );
}

export function registerNodeRoutes(app: FastifyInstance, deps: Dependencies): void {
  registerFolderRoutes(app, deps);
  registerTrashRoutes(app, deps);
}

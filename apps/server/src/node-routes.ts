import {
  createFolderUseCase,
  listChildrenUseCase,
  restoreNodeUseCase,
  trashNodeUseCase,
  type Dependencies,
} from "@datadrive/application";
import type { DriveNode } from "@datadrive/domain";
import type { FastifyInstance, FastifyRequest } from "fastify";

export type Authenticate = (request: FastifyRequest) => string | null;

interface NodeDto {
  id: string;
  parentId: string | null;
  name: string;
  kind: string;
  createdAt: string;
  trashedAt: string | null;
}

const toDto = (node: DriveNode): NodeDto => ({
  id: node.id,
  parentId: node.parentId,
  name: node.name,
  kind: node.kind,
  createdAt: node.createdAt.toISOString(),
  trashedAt: node.trashedAt?.toISOString() ?? null,
});

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

function registerAuthentication(app: FastifyInstance, auth: Authenticate): void {
  app.addHook("preHandler", async (request, reply) => {
    if (!request.url.startsWith("/api/")) return;
    const userId = auth(request);
    if (userId === null) return reply.status(401).send({ error: "unauthorized" });
    request.userId = userId;
  });
}

function registerFolderRoutes(app: FastifyInstance, deps: Dependencies): void {
  app.post<{ Body: FolderBody }>(
    "/api/v1/folders",
    { schema: folderSchema },
    async (req, reply) => {
      const { name, parentId = null } = req.body;
      const folder = await createFolderUseCase(deps, { ownerId: req.userId, parentId, name });
      return reply.status(201).send(toDto(folder));
    },
  );

  app.get<{ Querystring: { parentId?: string } }>("/api/v1/nodes", async (req) => {
    const children = await listChildrenUseCase(deps, req.userId, req.query.parentId ?? null);
    return children.map(toDto);
  });
}

function registerTrashRoutes(app: FastifyInstance, deps: Dependencies): void {
  app.post<{ Params: IdParams }>("/api/v1/nodes/:id/trash", async (req) =>
    toDto(await trashNodeUseCase(deps, req.userId, req.params.id)),
  );

  app.post<{ Params: IdParams }>("/api/v1/nodes/:id/restore", async (req) =>
    toDto(await restoreNodeUseCase(deps, req.userId, req.params.id)),
  );
}

export function registerNodeRoutes(
  app: FastifyInstance,
  deps: Dependencies,
  auth: Authenticate,
): void {
  registerAuthentication(app, auth);
  registerFolderRoutes(app, deps);
  registerTrashRoutes(app, deps);
}

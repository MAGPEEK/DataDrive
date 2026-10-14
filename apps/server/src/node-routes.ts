import {
  createFolderUseCase,
  listChildrenUseCase,
  listTrashUseCase,
  moveNodeUseCase,
  renameNodeUseCase,
  restoreNodeUseCase,
  trashNodeUseCase,
  type Dependencies,
} from "@datadrive/application";
import type { FastifyInstance } from "fastify";
import { currentActor, nodeListSchema, nodeSchema, viewOf, viewsOf } from "./node-dto.js";

interface FolderBody {
  driveId?: string | null;
  parentId?: string | null;
  name: string;
}

interface IdParams {
  id: string;
}

const nullableString = { type: ["string", "null"] } as const;
const tags = ["nodes"];

const schemas = {
  createFolder: {
    tags,
    summary: "Create a folder",
    body: {
      type: "object",
      required: ["name"],
      properties: { driveId: nullableString, parentId: nullableString, name: { type: "string" } },
      additionalProperties: false,
    },
    response: { 201: nodeSchema },
  },
  list: {
    tags,
    summary: "List the live children of a drive root or folder",
    querystring: {
      type: "object",
      properties: { driveId: { type: "string" }, parentId: { type: "string" } },
      additionalProperties: false,
    },
    response: { 200: nodeListSchema },
  },
  trashList: {
    tags,
    summary: "List the trash of a drive (editors and managers)",
    querystring: {
      type: "object",
      properties: { driveId: { type: "string" } },
      additionalProperties: false,
    },
    response: { 200: nodeListSchema },
  },
  trash: { tags, summary: "Move a node to the trash", response: { 200: nodeSchema } },
  restore: { tags, summary: "Restore a node from the trash", response: { 200: nodeSchema } },
  rename: {
    tags,
    summary: "Rename a node",
    body: {
      type: "object",
      required: ["name"],
      properties: { name: { type: "string" } },
      additionalProperties: false,
    },
    response: { 200: nodeSchema },
  },
  move: {
    tags,
    summary: "Move a node into a folder of the same drive (parentId null = drive root)",
    body: {
      type: "object",
      required: ["parentId"],
      properties: { parentId: nullableString },
      additionalProperties: false,
    },
    response: { 200: nodeSchema },
  },
};

function registerReads(app: FastifyInstance, deps: Dependencies): void {
  app.get<{ Querystring: { driveId?: string; parentId?: string } }>(
    "/api/v1/nodes",
    { schema: schemas.list },
    async (req) => {
      const { driveId, parentId = null } = req.query;
      return viewsOf(
        deps,
        req,
        await listChildrenUseCase(deps, currentActor(req), { driveId, parentId }),
      );
    },
  );

  app.get<{ Querystring: { driveId?: string } }>(
    "/api/v1/trash",
    { schema: schemas.trashList },
    async (req) =>
      viewsOf(deps, req, await listTrashUseCase(deps, currentActor(req), req.query.driveId)),
  );
}

function registerCreate(app: FastifyInstance, deps: Dependencies): void {
  app.post<{ Body: FolderBody }>(
    "/api/v1/folders",
    { schema: schemas.createFolder },
    async (req, reply) => {
      const { name, parentId = null, driveId } = req.body;
      const folder = await createFolderUseCase(deps, currentActor(req), {
        name,
        parentId,
        driveId: driveId ?? undefined,
      });
      return reply.status(201).send(await viewOf(deps, req, folder));
    },
  );
}

function registerEdits(app: FastifyInstance, deps: Dependencies): void {
  app.patch<{ Params: IdParams; Body: { name: string } }>(
    "/api/v1/nodes/:id",
    { schema: schemas.rename },
    async (req) => {
      const command = { nodeId: req.params.id, name: req.body.name };
      return viewOf(deps, req, await renameNodeUseCase(deps, currentActor(req), command));
    },
  );

  app.post<{ Params: IdParams; Body: { parentId: string | null } }>(
    "/api/v1/nodes/:id/move",
    { schema: schemas.move },
    async (req) => {
      const command = { nodeId: req.params.id, targetParentId: req.body.parentId };
      return viewOf(deps, req, await moveNodeUseCase(deps, currentActor(req), command));
    },
  );
}

function registerTrash(app: FastifyInstance, deps: Dependencies): void {
  app.post<{ Params: IdParams }>(
    "/api/v1/nodes/:id/trash",
    { schema: schemas.trash },
    async (req) =>
      viewOf(deps, req, await trashNodeUseCase(deps, currentActor(req), req.params.id)),
  );

  app.post<{ Params: IdParams }>(
    "/api/v1/nodes/:id/restore",
    { schema: schemas.restore },
    async (req) =>
      viewOf(deps, req, await restoreNodeUseCase(deps, currentActor(req), req.params.id)),
  );
}

export function registerNodeRoutes(app: FastifyInstance, deps: Dependencies): void {
  registerReads(app, deps);
  registerCreate(app, deps);
  registerEdits(app, deps);
  registerTrash(app, deps);
}

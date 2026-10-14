import {
  listRecentUseCase,
  listStarredUseCase,
  pathOfUseCase,
  searchUseCase,
  setStarUseCase,
  type Dependencies,
} from "@datadrive/application";
import type { FastifyInstance } from "fastify";
import { currentActor, nodeListSchema, viewsOf } from "./node-dto.js";

const tags = ["discovery"];

interface IdParams {
  id: string;
}

const schemas = {
  recent: {
    tags,
    summary: "Recently modified files in all my drives",
    response: { 200: nodeListSchema },
  },
  starred: { tags, summary: "My starred items", response: { 200: nodeListSchema } },
  search: {
    tags,
    summary: "Search by name in all my drives (or one drive)",
    querystring: {
      type: "object",
      required: ["q"],
      properties: { q: { type: "string" }, driveId: { type: "string" } },
      additionalProperties: false,
    },
    response: { 200: nodeListSchema },
  },
  star: { tags, summary: "Star an item (personal)" },
  unstar: { tags, summary: "Remove the star of an item" },
  path: { tags, summary: "The folders above an item, from the drive root down" },
};

function registerLists(app: FastifyInstance, deps: Dependencies): void {
  app.get("/api/v1/recent", { schema: schemas.recent }, async (req) =>
    viewsOf(deps, req, await listRecentUseCase(deps, currentActor(req))),
  );

  app.get("/api/v1/starred", { schema: schemas.starred }, async (req) =>
    viewsOf(deps, req, await listStarredUseCase(deps, currentActor(req))),
  );
}

function registerSearch(app: FastifyInstance, deps: Dependencies): void {
  app.get<{ Querystring: { q: string; driveId?: string } }>(
    "/api/v1/search",
    { schema: schemas.search },
    async (req) => {
      const command = { term: req.query.q, driveId: req.query.driveId };
      return viewsOf(deps, req, await searchUseCase(deps, currentActor(req), command));
    },
  );
}

function registerStars(app: FastifyInstance, deps: Dependencies): void {
  const route = "/api/v1/nodes/:id/star";
  const handler =
    (starred: boolean) =>
    async (
      req: Parameters<typeof currentActor>[0] & { params: IdParams },
      reply: { status(code: number): { send(): unknown } },
    ) => {
      await setStarUseCase(deps, currentActor(req), { nodeId: req.params.id, starred });
      return reply.status(204).send();
    };

  app.put<{ Params: IdParams }>(route, { schema: schemas.star }, handler(true));
  app.delete<{ Params: IdParams }>(route, { schema: schemas.unstar }, handler(false));
}

function registerPath(app: FastifyInstance, deps: Dependencies): void {
  app.get<{ Params: IdParams }>("/api/v1/nodes/:id/path", { schema: schemas.path }, async (req) => {
    const folders = await pathOfUseCase(deps, currentActor(req), req.params.id);
    return folders.map((f) => ({ id: f.id, name: f.name }));
  });
}

export function registerDiscoveryRoutes(app: FastifyInstance, deps: Dependencies): void {
  registerLists(app, deps);
  registerSearch(app, deps);
  registerStars(app, deps);
  registerPath(app, deps);
}

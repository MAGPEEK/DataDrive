import {
  downloadVersionUseCase,
  listVersionsUseCase,
  restoreVersionUseCase,
  type Dependencies,
  type VersionView,
} from "@datadrive/application";
import type { FastifyInstance } from "fastify";
import { Readable } from "node:stream";
import { contentDisposition } from "./file-routes.js";
import { currentActor, nodeSchema, viewOf } from "./node-dto.js";

const tags = ["versions"];

interface VersionParams {
  id: string;
  versionId: string;
}

const versionSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    size: { type: "integer" },
    createdAt: { type: "string", format: "date-time" },
    authorName: { type: "string" },
    current: { type: "boolean" },
  },
} as const;

const toVersionDto = ({ version, current, authorName }: VersionView) => ({
  id: version.id,
  size: version.size,
  createdAt: version.createdAt.toISOString(),
  authorName,
  current,
});

const schemas = {
  list: {
    tags,
    summary: "The version history of a file, newest first",
    response: { 200: { type: "array", items: versionSchema } },
  },
  restore: {
    tags,
    summary: "Make an old version the current one again (copies it as a new version)",
    response: { 200: nodeSchema },
  },
  download: { tags, summary: "Download one version of a file as raw bytes" },
};

export function registerVersionRoutes(app: FastifyInstance, deps: Dependencies): void {
  app.get<{ Params: { id: string } }>(
    "/api/v1/files/:id/versions",
    { schema: schemas.list },
    async (req) =>
      (await listVersionsUseCase(deps, currentActor(req), req.params.id)).map(toVersionDto),
  );

  app.post<{ Params: VersionParams }>(
    "/api/v1/files/:id/versions/:versionId/restore",
    { schema: schemas.restore },
    async (req) => {
      const target = { nodeId: req.params.id, versionId: req.params.versionId };
      return viewOf(deps, req, await restoreVersionUseCase(deps, currentActor(req), target));
    },
  );

  app.get<{ Params: VersionParams }>(
    "/api/v1/files/:id/versions/:versionId/content",
    { schema: schemas.download },
    async (req, reply) => {
      const target = { nodeId: req.params.id, versionId: req.params.versionId };
      const download = await downloadVersionUseCase(deps, currentActor(req), target);
      return reply
        .header("content-type", "application/octet-stream")
        .header("content-length", download.version.size)
        .header("content-disposition", contentDisposition(download.node.name))
        .header("x-content-type-options", "nosniff")
        .send(Readable.from(download.content));
    },
  );
}

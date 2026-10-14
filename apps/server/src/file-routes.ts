import { downloadFileUseCase, uploadFileUseCase, type Dependencies } from "@datadrive/application";
import type { FastifyInstance } from "fastify";
import { Readable } from "node:stream";
import { currentActor, toNodeDto } from "./node-routes.js";

interface UploadQuery {
  driveId?: string;
  parentId?: string;
  name: string;
}

const uploadSchema = {
  tags: ["files"],
  summary: "Upload a file (creates it, or adds a version if the name exists). Body: raw bytes.",
  querystring: {
    type: "object",
    required: ["name"],
    properties: {
      driveId: { type: "string" },
      parentId: { type: "string" },
      name: { type: "string", minLength: 1 },
    },
    additionalProperties: false,
  },
};

const downloadSchema = {
  tags: ["files"],
  summary: "Download the current version of a file as raw bytes",
};

const UPLOAD_LIMIT_BYTES = 50 * 1024 ** 3;

function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/gu, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

function registerUpload(app: FastifyInstance, deps: Dependencies): void {
  app.addContentTypeParser("application/octet-stream", (_request, payload, done) => {
    done(null, payload);
  });

  app.put<{ Querystring: UploadQuery }>(
    "/api/v1/files",
    { schema: uploadSchema, bodyLimit: UPLOAD_LIMIT_BYTES },
    async (request, reply) => {
      const { name, parentId = null, driveId } = request.query;
      const content = request.body as AsyncIterable<Uint8Array>;
      const result = await uploadFileUseCase(deps, currentActor(request), {
        driveId,
        parentId,
        name,
        content,
      });
      return reply.status(result.created ? 201 : 200).send(toNodeDto(result.node));
    },
  );
}

function registerDownload(app: FastifyInstance, deps: Dependencies): void {
  app.get<{ Params: { id: string } }>(
    "/api/v1/files/:id/content",
    { schema: downloadSchema },
    async (request, reply) => {
      const download = await downloadFileUseCase(deps, currentActor(request), request.params.id);
      return reply
        .header("content-type", "application/octet-stream")
        .header("content-length", download.version.size)
        .header("content-disposition", contentDisposition(download.node.name))
        .header("etag", `"${download.version.contentHash}"`)
        .header("x-content-type-options", "nosniff")
        .send(Readable.from(download.content));
    },
  );
}

export function registerFileRoutes(app: FastifyInstance, deps: Dependencies): void {
  registerUpload(app, deps);
  registerDownload(app, deps);
}

import type { Dependencies } from "@datadrive/application";
import Fastify, { type FastifyInstance } from "fastify";
import { errorHandler } from "./http-errors.js";
import { registerNodeRoutes, type Authenticate } from "./node-routes.js";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}

export interface AppOptions {
  readonly deps: Dependencies;
  readonly authenticate: Authenticate;
}

export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: false });
  app.decorateRequest("userId", "");
  app.setErrorHandler(errorHandler);
  app.get("/health", async () => ({ status: "ok" }));
  registerNodeRoutes(app, options.deps, options.authenticate);
  return app;
}

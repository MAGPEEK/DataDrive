import type { AuthDependencies, Dependencies } from "@datadrive/application";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import Fastify, { type FastifyInstance } from "fastify";
import { registerAuthRoutes, registerAuthentication } from "./auth-routes.js";
import { registerFileRoutes } from "./file-routes.js";
import { errorHandler } from "./http-errors.js";
import { registerDiscoveryRoutes } from "./discovery-routes.js";
import { registerNodeRoutes } from "./node-routes.js";
import { registerTeamRoutes } from "./team-routes.js";

export interface AppOptions {
  readonly deps: Dependencies;
  readonly auth: AuthDependencies;
  readonly secureCookies?: boolean;
}

const API_INFO = {
  title: "DataDrive API",
  description:
    "REST API of DataDrive. Authenticate with the session cookie or a bearer token from /auth/login.",
  version: "0.1.0",
};

async function registerPlugins(app: FastifyInstance): Promise<void> {
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(swagger, {
    openapi: {
      info: API_INFO,
      components: { securitySchemes: { bearer: { type: "http", scheme: "bearer" } } },
      security: [{ bearer: [] }],
    },
  });
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  await registerPlugins(app);
  app.decorateRequest("user", null);
  registerAuthentication(app, options.auth);
  app.get("/health", { schema: { hide: true } }, async () => ({ status: "ok" }));
  app.get("/openapi.json", { schema: { hide: true } }, async () => app.swagger());
  registerAuthRoutes(app, options.auth, options.secureCookies ?? false);
  registerNodeRoutes(app, options.deps);
  registerDiscoveryRoutes(app, options.deps);
  registerFileRoutes(app, options.deps);
  registerTeamRoutes(app, options.deps);
  return app;
}

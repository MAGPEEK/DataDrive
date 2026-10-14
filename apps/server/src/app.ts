import type { AuthDependencies, Dependencies } from "@datadrive/application";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { registerAuthRoutes, registerAuthentication } from "./auth-routes.js";
import { errorHandler } from "./http-errors.js";
import { registerNodeRoutes } from "./node-routes.js";

export interface AppOptions {
  readonly deps: Dependencies;
  readonly auth: AuthDependencies;
  readonly secureCookies?: boolean;
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  app.decorateRequest("user", null);
  registerAuthentication(app, options.auth);
  app.get("/health", async () => ({ status: "ok" }));
  registerAuthRoutes(app, options.auth, options.secureCookies ?? false);
  registerNodeRoutes(app, options.deps);
  return app;
}

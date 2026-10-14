import {
  authenticateUseCase,
  beginTotpSetupUseCase,
  confirmTotpUseCase,
  createUserUseCase,
  loginUseCase,
  logoutUseCase,
  SESSION_TTL_MS,
  updateUserUseCase,
  type AuthDependencies,
} from "@datadrive/application";
import { ForbiddenError, type User } from "@datadrive/domain";
import type { FastifyInstance, FastifyRequest } from "fastify";

export const SESSION_COOKIE = "dd_session";

declare module "fastify" {
  interface FastifyRequest {
    user: User | null;
  }
}

interface UserDto {
  id: string;
  username: string;
  role: string;
  totpEnabled: boolean;
  disabled: boolean;
}

export const toUserDto = (user: User): UserDto => ({
  id: user.id,
  username: user.username,
  role: user.role,
  totpEnabled: user.totpEnabled,
  disabled: user.disabled,
});

export function readToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);
  return request.cookies[SESSION_COOKIE] ?? null;
}

export function registerAuthentication(app: FastifyInstance, deps: AuthDependencies): void {
  app.addHook("preHandler", async (request, reply) => {
    const isApi = request.url.startsWith("/api/");
    const token = readToken(request);
    request.user = token === null ? null : await authenticateUseCase(deps, token);
    if (isApi && request.user === null) return reply.status(401).send({ error: "unauthorized" });
  });
}

const loginSchema = {
  body: {
    type: "object",
    required: ["username", "password"],
    properties: {
      username: { type: "string" },
      password: { type: "string" },
      otp: { type: "string" },
    },
    additionalProperties: false,
  },
};

const rateLimit = { rateLimit: { max: 10, timeWindow: "1 minute" } };

function registerLogin(app: FastifyInstance, deps: AuthDependencies, secure: boolean): void {
  app.post<{ Body: { username: string; password: string; otp?: string } }>(
    "/auth/login",
    { schema: loginSchema, config: rateLimit },
    async (request, reply) => {
      const { token, user } = await loginUseCase(deps, request.body);
      void reply.setCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "strict",
        secure,
        path: "/",
        maxAge: SESSION_TTL_MS / 1000,
      });
      return { user: toUserDto(user), token };
    },
  );
}

function registerSession(app: FastifyInstance, deps: AuthDependencies): void {
  app.post("/auth/logout", async (request, reply) => {
    const token = readToken(request);
    if (token !== null) await logoutUseCase(deps, token);
    void reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.status(204).send();
  });

  app.get("/auth/me", async (request, reply) => {
    if (request.user === null) return reply.status(401).send({ error: "unauthorized" });
    return toUserDto(request.user);
  });
}

function registerTotp(app: FastifyInstance, deps: AuthDependencies): void {
  app.post("/api/v1/me/totp/setup", async (request) => {
    return beginTotpSetupUseCase(deps, (request.user as User).id);
  });

  app.post<{ Body: { code: string } }>(
    "/api/v1/me/totp/confirm",
    {
      schema: {
        body: { type: "object", required: ["code"], properties: { code: { type: "string" } } },
      },
    },
    async (request, reply) => {
      await confirmTotpUseCase(deps, (request.user as User).id, request.body.code);
      return reply.status(204).send();
    },
  );
}

const userChangeSchema = {
  body: {
    type: "object",
    properties: {
      role: { type: "string", enum: ["admin", "user"] },
      disabled: { type: "boolean" },
      password: { type: "string" },
    },
    additionalProperties: false,
  },
};

function registerUserEdit(app: FastifyInstance, deps: AuthDependencies): void {
  app.patch<{
    Params: { id: string };
    Body: { role?: "admin" | "user"; disabled?: boolean; password?: string };
  }>("/api/v1/users/:id", { schema: userChangeSchema }, async (request) => {
    const actor = request.user as User;
    if (actor.role !== "admin") throw new ForbiddenError();
    const changes = { userId: request.params.id, ...request.body };
    return toUserDto(await updateUserUseCase(deps, actor.id, changes));
  });
}

function registerUserAdmin(app: FastifyInstance, deps: AuthDependencies): void {
  app.get("/api/v1/users", async (request) => {
    if ((request.user as User).role !== "admin") throw new ForbiddenError();
    return (await deps.users.listAll()).map(toUserDto);
  });

  app.post<{ Body: { username: string; password: string; role?: "admin" | "user" } }>(
    "/api/v1/users",
    async (request, reply) => {
      if ((request.user as User).role !== "admin") throw new ForbiddenError();
      const { username, password, role = "user" } = request.body;
      const user = await createUserUseCase(deps, { username, password, role });
      return reply.status(201).send(toUserDto(user));
    },
  );
}

export function registerAuthRoutes(
  app: FastifyInstance,
  deps: AuthDependencies,
  secure: boolean,
): void {
  registerLogin(app, deps, secure);
  registerSession(app, deps);
  registerTotp(app, deps);
  registerUserAdmin(app, deps);
  registerUserEdit(app, deps);
}

import {
  createGroupUseCase,
  createTeamFolderUseCase,
  listAllTeamFoldersUseCase,
  listDrivesUseCase,
  listMembersUseCase,
  removeMemberUseCase,
  requireAdmin,
  setGroupMemberUseCase,
  setMemberUseCase,
  updateDriveUseCase,
  type Dependencies,
  type DriveOverview,
} from "@datadrive/application";
import type { Drive, DriveRole, SubjectType } from "@datadrive/domain";
import type { FastifyInstance } from "fastify";
import { currentActor } from "./node-routes.js";
import { driveSchemas, groupSchemas, memberSchemas } from "./team-schemas.js";

const toDriveDto = (drive: Drive) => ({
  id: drive.id,
  kind: drive.kind,
  name: drive.name,
  quotaBytes: drive.quotaBytes,
  settings: drive.settings,
});

const toOverviewDto = (o: DriveOverview) => ({
  ...toDriveDto(o.drive),
  role: o.role,
  usedBytes: o.usedBytes,
});

interface IdParams {
  id: string;
}

interface MemberBody {
  subjectType: SubjectType;
  subjectId: string;
  role: DriveRole;
}

interface GroupMemberParams extends IdParams {
  userId: string;
}

function registerDriveReads(app: FastifyInstance, deps: Dependencies): void {
  app.get("/api/v1/drives", { schema: driveSchemas.mine }, async (req) =>
    (await listDrivesUseCase(deps, currentActor(req))).map(toOverviewDto),
  );
  app.get("/api/v1/team-folders", { schema: driveSchemas.allTeams }, async (req) =>
    (await listAllTeamFoldersUseCase(deps, currentActor(req))).map(toDriveDto),
  );
}

function registerDriveWrites(app: FastifyInstance, deps: Dependencies): void {
  app.post<{ Body: { name: string } }>(
    "/api/v1/team-folders",
    { schema: driveSchemas.createTeam },
    async (req, reply) => {
      const drive = await createTeamFolderUseCase(deps, currentActor(req), req.body.name);
      return reply.status(201).send(toDriveDto(drive));
    },
  );

  app.patch<{ Params: IdParams; Body: { quotaBytes?: number | null; settings?: object } }>(
    "/api/v1/drives/:id",
    { schema: driveSchemas.update },
    async (req) => {
      const command = { driveId: req.params.id, ...req.body };
      return toDriveDto(await updateDriveUseCase(deps, currentActor(req), command));
    },
  );
}

function registerMemberReadsAndSets(app: FastifyInstance, deps: Dependencies): void {
  app.get<{ Params: IdParams }>(
    "/api/v1/drives/:id/members",
    { schema: memberSchemas.list },
    async (req) => listMembersUseCase(deps, currentActor(req), req.params.id),
  );

  app.put<{ Params: IdParams; Body: MemberBody }>(
    "/api/v1/drives/:id/members",
    { schema: memberSchemas.set },
    async (req, reply) => {
      await setMemberUseCase(deps, currentActor(req), { driveId: req.params.id, ...req.body });
      return reply.status(204).send();
    },
  );
}

function registerMemberRemoval(app: FastifyInstance, deps: Dependencies): void {
  app.delete<{ Params: IdParams & { type: SubjectType; subject: string } }>(
    "/api/v1/drives/:id/members/:type/:subject",
    { schema: memberSchemas.remove },
    async (req, reply) => {
      const { id, type, subject } = req.params;
      const command = { driveId: id, subjectType: type, subjectId: subject };
      await removeMemberUseCase(deps, currentActor(req), command);
      return reply.status(204).send();
    },
  );
}

function registerGroups(app: FastifyInstance, deps: Dependencies): void {
  app.post<{ Body: { name: string } }>(
    "/api/v1/groups",
    { schema: groupSchemas.create },
    async (req, reply) => {
      const group = await createGroupUseCase(deps, currentActor(req), req.body.name);
      return reply.status(201).send({ id: group.id, name: group.name });
    },
  );

  app.get("/api/v1/groups", { schema: groupSchemas.list }, async (req) => {
    requireAdmin(currentActor(req));
    return (await deps.groups.listAll()).map((g) => ({ id: g.id, name: g.name }));
  });
}

function registerGroupMembers(app: FastifyInstance, deps: Dependencies): void {
  const route = "/api/v1/groups/:id/members/:userId";
  const handler =
    (present: boolean) =>
    async (
      req: Parameters<typeof currentActor>[0] & { params: GroupMemberParams },
      reply: { status(code: number): { send(): unknown } },
    ) => {
      const update = { groupId: req.params.id, userId: req.params.userId, present };
      await setGroupMemberUseCase(deps, currentActor(req), update);
      return reply.status(204).send();
    };

  app.put<{ Params: GroupMemberParams }>(route, { schema: groupSchemas.addMember }, handler(true));
  app.delete<{ Params: GroupMemberParams }>(
    route,
    { schema: groupSchemas.removeMember },
    handler(false),
  );
}

export function registerTeamRoutes(app: FastifyInstance, deps: Dependencies): void {
  registerDriveReads(app, deps);
  registerDriveWrites(app, deps);
  registerMemberReadsAndSets(app, deps);
  registerMemberRemoval(app, deps);
  registerGroups(app, deps);
  registerGroupMembers(app, deps);
}

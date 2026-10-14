import type { DriveSettings, Group, Member, TeamFolder, User } from "../api/types";

export interface AdminReply {
  readonly status: number;
  readonly body?: unknown;
}

const DEFAULTS: DriveSettings = {
  restrictDownloads: false,
  watermark: false,
  fileLocking: false,
  maxVersions: 32,
  versionPolicy: "fifo",
  retentionDays: null,
};

const fail = (status: number, code: string): AdminReply => ({
  status,
  body: { error: code, message: code },
});

type Route = (match: RegExpExecArray, body: unknown) => AdminReply;

/** The administration endpoints of the fake server: users, groups, team folders and members. */
export class FakeAdmin {
  readonly users: User[] = [
    { id: "u1", username: "alice", role: "admin", totpEnabled: false, disabled: false },
    { id: "u2", username: "bob", role: "user", totpEnabled: false, disabled: false },
  ];
  readonly groups: Group[] = [];
  readonly folders: TeamFolder[] = [];
  readonly members = new Map<string, Member[]>();
  private counter = 0;

  private readonly routes: readonly [string, RegExp, Route][] = [
    ["GET", /^\/api\/v1\/users$/u, () => ({ status: 200, body: this.users })],
    [
      "POST",
      /^\/api\/v1\/users$/u,
      (_m, body) => this.createUser(body as User & { password: string }),
    ],
    [
      "PATCH",
      /^\/api\/v1\/users\/([^/]+)$/u,
      (m, body) => this.updateUser(m[1] ?? "", body as Partial<User>),
    ],
    ["GET", /^\/api\/v1\/groups$/u, () => ({ status: 200, body: this.groups })],
    [
      "POST",
      /^\/api\/v1\/groups$/u,
      (_m, body) => this.createGroup((body as { name: string }).name),
    ],
    ["GET", /^\/api\/v1\/team-folders$/u, () => ({ status: 200, body: this.folders })],
    [
      "POST",
      /^\/api\/v1\/team-folders$/u,
      (_m, body) => this.createFolder((body as { name: string }).name),
    ],
    [
      "PATCH",
      /^\/api\/v1\/drives\/([^/]+)$/u,
      (m, body) => this.updateFolder(m[1] ?? "", body as Changes),
    ],
    [
      "GET",
      /^\/api\/v1\/drives\/([^/]+)\/members$/u,
      (m) => ({ status: 200, body: this.members.get(m[1] ?? "") ?? [] }),
    ],
    [
      "PUT",
      /^\/api\/v1\/drives\/([^/]+)\/members$/u,
      (m, body) => this.setMember(m[1] ?? "", body as Member),
    ],
    [
      "DELETE",
      /^\/api\/v1\/drives\/([^/]+)\/members\/(user|group)\/([^/]+)$/u,
      (m) => this.removeMember(m),
    ],
  ];

  /** Answers the request, or returns null when it is not an administration route. */
  handle(method: string, path: string, body: unknown): AdminReply | null {
    for (const [verb, pattern, route] of this.routes) {
      const match = verb === method ? pattern.exec(path) : null;
      if (match !== null) return route(match, body);
    }
    return null;
  }

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}${this.counter}`;
  }

  private createUser(body: User & { password: string }): AdminReply {
    if (this.users.some((u) => u.username === body.username)) return fail(409, "username_taken");
    if (body.password.length < 10) return fail(400, "weak_password");
    const user: User = {
      id: this.nextId("x"),
      username: body.username,
      role: body.role,
      totpEnabled: false,
      disabled: false,
    };
    this.users.push(user);
    return { status: 201, body: user };
  }

  private updateUser(id: string, changes: Partial<User>): AdminReply {
    const index = this.users.findIndex((u) => u.id === id);
    const user = this.users[index];
    if (user === undefined) return fail(404, "not_found");
    if (id === "u1" && (changes.disabled === true || changes.role === "user")) {
      return fail(409, "own_account");
    }
    this.users[index] = {
      ...user,
      role: changes.role ?? user.role,
      disabled: changes.disabled ?? user.disabled,
    };
    return { status: 200, body: this.users[index] };
  }

  private createGroup(name: string): AdminReply {
    const group = { id: this.nextId("g"), name };
    this.groups.push(group);
    return { status: 201, body: group };
  }

  private createFolder(name: string): AdminReply {
    const folder: TeamFolder = {
      id: this.nextId("t"),
      name,
      quotaBytes: null,
      settings: DEFAULTS,
    };
    this.folders.push(folder);
    return { status: 201, body: folder };
  }

  private updateFolder(id: string, changes: Changes): AdminReply {
    const index = this.folders.findIndex((f) => f.id === id);
    const folder = this.folders[index];
    if (folder === undefined) return fail(404, "not_found");
    const quotaBytes = changes.quotaBytes === undefined ? folder.quotaBytes : changes.quotaBytes;
    this.folders[index] = {
      ...folder,
      quotaBytes,
      settings: { ...folder.settings, ...changes.settings },
    };
    return { status: 200, body: this.folders[index] };
  }

  private setMember(driveId: string, member: Member): AdminReply {
    const others = (this.members.get(driveId) ?? []).filter(
      (m) => !(m.subjectType === member.subjectType && m.subjectId === member.subjectId),
    );
    this.members.set(driveId, [...others, member]);
    return { status: 204 };
  }

  private removeMember(match: RegExpExecArray): AdminReply {
    const [, driveId = "", type = "", subject = ""] = match;
    const rest = (this.members.get(driveId) ?? []).filter(
      (m) => !(m.subjectType === type && m.subjectId === subject),
    );
    this.members.set(driveId, rest);
    return { status: 204 };
  }
}

interface Changes {
  readonly quotaBytes?: number | null;
  readonly settings?: Partial<DriveSettings>;
}

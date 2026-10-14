import { vi } from "vitest";
import type {
  Capabilities,
  DriveInfo,
  DriveRole,
  NodeInfo,
  Place,
  User,
  VersionInfo,
} from "../api/types";

export interface Call {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

interface Reply {
  readonly status: number;
  readonly body?: unknown;
}

export interface FakeBackendOptions {
  readonly signedIn?: boolean;
  readonly requireOtp?: boolean;
  readonly teamRole?: DriveRole | null;
  /** Makes list requests slow, to check that the UI reacts before the server answers. */
  readonly delayMs?: number;
}

const USER: User = { id: "u1", username: "alice", role: "user", totpEnabled: false };
const PASSWORD = "correct horse battery";
const OTP = "123456";
const NOW = "2026-10-14T12:00:00.000Z";
const FULL: Capabilities = {
  canRead: true,
  canWrite: true,
  canDelete: true,
  canRename: true,
  canShare: true,
  canDownload: true,
};
const READ_ONLY: Capabilities = {
  ...FULL,
  canWrite: false,
  canDelete: false,
  canRename: false,
  canShare: false,
};

const error = (status: number, code: string): Reply => ({
  status,
  body: { error: code, message: code },
});
const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** A small in-memory server that speaks the DataDrive API, for UI tests. */
export class FakeBackend {
  readonly calls: Call[] = [];
  readonly nodes: NodeInfo[] = [];
  private readonly history = new Map<string, VersionInfo[]>();
  private signedIn: boolean;
  private counter = 0;

  constructor(private readonly options: FakeBackendOptions = {}) {
    this.signedIn = options.signedIn ?? true;
  }

  install(): void {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string, init?: RequestInit) => this.handle(input, init)),
    );
  }

  addFolder(name: string, place: Partial<Place> = {}): NodeInfo {
    return this.add({ name, kind: "folder", size: 0 }, place);
  }

  addFile(name: string, size: number, place: Partial<Place> = {}): NodeInfo {
    return this.add({ name, kind: "file", size }, place);
  }

  find(name: string): NodeInfo | undefined {
    return this.nodes.find((n) => n.name === name);
  }

  private add(partial: Pick<NodeInfo, "name" | "kind" | "size">, place: Partial<Place>): NodeInfo {
    this.counter += 1;
    const driveId = place.driveId ?? "u1";
    const node: NodeInfo = {
      id: `n${this.counter}`,
      driveId,
      parentId: place.parentId ?? null,
      createdAt: NOW,
      modifiedAt: NOW,
      trashedAt: null,
      starred: false,
      capabilities: this.capabilitiesIn(driveId),
      ...partial,
    };
    this.nodes.push(node);
    return node;
  }

  private capabilitiesIn(driveId: string): Capabilities {
    return driveId === "t1" && this.options.teamRole === "viewer" ? READ_ONLY : FULL;
  }

  private drives(): DriveInfo[] {
    const personal: DriveInfo = {
      id: "u1",
      kind: "personal",
      name: "alice",
      quotaBytes: null,
      usedBytes: 2048,
      role: "manager",
    };
    const role = this.options.teamRole;
    if (role === undefined || role === null) return [personal];
    return [
      personal,
      { id: "t1", kind: "team", name: "Marketing", quotaBytes: 10_000, usedBytes: 500, role },
    ];
  }

  private async handle(input: string, init: RequestInit = {}): Promise<Response> {
    const url = new URL(input, "http://localhost");
    const method = init.method ?? "GET";
    const body = typeof init.body === "string" ? (JSON.parse(init.body) as unknown) : init.body;
    this.calls.push({ method, path: url.pathname + url.search, body });
    if (this.options.delayMs !== undefined && method === "GET") {
      await new Promise((resolve) => setTimeout(resolve, this.options.delayMs));
    }
    const reply = this.route(method, url, body);
    const text = reply.body === undefined ? "" : JSON.stringify(reply.body);
    return new Response(reply.status === 204 ? null : text, { status: reply.status });
  }

  private route(method: string, url: URL, body: unknown): Reply {
    const path = url.pathname;
    if (path === "/auth/login") return this.login(body as Record<string, string>);
    if (path === "/auth/me")
      return this.signedIn ? { status: 200, body: USER } : error(401, "unauthorized");
    if (path === "/auth/logout") return this.logout();
    if (!this.signedIn) return error(401, "unauthorized");
    return this.api(method, url, body);
  }

  private login(credentials: Record<string, string>): Reply {
    if (credentials.password !== PASSWORD) return error(401, "invalid_credentials");
    if (this.options.requireOtp === true) {
      if (credentials.otp === undefined) return error(401, "otp_required");
      if (credentials.otp !== OTP) return error(401, "invalid_credentials");
    }
    this.signedIn = true;
    return { status: 200, body: { user: USER, token: "t" } };
  }

  private logout(): Reply {
    this.signedIn = false;
    return { status: 204 };
  }

  private live(): NodeInfo[] {
    return this.nodes.filter((n) => n.trashedAt === null);
  }

  private api(method: string, url: URL, body: unknown): Reply {
    const path = url.pathname;
    const driveId = url.searchParams.get("driveId") ?? "u1";
    if (path === "/api/v1/drives") return { status: 200, body: this.drives() };
    if (path === "/api/v1/nodes") return this.list(driveId, url.searchParams.get("parentId"));
    if (path === "/api/v1/trash")
      return {
        status: 200,
        body: this.nodes.filter((n) => n.driveId === driveId && n.trashedAt !== null),
      };
    if (path === "/api/v1/recent")
      return { status: 200, body: this.live().filter((n) => n.kind === "file") };
    if (path === "/api/v1/starred")
      return { status: 200, body: this.live().filter((n) => n.starred) };
    if (path === "/api/v1/search") return this.search(url.searchParams.get("q") ?? "");
    if (path === "/api/v1/folders")
      return this.createFolder(body as { name: string; driveId: string; parentId: string | null });
    if (path === "/api/v1/files" && method === "PUT") return this.upload(url);
    if (path.startsWith("/api/v1/files/")) return this.versionRoute(path);
    return this.nodeRoute(method, path, body);
  }

  /** Gives a file an explicit history, newest first; the first entry is the current version. */
  setVersions(file: NodeInfo, sizes: readonly number[]): void {
    this.history.set(
      file.id,
      sizes.map((size, index) => ({
        id: `${file.id}-v${sizes.length - index}`,
        size,
        createdAt: `2026-10-0${sizes.length - index}T10:00:00.000Z`,
        authorName: "alice",
        current: index === 0,
      })),
    );
  }

  private versionsOf(fileId: string): VersionInfo[] {
    const known = this.history.get(fileId);
    if (known !== undefined) return known;
    const node = this.nodes.find((n) => n.id === fileId);
    return node === undefined ? [] : [this.single(node)];
  }

  private single(node: NodeInfo): VersionInfo {
    const id = `${node.id}-v1`;
    return { id, size: node.size, createdAt: node.modifiedAt, authorName: "alice", current: true };
  }

  private versionRoute(path: string): Reply {
    const match = /^\/api\/v1\/files\/([^/]+)\/versions(?:\/([^/]+)\/restore)?$/u.exec(path);
    const node = this.nodes.find((n) => n.id === match?.[1]);
    if (match === null || node === undefined) return error(404, "not_found");
    if (match[2] === undefined) return { status: 200, body: this.versionsOf(node.id) };
    return this.restoreVersion(node, match[2]);
  }

  private restoreVersion(node: NodeInfo, versionId: string): Reply {
    if (!node.capabilities.canWrite) return error(403, "forbidden");
    const list = this.versionsOf(node.id);
    const source = list.find((v) => v.id === versionId);
    if (source === undefined) return error(404, "not_found");
    const copy = { ...source, id: `${node.id}-v${list.length + 1}`, current: true };
    this.history.set(node.id, [copy, ...list.map((v) => ({ ...v, current: false }))]);
    return { status: 200, body: this.replace(node.id, (n) => ({ ...n, size: source.size })) };
  }

  private list(driveId: string, parentId: string | null): Reply {
    return {
      status: 200,
      body: this.live().filter((n) => n.driveId === driveId && n.parentId === parentId),
    };
  }

  private search(term: string): Reply {
    return {
      status: 200,
      body: this.live().filter((n) => n.name.toLowerCase().includes(term.toLowerCase())),
    };
  }

  private clash(name: string, driveId: string, parentId: string | null, ignoreId = ""): boolean {
    return this.live().some(
      (n) =>
        n.id !== ignoreId &&
        n.driveId === driveId &&
        n.parentId === parentId &&
        sameName(n.name, name),
    );
  }

  private createFolder(body: { name: string; driveId?: string; parentId?: string | null }): Reply {
    const place = { driveId: body.driveId ?? "u1", parentId: body.parentId ?? null };
    if (this.clash(body.name, place.driveId, place.parentId)) return error(409, "name_conflict");
    return { status: 201, body: this.addFolder(body.name, place) };
  }

  private upload(url: URL): Reply {
    const place = {
      driveId: url.searchParams.get("driveId") ?? "u1",
      parentId: url.searchParams.get("parentId"),
    };
    const name = url.searchParams.get("name") ?? "file";
    if (this.options.teamRole === "viewer" && place.driveId === "t1")
      return error(403, "forbidden");
    return { status: 201, body: this.addFile(name, 10, place) };
  }

  private replace(id: string, change: (node: NodeInfo) => NodeInfo): NodeInfo | null {
    const index = this.nodes.findIndex((n) => n.id === id);
    if (index < 0) return null;
    const updated = change(this.nodes[index] as NodeInfo);
    this.nodes[index] = updated;
    return updated;
  }

  private nodeRoute(method: string, path: string, body: unknown): Reply {
    const match = /^\/api\/v1\/nodes\/([^/]+)(?:\/(trash|restore|move|star|path))?$/u.exec(path);
    const node = this.nodes.find((n) => n.id === match?.[1]);
    if (match === null || node === undefined) return error(404, "not_found");
    const action = match[2];
    if (action === undefined) return this.rename(node, (body as { name: string }).name);
    if (action === "path") return { status: 200, body: this.pathOf(node) };
    if (action === "star") return this.star(node.id, method === "PUT");
    if (action === "move") return this.move(node, (body as { parentId: string | null }).parentId);
    return {
      status: 200,
      body: this.replace(node.id, (n) => ({ ...n, trashedAt: action === "trash" ? NOW : null })),
    };
  }

  private rename(node: NodeInfo, name: string): Reply {
    if (this.clash(name, node.driveId, node.parentId, node.id)) return error(409, "name_conflict");
    return { status: 200, body: this.replace(node.id, (n) => ({ ...n, name })) };
  }

  private move(node: NodeInfo, parentId: string | null): Reply {
    if (parentId === node.id) return error(400, "invalid_move");
    if (this.clash(node.name, node.driveId, parentId, node.id)) return error(409, "name_conflict");
    return { status: 200, body: this.replace(node.id, (n) => ({ ...n, parentId })) };
  }

  private star(id: string, starred: boolean): Reply {
    this.replace(id, (n) => ({ ...n, starred }));
    return { status: 204 };
  }

  private pathOf(node: NodeInfo): { id: string; name: string }[] {
    const chain: { id: string; name: string }[] = [];
    let parent = this.nodes.find((n) => n.id === node.parentId);
    while (parent !== undefined) {
      chain.unshift({ id: parent.id, name: parent.name });
      parent = this.nodes.find((n) => n.id === parent?.parentId);
    }
    return chain;
  }
}

export const TEST_PASSWORD = PASSWORD;
export const TEST_OTP = OTP;

import { vi } from "vitest";
import type { DriveInfo, DriveRole, NodeInfo, Place, User } from "../api/types";

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
}

const USER: User = { id: "u1", username: "alice", role: "user", totpEnabled: false };
const PASSWORD = "correct horse battery";
const OTP = "123456";
const NOW = "2026-10-14T12:00:00.000Z";

const error = (status: number, code: string): Reply => ({
  status,
  body: { error: code, message: code },
});

export class FakeBackend {
  readonly calls: Call[] = [];
  readonly nodes: NodeInfo[] = [];
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

  addFolder(name: string, driveId = "u1", parentId: string | null = null): NodeInfo {
    return this.add({ name, kind: "folder", driveId, parentId, size: 0 });
  }

  addFile(name: string, size: number, place: Partial<Place> = {}): NodeInfo {
    return this.add({
      name,
      kind: "file",
      driveId: place.driveId ?? "u1",
      parentId: place.parentId ?? null,
      size,
    });
  }

  private add(
    partial: Pick<NodeInfo, "name" | "kind" | "driveId" | "parentId" | "size">,
  ): NodeInfo {
    this.counter += 1;
    const node: NodeInfo = {
      id: `n${this.counter}`,
      createdAt: NOW,
      modifiedAt: NOW,
      trashedAt: null,
      ...partial,
    };
    this.nodes.push(node);
    return node;
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
    if (path === "/api/v1/folders")
      return this.createFolder(body as { name: string; driveId: string; parentId: string | null });
    if (path === "/api/v1/files" && method === "PUT") return this.upload(url);
    return this.nodeAction(path);
  }

  private list(driveId: string, parentId: string | null): Reply {
    const items = this.nodes.filter(
      (n) => n.driveId === driveId && n.parentId === parentId && n.trashedAt === null,
    );
    return { status: 200, body: items };
  }

  private createFolder(body: { name: string; driveId: string; parentId: string | null }): Reply {
    const clash = this.nodes.some(
      (n) =>
        n.driveId === body.driveId &&
        n.parentId === body.parentId &&
        n.trashedAt === null &&
        n.name.toLowerCase() === body.name.toLowerCase(),
    );
    if (clash) return error(409, "name_conflict");
    return { status: 201, body: this.addFolder(body.name, body.driveId, body.parentId) };
  }

  private upload(url: URL): Reply {
    const driveId = url.searchParams.get("driveId") ?? "u1";
    const node = this.addFile(url.searchParams.get("name") ?? "file", 10, {
      driveId,
      parentId: url.searchParams.get("parentId"),
    });
    return { status: 201, body: node };
  }

  private nodeAction(path: string): Reply {
    const match = /^\/api\/v1\/nodes\/([^/]+)\/(trash|restore)$/u.exec(path);
    const index = this.nodes.findIndex((n) => n.id === match?.[1]);
    if (match === null || index < 0) return error(404, "not_found");
    const node = this.nodes[index] as NodeInfo;
    const updated: NodeInfo = { ...node, trashedAt: match[2] === "trash" ? NOW : null };
    this.nodes[index] = updated;
    return { status: 200, body: updated };
  }
}

export const TEST_PASSWORD = PASSWORD;
export const TEST_OTP = OTP;

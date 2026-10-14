export type Role = "admin" | "user";
export type DriveRole = "viewer" | "editor" | "manager";

export interface User {
  readonly id: string;
  readonly username: string;
  readonly role: Role;
  readonly totpEnabled: boolean;
}

export interface DriveInfo {
  readonly id: string;
  readonly kind: "personal" | "team";
  readonly name: string;
  readonly quotaBytes: number | null;
  readonly usedBytes: number;
  readonly role: DriveRole;
}

export interface Capabilities {
  readonly canRead: boolean;
  readonly canWrite: boolean;
  readonly canDelete: boolean;
  readonly canRename: boolean;
  readonly canShare: boolean;
  readonly canDownload: boolean;
}

export interface NodeInfo {
  readonly id: string;
  readonly driveId: string;
  readonly parentId: string | null;
  readonly name: string;
  readonly kind: "file" | "folder";
  readonly size: number;
  readonly createdAt: string;
  readonly modifiedAt: string;
  readonly trashedAt: string | null;
  readonly starred: boolean;
  readonly capabilities: Capabilities;
}

export interface VersionInfo {
  readonly id: string;
  readonly size: number;
  readonly createdAt: string;
  readonly authorName: string;
  readonly current: boolean;
}

export type Place = {
  readonly driveId: string;
  readonly parentId: string | null;
};

export interface PathItem {
  readonly id: string;
  readonly name: string;
}

export type Role = "admin" | "user";
export type DriveRole = "viewer" | "editor" | "manager";

export interface User {
  readonly id: string;
  readonly username: string;
  readonly role: Role;
  readonly totpEnabled: boolean;
  readonly disabled?: boolean;
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

export type VersionPolicy = "fifo" | "intelligent";

export interface DriveSettings {
  readonly restrictDownloads: boolean;
  readonly watermark: boolean;
  readonly fileLocking: boolean;
  readonly maxVersions: number;
  readonly versionPolicy: VersionPolicy;
  readonly retentionDays: number | null;
}

/** A team folder as the admin console sees it. */
export interface TeamFolder {
  readonly id: string;
  readonly name: string;
  readonly quotaBytes: number | null;
  readonly settings: DriveSettings;
}

export interface Member {
  readonly subjectType: "user" | "group";
  readonly subjectId: string;
  readonly role: DriveRole;
}

export interface Group {
  readonly id: string;
  readonly name: string;
}

export interface DriveChanges {
  readonly quotaBytes?: number | null;
  readonly settings?: Partial<DriveSettings>;
}

export interface UserChanges {
  readonly role?: Role;
  readonly disabled?: boolean;
  readonly password?: string;
}

export interface NewUser {
  readonly username: string;
  readonly password: string;
  readonly role: Role;
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

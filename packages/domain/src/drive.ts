import { DomainError } from "./errors.js";

/**
 * A drive is a container for nodes: every user has one personal drive (same id as the user),
 * team folders are shared drives with members.
 */
export type DriveKind = "personal" | "team";
export type DriveRole = "viewer" | "editor" | "manager";
export type Permission = "read" | "write" | "manage";
export type SubjectType = "user" | "group";

export interface DriveSettings {
  readonly restrictDownloads: boolean;
  readonly watermark: boolean;
  readonly fileLocking: boolean;
  /** Maximum number of versions kept per file. */
  readonly maxVersions: number;
}

export interface Drive {
  readonly id: string;
  readonly kind: DriveKind;
  readonly name: string;
  /** Storage limit in bytes; null means unlimited. */
  readonly quotaBytes: number | null;
  readonly settings: DriveSettings;
  readonly createdAt: Date;
}

export interface Group {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;
}

export const DEFAULT_DRIVE_SETTINGS: DriveSettings = {
  restrictDownloads: false,
  watermark: false,
  fileLocking: false,
  maxVersions: 32,
};

const ROLE_RANK: Record<DriveRole, number> = { viewer: 1, editor: 2, manager: 3 };

const PERMISSIONS: Record<DriveRole, readonly Permission[]> = {
  viewer: ["read"],
  editor: ["read", "write"],
  manager: ["read", "write", "manage"],
};

export function roleAllows(role: DriveRole | null, permission: Permission): boolean {
  return role !== null && PERMISSIONS[role].includes(permission);
}

export function maxRole(roles: readonly DriveRole[]): DriveRole | null {
  return roles.reduce<DriveRole | null>(
    (best, role) => (best === null || ROLE_RANK[role] > ROLE_RANK[best] ? role : best),
    null,
  );
}

export function createPersonalDrive(userId: string, username: string, now: Date): Drive {
  return {
    id: userId,
    kind: "personal",
    name: username,
    quotaBytes: null,
    settings: DEFAULT_DRIVE_SETTINGS,
    createdAt: now,
  };
}

export class QuotaExceededError extends DomainError {
  constructor() {
    super("quota_exceeded", "The storage quota is exceeded");
  }
}

export class InvalidDriveNameError extends DomainError {
  constructor() {
    super("invalid_drive_name", "Name must have 1-100 characters");
  }
}

export function normalizeDriveName(input: string): string {
  const name = input.trim();
  if (name.length < 1 || name.length > 100) throw new InvalidDriveNameError();
  return name;
}

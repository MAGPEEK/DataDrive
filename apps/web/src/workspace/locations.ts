import type { NodeInfo, PathItem } from "../api/types";

/** Where the user currently is: a folder in a drive, or one of the virtual lists. */
export type Location =
  | { readonly kind: "drive"; readonly driveId: string; readonly trail: readonly PathItem[] }
  | { readonly kind: "recent" }
  | { readonly kind: "starred" }
  | { readonly kind: "trash"; readonly driveId: string }
  | { readonly kind: "search"; readonly term: string };

const toPathItem = (folder: NodeInfo): PathItem => ({ id: folder.id, name: folder.name });

export const driveRoot = (driveId: string): Location => ({ kind: "drive", driveId, trail: [] });

export function enterFolder(location: Location, folder: NodeInfo): Location {
  if (location.kind !== "drive") {
    return { kind: "drive", driveId: folder.driveId, trail: [toPathItem(folder)] };
  }
  return { ...location, trail: [...location.trail, toPathItem(folder)] };
}

export function popTo(location: Location, depth: number): Location {
  if (location.kind !== "drive") return location;
  return { ...location, trail: location.trail.slice(0, depth) };
}

/** The folder new items are created in; null if the location is a virtual list. */
export function currentFolder(
  location: Location,
): { driveId: string; parentId: string | null } | null {
  if (location.kind !== "drive") return null;
  return { driveId: location.driveId, parentId: location.trail.at(-1)?.id ?? null };
}

export function locationKey(location: Location): string {
  switch (location.kind) {
    case "drive":
      return `drive:${location.driveId}:${location.trail.map((f) => f.id).join("/")}`;
    case "trash":
      return `trash:${location.driveId}`;
    case "search":
      return `search:${location.term}`;
    default:
      return location.kind;
  }
}

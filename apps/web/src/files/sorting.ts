import type { NodeInfo } from "../api/types";

export type SortKey = "name" | "modified" | "size";
export type SortDirection = "asc" | "desc";

export interface Sort {
  readonly key: SortKey;
  readonly direction: SortDirection;
}

export const defaultSort: Sort = { key: "name", direction: "asc" };

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function compare(a: NodeInfo, b: NodeInfo, key: SortKey): number {
  if (key === "modified") return Date.parse(a.modifiedAt) - Date.parse(b.modifiedAt);
  if (key === "size") return a.size - b.size;
  return collator.compare(a.name, b.name);
}

/** Folders always come first, like in a file manager; the chosen key orders within each group. */
export function sortNodes(nodes: readonly NodeInfo[], sort: Sort): NodeInfo[] {
  const factor = sort.direction === "asc" ? 1 : -1;
  return [...nodes].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return compare(a, b, sort.key) * factor || collator.compare(a.name, b.name);
  });
}

export function toggleSort(current: Sort, key: SortKey): Sort {
  if (current.key !== key) return { key, direction: "asc" };
  return { key, direction: current.direction === "asc" ? "desc" : "asc" };
}

/** "New folder", then "New folder (2)", "New folder (3)" … that does not clash with existing names. */
export function uniqueName(base: string, existing: readonly string[]): string {
  const taken = new Set(existing.map((n) => n.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base} (${n})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

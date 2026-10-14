import type { FileVersion } from "./node.js";

/** How old versions are thinned out: plain first-in-first-out, or by age windows ("intelligent"). */
export type VersionPolicyMode = "fifo" | "intelligent";

export interface RetentionPolicy {
  readonly mode: VersionPolicyMode;
  /** Maximum number of versions per file, the current one included (1-32). */
  readonly maxVersions: number;
  /** Versions older than this many days are removed; null keeps them until the cap removes them. */
  readonly retentionDays: number | null;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Age windows of the intelligent mode: the newer a version, the finer the granularity.
 * Each window keeps only the newest version per time slot. (An interpretation: the exact rules of the
 * reference system are not documented and still have to be verified against it, see F4.2.)
 */
const WINDOWS: readonly { readonly upTo: number; readonly slot: number }[] = [
  { upTo: HOUR, slot: 0 },
  { upTo: DAY, slot: HOUR },
  { upTo: 30 * DAY, slot: DAY },
  { upTo: Number.POSITIVE_INFINITY, slot: 7 * DAY },
];

function slotKey(age: number, createdAt: number): string {
  const window = WINDOWS.find((w) => age <= w.upTo) ?? WINDOWS[WINDOWS.length - 1];
  if (window === undefined || window.slot === 0) return `all:${createdAt}`;
  return `${window.upTo}:${Math.floor(createdAt / window.slot)}`;
}

function thin(candidates: readonly FileVersion[], now: number): FileVersion[] {
  const seen = new Set<string>();
  return candidates.filter((version) => {
    const created = version.createdAt.getTime();
    const key = slotKey(now - created, created);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The ids of the versions to delete. The current version is never deleted; of the rest the newest
 * ones are kept as far as the policy allows.
 */
export interface RetentionContext {
  readonly currentId: string | null;
  readonly policy: RetentionPolicy;
  readonly now: Date;
}

export function versionsToRemove(
  versions: readonly FileVersion[],
  context: RetentionContext,
): string[] {
  const { currentId, policy, now } = context;
  const ordered = [...versions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const cutoff = policy.retentionDays === null ? null : now.getTime() - policy.retentionDays * DAY;
  const others = ordered.filter((v) => v.id !== currentId);
  const fresh = others.filter((v) => cutoff === null || v.createdAt.getTime() >= cutoff);
  const candidates = policy.mode === "intelligent" ? thin(fresh, now.getTime()) : fresh;
  const room = Math.max(0, policy.maxVersions - (currentId === null ? 0 : 1));
  const keep = new Set(candidates.slice(0, room).map((v) => v.id));
  return others.filter((v) => !keep.has(v.id)).map((v) => v.id);
}

import { describe, expect, it } from "vitest";
import type { FileVersion } from "./node.js";
import { versionsToRemove, type RetentionPolicy } from "./retention.js";

const now = new Date("2026-10-14T12:00:00Z");
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const version = (id: string, ageMs: number): FileVersion => ({
  id,
  nodeId: "n",
  size: 1,
  blockHashes: [],
  contentHash: id,
  createdAt: new Date(now.getTime() - ageMs),
  authorId: "u",
});

const fifo = (maxVersions: number, retentionDays: number | null = null): RetentionPolicy => ({
  mode: "fifo",
  maxVersions,
  retentionDays,
});

const removed = (versions: FileVersion[], currentId: string | null, policy: RetentionPolicy) =>
  versionsToRemove(versions, { currentId, policy, now }).sort();

describe("versionsToRemove (fifo)", () => {
  const versions = [
    version("v1", 4 * DAY),
    version("v2", 3 * DAY),
    version("v3", 2 * DAY),
    version("v4", DAY),
  ];

  it("removes nothing while under the cap", () => {
    expect(removed(versions, "v4", fifo(10))).toEqual([]);
  });

  it("removes the oldest versions beyond the cap", () => {
    expect(removed(versions, "v4", fifo(2))).toEqual(["v1", "v2"]);
    expect(removed(versions, "v4", fifo(1))).toEqual(["v1", "v2", "v3"]);
  });

  it("never removes the current version, even if it is the oldest", () => {
    expect(removed(versions, "v1", fifo(1))).toEqual(["v2", "v3", "v4"]);
  });

  it("removes versions older than the retention period", () => {
    expect(removed(versions, "v4", fifo(32, 2.5))).toEqual(["v1", "v2"]);
    expect(removed(versions, "v1", fifo(32, 2))).toEqual(["v2"]);
  });

  it("copes with a file without versions", () => {
    expect(removed([], null, fifo(5))).toEqual([]);
  });
});

describe("versionsToRemove (intelligent)", () => {
  const policy: RetentionPolicy = { mode: "intelligent", maxVersions: 32, retentionDays: null };

  it("keeps every version of the last hour", () => {
    const recent = [
      version("cur", MIN),
      version("a", 10 * MIN),
      version("b", 20 * MIN),
      version("c", 30 * MIN),
    ];
    expect(removed(recent, "cur", policy)).toEqual([]);
  });

  it("keeps the newest version of each hour within the last day", () => {
    const versions = [
      version("cur", MIN),
      version("same-hour-new", 3 * HOUR + 5 * MIN),
      version("same-hour-old", 3 * HOUR + 50 * MIN),
      version("other-hour", 6 * HOUR),
    ];
    expect(removed(versions, "cur", policy)).toEqual(["same-hour-old"]);
  });

  it("keeps one version per day within a month and one per week beyond", () => {
    const versions = [
      version("cur", MIN),
      version("day-new", 3 * DAY + HOUR),
      version("day-old", 3 * DAY + 2 * HOUR),
      version("week-new", 60 * DAY),
      version("week-old", 60 * DAY + HOUR),
    ];
    expect(removed(versions, "cur", policy)).toEqual(["day-old", "week-old"]);
  });

  it("still respects the cap and the retention period", () => {
    const many = Array.from({ length: 6 }, (_, i) => version(`v${i}`, (i + 1) * 5 * MIN));
    expect(removed(many, "v0", { ...policy, maxVersions: 3 })).toHaveLength(3);
    const old = [version("cur", MIN), version("old", 40 * DAY)];
    expect(removed(old, "cur", { ...policy, retentionDays: 30 })).toEqual(["old"]);
  });
});

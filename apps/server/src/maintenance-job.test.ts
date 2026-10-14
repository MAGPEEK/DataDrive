import { testDependencies } from "@datadrive/application";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startMaintenance } from "./maintenance-job.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("startMaintenance", () => {
  it("cleans up on every interval and stops when asked", async () => {
    vi.useFakeTimers();
    const deps = testDependencies();
    const spy = vi.spyOn(deps.versions, "referencedBlockHashes");
    const stop = startMaintenance(deps, { intervalMs: 1000, graceMs: 0, log: () => undefined });
    await vi.advanceTimersByTimeAsync(2500);
    expect(spy).toHaveBeenCalledTimes(2);
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("reports removed blocks and survives failures", async () => {
    vi.useFakeTimers();
    const deps = testDependencies();
    await deps.blocks.put("a".repeat(64), new Uint8Array([1]));
    const messages: string[] = [];
    startMaintenance(deps, { intervalMs: 1000, graceMs: 0, log: (m) => messages.push(m) });
    await vi.advanceTimersByTimeAsync(1100);
    expect(messages).toEqual(["Removed 1 unreferenced blocks"]);

    vi.spyOn(deps.versions, "referencedBlockHashes").mockRejectedValue(new Error("db down"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(messages.at(-1)).toContain("Block cleanup failed");
  });
});

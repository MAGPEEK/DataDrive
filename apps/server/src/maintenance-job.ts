import { collectGarbageUseCase, type Dependencies } from "@datadrive/application";

export interface MaintenanceOptions {
  readonly intervalMs: number;
  /** Blocks younger than this are never removed (uploads store blocks before they save the version). */
  readonly graceMs: number;
  readonly log: (message: string) => void;
}

/** Periodically deletes blocks that no version refers to. Returns a function that stops the job. */
export function startMaintenance(deps: Dependencies, options: MaintenanceOptions): () => void {
  const run = async (): Promise<void> => {
    try {
      const { removed } = await collectGarbageUseCase(deps, options.graceMs);
      if (removed > 0) options.log(`Removed ${removed} unreferenced blocks`);
    } catch (error) {
      options.log(`Block cleanup failed: ${String(error)}`);
    }
  };
  const timer = setInterval(() => void run(), options.intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

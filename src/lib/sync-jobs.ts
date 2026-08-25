import "server-only";
import { eq } from "drizzle-orm";
import { getDb, hasDatabase } from "@/db";
import { syncJobRuns } from "@/db/schema";

export async function runTrackedSyncJob<T>(input: {
  job: string;
  source: "SCHEDULED" | "MANUAL" | "RECOVERY";
  run: () => Promise<T>;
  recordsChanged?: (result: T) => number;
  details?: (result: T) => Record<string, unknown>;
}) {
  const startedAt = new Date();
  let runId: string | null = null;
  if (hasDatabase()) {
    const [row] = await getDb()
      .insert(syncJobRuns)
      .values({ job: input.job, source: input.source, attemptedAt: startedAt })
      .returning({ id: syncJobRuns.id });
    runId = row?.id || null;
  }
  try {
    const result = await input.run();
    if (runId) {
      const completedAt = new Date();
      await getDb()
        .update(syncJobRuns)
        .set({
          status: "SUCCESS",
          completedAt,
          durationMs: completedAt.getTime() - startedAt.getTime(),
          recordsChanged: input.recordsChanged?.(result) || 0,
          details: input.details?.(result) || {},
        })
        .where(eq(syncJobRuns.id, runId));
    }
    return result;
  } catch (error) {
    if (runId) {
      const completedAt = new Date();
      await getDb()
        .update(syncJobRuns)
        .set({
          status: "ERROR",
          completedAt,
          durationMs: completedAt.getTime() - startedAt.getTime(),
          error: error instanceof Error ? error.message.slice(0, 2_000) : String(error).slice(0, 2_000),
        })
        .where(eq(syncJobRuns.id, runId));
    }
    throw error;
  }
}

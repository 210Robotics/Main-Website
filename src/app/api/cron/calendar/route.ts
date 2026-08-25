import { NextRequest, NextResponse } from "next/server";
import { refreshCalendarEvents } from "@/lib/calendar";
import { runTrackedSyncJob } from "@/lib/sync-jobs";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runTrackedSyncJob({
      job: "GOOGLE_CALENDAR",
      source: "SCHEDULED",
      run: refreshCalendarEvents,
      recordsChanged: (value) => value.count,
      details: (value) => ({ syncedAt: value.syncedAt.toISOString() }),
    });
    return NextResponse.json({ ok: true, count: result.count, syncedAt: result.syncedAt });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Calendar synchronization failed." },
      { status: 500 },
    );
  }
}

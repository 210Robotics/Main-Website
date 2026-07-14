import { NextRequest, NextResponse } from "next/server";
import { hasDatabase } from "@/db";
import { syncDrivePhotos } from "@/lib/drive-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasDatabase()) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });

  try {
    return NextResponse.json(await syncDrivePhotos());
  } catch (error) {
    console.error("Scheduled Drive media sync failed", error);
    return NextResponse.json({ error: "Media sync failed" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { hasDatabase } from "@/db";
import { syncDrivePhotos } from "@/lib/drive-sync";
import { cleanupAbandonedFormUploads } from "@/lib/form-upload-cleanup";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasDatabase()) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });

  try {
    const [media, formUploads] = await Promise.all([
      syncDrivePhotos(),
      cleanupAbandonedFormUploads(),
    ]);
    return NextResponse.json({ ...media, formUploads });
  } catch (error) {
    console.error("Scheduled Drive media sync failed", error);
    return NextResponse.json({ error: "Media sync failed" }, { status: 500 });
  }
}

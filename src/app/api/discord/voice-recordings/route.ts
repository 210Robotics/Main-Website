import { timingSafeEqual } from "node:crypto";
import { put } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { members } from "@/db/schema";
import {
  allowedMeetingRecordingTypes,
  MAX_MEETING_RECORDING_BYTES,
  transcribeAndArchiveMeeting,
  type MeetingSpeakerTrack,
} from "@/lib/meeting-transcription";
import { privateBlobToken } from "@/lib/private-blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request) {
  const expected = process.env.DISCORD_VOICE_WORKER_SECRET;
  const received = request.headers.get("authorization")?.replace(
    /^Bearer\s+/i,
    "",
  );
  if (!expected || !received) return false;
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return (
    expectedBytes.length === receivedBytes.length &&
    timingSafeEqual(expectedBytes, receivedBytes)
  );
}

function text(formData: FormData, name: string, max: number) {
  return String(formData.get(name) || "").trim().slice(0, max);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (
    declaredLength &&
    declaredLength > MAX_MEETING_RECORDING_BYTES + 256 * 1024
  ) {
    return NextResponse.json(
      { error: "The voice recording is too large to archive." },
      { status: 413 },
    );
  }
  try {
    const formData = await request.formData();
    const memberId = text(formData, "memberId", 80);
    const guildId = text(formData, "guildId", 30);
    const channelId = text(formData, "channelId", 30);
    const title = text(formData, "title", 180);
    const speakerManifestText = text(
      formData,
      "speakerManifest",
      24_000,
    );
    const audio = formData.get("audio");
    if (
      !memberId ||
      !/^\d{15,22}$/.test(guildId) ||
      !/^\d{15,22}$/.test(channelId) ||
      title.length < 2 ||
      !(audio instanceof File)
    ) {
      return NextResponse.json(
        { error: "The completed voice session payload is invalid." },
        { status: 400 },
      );
    }
    if (
      audio.size <= 0 ||
      audio.size > MAX_MEETING_RECORDING_BYTES ||
      !allowedMeetingRecordingTypes.includes(
        audio.type as (typeof allowedMeetingRecordingTypes)[number],
      )
    ) {
      return NextResponse.json(
        { error: "Upload an MP3, M4A, WAV, OGG, WebM, or MP4 under 15 MB." },
        { status: 400 },
      );
    }
    const [member] = await getDb()
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.id, memberId), eq(members.status, "ACTIVE")))
      .limit(1);
    if (!member) {
      return NextResponse.json(
        { error: "The requesting portal member is no longer active." },
        { status: 403 },
      );
    }
    const filename = audio.name
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .slice(0, 180);
    const pathname =
      `uploads/meeting-recording/${member.id}/` +
      `${crypto.randomUUID()}-${filename || "discord-voice-recording.mp3"}`;
    const blob = await put(pathname, Buffer.from(await audio.arrayBuffer()), {
      access: "private",
      token: privateBlobToken(),
      contentType: audio.type,
      addRandomSuffix: true,
    });
    let speakerTracks: MeetingSpeakerTrack[] = [];
    if (speakerManifestText) {
      const parsed = JSON.parse(speakerManifestText) as unknown;
      if (!Array.isArray(parsed)) {
        return NextResponse.json(
          { error: "The speaker-track manifest is invalid." },
          { status: 400 },
        );
      }
      speakerTracks = parsed as MeetingSpeakerTrack[];
    }
    const result = await transcribeAndArchiveMeeting({
      memberId: member.id,
      guildId,
      title,
      pathname: blob.pathname,
      filename: filename || "discord-voice-recording.mp3",
      mimeType: audio.type,
      bytes: audio.size,
      speakerTracks,
    });
    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL || "https://210robotics.com"
    ).replace(/\/$/, "");
    return NextResponse.json({
      ok: true,
      recordingDocumentId: result.recordingId,
      transcriptDocumentId: result.transcriptId,
      transcriptMarkdownDocumentId: result.transcriptMarkdownId,
      recordingUrl: `${siteUrl}/api/internal-documents/${result.recordingId}/file`,
      transcriptUrl: `${siteUrl}/api/internal-documents/${result.transcriptId}/file`,
      transcriptMarkdownUrl: `${siteUrl}/api/internal-documents/${result.transcriptMarkdownId}/file`,
      botlogPublished: result.botlog.published,
      driveSynced: result.driveSynced,
    });
  } catch (error) {
    console.error("Discord voice recording archive failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The completed voice session could not be archived.",
      },
      { status: 500 },
    );
  }
}

import { timingSafeEqual } from "node:crypto";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { MAX_MEETING_SPEAKER_TRACK_BYTES } from "@/lib/meeting-transcription";
import { privateBlobToken } from "@/lib/private-blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
    declaredLength > MAX_MEETING_SPEAKER_TRACK_BYTES + 128 * 1024
  ) {
    return NextResponse.json(
      { error: "The speaker track is too large." },
      { status: 413 },
    );
  }
  try {
    const formData = await request.formData();
    const sessionId = text(formData, "sessionId", 80);
    const guildId = text(formData, "guildId", 30);
    const discordUserId = text(formData, "discordUserId", 30);
    const displayName = text(formData, "displayName", 120);
    const audio = formData.get("audio");
    if (
      !/^[0-9a-f-]{36}$/i.test(sessionId) ||
      !/^\d{15,22}$/.test(guildId) ||
      !/^\d{15,22}$/.test(discordUserId) ||
      !displayName ||
      !(audio instanceof File) ||
      audio.type !== "audio/mpeg" ||
      audio.size <= 0 ||
      audio.size > MAX_MEETING_SPEAKER_TRACK_BYTES
    ) {
      return NextResponse.json(
        { error: "The Discord speaker-track payload is invalid." },
        { status: 400 },
      );
    }
    const filename =
      audio.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 160) ||
      `${discordUserId}.mp3`;
    const blob = await put(
      `uploads/meeting-speaker-track/${sessionId}/${discordUserId}/${filename}`,
      Buffer.from(await audio.arrayBuffer()),
      {
        access: "private",
        token: privateBlobToken(),
        contentType: "audio/mpeg",
        addRandomSuffix: true,
      },
    );
    return NextResponse.json({
      pathname: blob.pathname,
      discordUserId,
      displayName,
      mimeType: "audio/mpeg",
      bytes: audio.size,
    });
  } catch (error) {
    console.error("Discord speaker-track upload failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The speaker track could not be uploaded.",
      },
      { status: 500 },
    );
  }
}

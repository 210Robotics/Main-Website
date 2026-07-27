import "server-only";

import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  auditEvents,
  discordGuildMembers,
  internalDocumentRevisions,
  internalDocuments,
} from "@/db/schema";
import { markdownToDocumentationHtml } from "@/lib/doc-format";
import { publishDiscordMeetingTranscript } from "@/lib/discord";
import { buildInternalDocumentFile } from "@/lib/exports/notebook-document";
import {
  DOCX_MIME,
  readPrivateBlob,
  safeDocumentName,
  sanitizeInternalDocumentHtml,
  saveInternalDocumentToDrive,
} from "@/lib/internal-documents";
import { privateBlobToken } from "@/lib/private-blob";
import { generateGeminiMediaText } from "@/lib/team-ai";

export const MAX_MEETING_RECORDING_BYTES = 15 * 1024 * 1024;
export const MAX_MEETING_SPEAKER_TRACK_BYTES = 8 * 1024 * 1024;
export const MAX_MEETING_SPEAKER_TRACKS = 12;
const MAX_MEETING_SPEAKER_TRACK_TOTAL_BYTES = 14 * 1024 * 1024;
const MARKDOWN_MIME = "text/markdown";

export const allowedMeetingRecordingTypes = [
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
  "video/mp4",
  "video/webm",
] as const;

export type MeetingSpeakerTrack = {
  discordUserId: string;
  displayName: string;
  pathname: string;
  mimeType: string;
  bytes: number;
};

const MEETING_RECORDINGS_DRIVE_FOLDER_ID =
  process.env.GOOGLE_DRIVE_RECORDING_FOLDER_ID ||
  "1r1OhDJ03Ia2XInJR7IfcT3Dqq4EaFy1K";

function transcriptHtml(transcript: string) {
  return sanitizeInternalDocumentHtml(markdownToDocumentationHtml(transcript));
}

async function archiveToDrive(input: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}) {
  try {
    return await saveInternalDocumentToDrive({
      ...input,
      folderId: MEETING_RECORDINGS_DRIVE_FOLDER_ID,
    });
  } catch (error) {
    console.error("Meeting archive Drive upload failed", error);
    return null;
  }
}

function validateSpeakerTracks(speakerTracks: MeetingSpeakerTrack[]) {
  if (speakerTracks.length > MAX_MEETING_SPEAKER_TRACKS) {
    throw new Error("Too many speaker tracks were included.");
  }
  const totalBytes = speakerTracks.reduce(
    (total, track) => total + track.bytes,
    0,
  );
  if (totalBytes > MAX_MEETING_SPEAKER_TRACK_TOTAL_BYTES) {
    throw new Error("The combined speaker tracks are too large.");
  }
  for (const track of speakerTracks) {
    if (
      !/^\d{15,22}$/.test(track.discordUserId) ||
      !track.pathname.startsWith("uploads/meeting-speaker-track/") ||
      track.mimeType !== "audio/mpeg" ||
      track.bytes <= 0 ||
      track.bytes > MAX_MEETING_SPEAKER_TRACK_BYTES
    ) {
      throw new Error("A speaker track could not be verified.");
    }
  }
}

async function transcribeMeeting(input: {
  memberId: string;
  guildId?: string;
  title: string;
  mimeType: string;
  recording: Buffer;
  speakerTracks: MeetingSpeakerTrack[];
}) {
  const speakerIds = [
    ...new Set(input.speakerTracks.map((track) => track.discordUserId)),
  ];
  const synchronizedSpeakers =
    input.guildId && speakerIds.length
      ? await getDb()
          .select({
            discordUserId: discordGuildMembers.discordUserId,
            displayName: discordGuildMembers.displayName,
          })
          .from(discordGuildMembers)
          .where(
            and(
              eq(discordGuildMembers.guildId, input.guildId),
              inArray(discordGuildMembers.discordUserId, speakerIds),
            ),
          )
      : [];
  const synchronizedNames = new Map(
    synchronizedSpeakers.map((speaker) => [
      speaker.discordUserId,
      speaker.displayName,
    ]),
  );

  try {
    const speakerMedia = await Promise.all(
      input.speakerTracks.map(async (track) => {
        const buffer = await readPrivateBlob(track.pathname);
        if (buffer.byteLength !== track.bytes) {
          throw new Error("A speaker track size could not be verified.");
        }
        return {
          label:
            synchronizedNames.get(track.discordUserId) ||
            track.displayName ||
            `Discord member ${track.discordUserId}`,
          mimeType: track.mimeType,
          buffer,
        };
      }),
    );
    const primaryMedia = speakerMedia[0] || {
      label: "Combined meeting recording",
      mimeType: input.mimeType,
      buffer: input.recording,
    };
    return await generateGeminiMediaText({
      system:
        "You transcribe consent-confirmed 210 Robotics meetings. A source labeled Combined meeting recording contains all participants. Every source labeled with a person's name is an isolated track containing only that Discord member, with original meeting-time silence preserved. Together, the isolated tracks contain the complete meeting. Treat person-name source labels as authoritative speaker identities. Be faithful to the recordings. Never invent speech, names, decisions, assignments, or deadlines. Mark unclear audio as [inaudible].",
      prompt:
        `Transcribe the meeting titled "${input.title}". Return Markdown with exactly these sections: ` +
        "Meeting summary, Decisions, Action items, and Full transcript. " +
        "In the Full transcript, merge all isolated tracks chronologically and format every spoken turn as " +
        "`[HH:MM:SS] **Exact speaker label:** words spoken`. Include an owner or due date in Action items only when actually stated. " +
        (speakerMedia.length
          ? "Do not use generic labels such as Speaker 1 when an isolated speaker label is available."
          : "No isolated speaker tracks are available, so consistently label distinguishable voices as Speaker 1, Speaker 2, and so on."),
      userId: input.memberId,
      feature: "discord-meeting-transcription",
      mimeType: primaryMedia.mimeType,
      buffer: primaryMedia.buffer,
      primaryMediaLabel: primaryMedia.label,
      additionalMedia: speakerMedia.slice(1),
    });
  } finally {
    if (input.speakerTracks.length) {
      await del(
        input.speakerTracks.map((track) => track.pathname),
        { token: privateBlobToken() },
      ).catch((error) =>
        console.error("Speaker track cleanup failed", error),
      );
    }
  }
}

export async function transcribeAndArchiveMeeting({
  memberId,
  guildId,
  title,
  pathname,
  filename,
  mimeType,
  bytes,
  speakerTracks = [],
}: {
  memberId: string;
  guildId?: string;
  title: string;
  pathname: string;
  filename: string;
  mimeType: string;
  bytes: number;
  speakerTracks?: MeetingSpeakerTrack[];
}) {
  if (!pathname.startsWith(`uploads/meeting-recording/${memberId}/`)) {
    throw new Error("Recording ownership could not be verified.");
  }
  if (
    !allowedMeetingRecordingTypes.includes(
      mimeType as (typeof allowedMeetingRecordingTypes)[number],
    )
  ) {
    throw new Error("Upload an MP3, M4A, WAV, OGG, WebM, or MP4 recording.");
  }
  if (bytes <= 0 || bytes > MAX_MEETING_RECORDING_BYTES) {
    throw new Error("Meeting recordings must be 15 MB or smaller.");
  }
  validateSpeakerTracks(speakerTracks);

  const recording = await readPrivateBlob(pathname);
  if (recording.byteLength !== bytes) {
    throw new Error("The uploaded recording size could not be verified.");
  }
  const cleanTitle = title.trim().slice(0, 180);
  const transcript = await transcribeMeeting({
    memberId,
    guildId,
    title: cleanTitle,
    mimeType,
    recording,
    speakerTracks,
  });
  const contentHtml = transcriptHtml(transcript);
  const recordingId = randomUUID();
  const transcriptDocxId = randomUUID();
  const transcriptMarkdownId = randomUUID();
  const recordingName = safeDocumentName(filename);
  const transcriptDocxName = safeDocumentName(
    `${cleanTitle}-transcript.docx`,
  );
  const transcriptMarkdownName = safeDocumentName(
    `${cleanTitle}-transcript.md`,
  );
  const transcriptMarkdownBuffer = Buffer.from(
    `# ${cleanTitle} transcript\n\n${transcript.trim()}\n`,
    "utf8",
  );
  const transcriptDocxBuffer = await buildInternalDocumentFile({
    title: `${cleanTitle} transcript`,
    description:
      "Speaker-attributed Gemini transcript generated from Discord audio.",
    contentHtml,
  });
  const [transcriptDocxBlob, transcriptMarkdownBlob] = await Promise.all([
    put(
      `internal-documents/${transcriptDocxId}/source/${transcriptDocxName}`,
      transcriptDocxBuffer,
      {
        access: "private",
        token: privateBlobToken(),
        contentType: DOCX_MIME,
        addRandomSuffix: true,
      },
    ),
    put(
      `internal-documents/${transcriptMarkdownId}/source/${transcriptMarkdownName}`,
      transcriptMarkdownBuffer,
      {
        access: "private",
        token: privateBlobToken(),
        contentType: MARKDOWN_MIME,
        addRandomSuffix: true,
      },
    ),
  ]);
  const [recordingDrive, transcriptDocxDrive, transcriptMarkdownDrive] =
    await Promise.all([
      archiveToDrive({
        buffer: recording,
        filename: recordingName,
        mimeType,
      }),
      archiveToDrive({
        buffer: transcriptDocxBuffer,
        filename: transcriptDocxName,
        mimeType: DOCX_MIME,
      }),
      archiveToDrive({
        buffer: transcriptMarkdownBuffer,
        filename: transcriptMarkdownName,
        mimeType: MARKDOWN_MIME,
      }),
    ]);
  const now = new Date();
  const db = getDb();
  await db.insert(internalDocuments).values([
    {
      id: recordingId,
      title: `${cleanTitle} recording`,
      description:
        "Meeting recording uploaded by an administrator after confirming participant consent.",
      category: "Meeting recordings",
      originalFilename: recordingName,
      mimeType,
      bytes: recording.byteLength,
      pathname,
      contentHtml:
        "<p>This consent-confirmed meeting recording is available from the secure document archive.</p>",
      editable: false,
      storageProvider: recordingDrive ? "BLOB_AND_DRIVE" : "BLOB",
      driveFileId: recordingDrive?.id || null,
      driveWebViewLink: recordingDrive?.webViewLink || null,
      driveModifiedAt: recordingDrive?.modifiedTime
        ? new Date(recordingDrive.modifiedTime)
        : null,
      driveSyncStatus: recordingDrive ? "SYNCED" : "LOCAL_ONLY",
      createdByMemberId: memberId,
      updatedByMemberId: memberId,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: transcriptDocxId,
      title: `${cleanTitle} transcript (Word)`,
      description:
        "Editable speaker-attributed Gemini transcript in Word format.",
      category: "Meeting transcripts",
      originalFilename: transcriptDocxName,
      mimeType: DOCX_MIME,
      bytes: transcriptDocxBuffer.byteLength,
      pathname: transcriptDocxBlob.pathname,
      contentHtml,
      editable: true,
      storageProvider: transcriptDocxDrive ? "BLOB_AND_DRIVE" : "BLOB",
      driveFileId: transcriptDocxDrive?.id || null,
      driveWebViewLink: transcriptDocxDrive?.webViewLink || null,
      driveModifiedAt: transcriptDocxDrive?.modifiedTime
        ? new Date(transcriptDocxDrive.modifiedTime)
        : null,
      driveSyncStatus: transcriptDocxDrive ? "SYNCED" : "LOCAL_ONLY",
      createdByMemberId: memberId,
      updatedByMemberId: memberId,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: transcriptMarkdownId,
      title: `${cleanTitle} transcript (Markdown)`,
      description:
        "Speaker-attributed Gemini transcript in portable Markdown format.",
      category: "Meeting transcripts",
      originalFilename: transcriptMarkdownName,
      mimeType: MARKDOWN_MIME,
      bytes: transcriptMarkdownBuffer.byteLength,
      pathname: transcriptMarkdownBlob.pathname,
      contentHtml,
      editable: true,
      storageProvider: transcriptMarkdownDrive ? "BLOB_AND_DRIVE" : "BLOB",
      driveFileId: transcriptMarkdownDrive?.id || null,
      driveWebViewLink: transcriptMarkdownDrive?.webViewLink || null,
      driveModifiedAt: transcriptMarkdownDrive?.modifiedTime
        ? new Date(transcriptMarkdownDrive.modifiedTime)
        : null,
      driveSyncStatus: transcriptMarkdownDrive ? "SYNCED" : "LOCAL_ONLY",
      createdByMemberId: memberId,
      updatedByMemberId: memberId,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  await db.insert(internalDocumentRevisions).values([
    {
      documentId: transcriptDocxId,
      versionNumber: 1,
      title: `${cleanTitle} transcript (Word)`,
      description:
        "Speaker-attributed transcript generated by Gemini from Discord audio.",
      category: "Meeting transcripts",
      contentHtml,
      reason: "Initial meeting transcription",
      editorMemberId: memberId,
    },
    {
      documentId: transcriptMarkdownId,
      versionNumber: 1,
      title: `${cleanTitle} transcript (Markdown)`,
      description:
        "Speaker-attributed transcript generated by Gemini from Discord audio.",
      category: "Meeting transcripts",
      contentHtml,
      reason: "Initial meeting transcription",
      editorMemberId: memberId,
    },
  ]);
  await db.insert(auditEvents).values({
    actorMemberId: memberId,
    action: "MEETING_RECORDING_TRANSCRIBED",
    entityType: "internal_document",
    entityId: transcriptDocxId,
    details: {
      recordingDocumentId: recordingId,
      markdownDocumentId: transcriptMarkdownId,
      consentConfirmed: true,
      mimeType,
      bytes: recording.byteLength,
      speakerTrackCount: speakerTracks.length,
      driveRecording: Boolean(recordingDrive),
      driveTranscriptDocx: Boolean(transcriptDocxDrive),
      driveTranscriptMarkdown: Boolean(transcriptMarkdownDrive),
    },
  });
  const botlog = await publishDiscordMeetingTranscript({
    guildId,
    title: cleanTitle,
    transcript,
    recordingDocumentId: recordingId,
    transcriptDocxDocumentId: transcriptDocxId,
    transcriptMarkdownDocumentId: transcriptMarkdownId,
  }).catch((error: unknown) => ({
    published: false,
    reason:
      error instanceof Error ? error.message : "Botlog publication failed.",
  }));
  return {
    transcriptId: transcriptDocxId,
    transcriptMarkdownId,
    recordingId,
    driveSynced: Boolean(
      recordingDrive && transcriptDocxDrive && transcriptMarkdownDrive,
    ),
    botlog,
  };
}

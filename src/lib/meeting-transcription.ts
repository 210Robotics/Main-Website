import "server-only";

import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { getDb } from "@/db";
import {
  auditEvents,
  internalDocumentRevisions,
  internalDocuments,
} from "@/db/schema";
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

const MEETING_RECORDINGS_DRIVE_FOLDER_ID =
  process.env.GOOGLE_DRIVE_RECORDING_FOLDER_ID ||
  "1r1OhDJ03Ia2XInJR7IfcT3Dqq4EaFy1K";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function transcriptHtml(transcript: string) {
  const lines = transcript.replace(/\r\n?/g, "\n").split("\n");
  const html = lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "<p><br></p>";
      if (trimmed.startsWith("### "))
        return `<h3>${escapeHtml(trimmed.slice(4))}</h3>`;
      if (trimmed.startsWith("## "))
        return `<h2>${escapeHtml(trimmed.slice(3))}</h2>`;
      if (trimmed.startsWith("# "))
        return `<h1>${escapeHtml(trimmed.slice(2))}</h1>`;
      if (/^[-*]\s+/.test(trimmed))
        return `<p>• ${escapeHtml(trimmed.replace(/^[-*]\s+/, ""))}</p>`;
      return `<p>${escapeHtml(trimmed)}</p>`;
    })
    .join("");
  return sanitizeInternalDocumentHtml(html);
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

export async function transcribeAndArchiveMeeting({
  memberId,
  guildId,
  title,
  pathname,
  filename,
  mimeType,
  bytes,
}: {
  memberId: string;
  guildId?: string;
  title: string;
  pathname: string;
  filename: string;
  mimeType: string;
  bytes: number;
}) {
  if (!pathname.startsWith(`uploads/meeting-recording/${memberId}/`))
    throw new Error("Recording ownership could not be verified.");
  if (
    !allowedMeetingRecordingTypes.includes(
      mimeType as (typeof allowedMeetingRecordingTypes)[number],
    )
  )
    throw new Error("Upload an MP3, M4A, WAV, OGG, WebM, or MP4 recording.");
  if (bytes <= 0 || bytes > MAX_MEETING_RECORDING_BYTES)
    throw new Error("Meeting recordings must be 15 MB or smaller.");

  const recording = await readPrivateBlob(pathname);
  if (recording.byteLength !== bytes)
    throw new Error("The uploaded recording size could not be verified.");
  const transcript = await generateGeminiMediaText({
    system:
      "You transcribe consent-confirmed 210 Robotics meetings. Be faithful to the recording. Never invent missing speech, names, decisions, or assignments. Mark unclear audio as [inaudible].",
    prompt:
      `Transcribe the meeting titled "${title}". Return Markdown with these sections: ` +
      "Meeting summary, Decisions, Action items (owner and due date only when actually stated), and Full transcript. " +
      "Keep the full transcript speaker-labeled when speakers can be distinguished.",
    userId: memberId,
    feature: "discord-meeting-transcription",
    mimeType,
    buffer: recording,
  });
  const contentHtml = transcriptHtml(transcript);
  const transcriptId = randomUUID();
  const recordingId = randomUUID();
  const cleanTitle = title.trim().slice(0, 180);
  const recordingName = safeDocumentName(filename);
  const transcriptName = safeDocumentName(`${cleanTitle}-transcript.docx`);
  const transcriptBuffer = await buildInternalDocumentFile({
    title: `${cleanTitle} transcript`,
    description:
      "Gemini-generated transcript from a recording uploaded with participant consent.",
    contentHtml,
  });
  const transcriptBlob = await put(
    `internal-documents/${transcriptId}/source/${transcriptName}`,
    transcriptBuffer,
    {
      access: "private",
      token: privateBlobToken(),
      contentType: DOCX_MIME,
      addRandomSuffix: true,
    },
  );
  const [recordingDrive, transcriptDrive] = await Promise.all([
    archiveToDrive({
      buffer: recording,
      filename: recordingName,
      mimeType,
    }),
    archiveToDrive({
      buffer: transcriptBuffer,
      filename: transcriptName,
      mimeType: DOCX_MIME,
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
      id: transcriptId,
      title: `${cleanTitle} transcript`,
      description:
        "Editable Gemini transcript generated from a consent-confirmed meeting recording.",
      category: "Meeting transcripts",
      originalFilename: transcriptName,
      mimeType: DOCX_MIME,
      bytes: transcriptBuffer.byteLength,
      pathname: transcriptBlob.pathname,
      contentHtml,
      editable: true,
      storageProvider: transcriptDrive ? "BLOB_AND_DRIVE" : "BLOB",
      driveFileId: transcriptDrive?.id || null,
      driveWebViewLink: transcriptDrive?.webViewLink || null,
      driveModifiedAt: transcriptDrive?.modifiedTime
        ? new Date(transcriptDrive.modifiedTime)
        : null,
      driveSyncStatus: transcriptDrive ? "SYNCED" : "LOCAL_ONLY",
      createdByMemberId: memberId,
      updatedByMemberId: memberId,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  await db.insert(internalDocumentRevisions).values({
    documentId: transcriptId,
    versionNumber: 1,
    title: `${cleanTitle} transcript`,
    description:
      "Generated by Gemini from a consent-confirmed meeting recording.",
    category: "Meeting transcripts",
    contentHtml,
    reason: "Initial meeting transcription",
    editorMemberId: memberId,
  });
  await db.insert(auditEvents).values({
    actorMemberId: memberId,
    action: "MEETING_RECORDING_TRANSCRIBED",
    entityType: "internal_document",
    entityId: transcriptId,
    details: {
      recordingDocumentId: recordingId,
      consentConfirmed: true,
      mimeType,
      bytes: recording.byteLength,
      driveRecording: Boolean(recordingDrive),
      driveTranscript: Boolean(transcriptDrive),
    },
  });
  const botlog = await publishDiscordMeetingTranscript({
    guildId,
    title: cleanTitle,
    transcript,
    recordingDocumentId: recordingId,
    transcriptDocumentId: transcriptId,
  }).catch((error: unknown) => ({
    published: false,
    reason:
      error instanceof Error ? error.message : "Botlog publication failed.",
  }));
  return {
    transcriptId,
    recordingId,
    driveSynced: Boolean(recordingDrive && transcriptDrive),
    botlog,
  };
}

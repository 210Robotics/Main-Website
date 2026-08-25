import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import type { NextRequest } from "next/server";
import { requireMemberEntitlement } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { allowedImageTypes, MAX_IMAGE_BYTES } from "@/lib/upload-policy";
import { allowedFormFileTypes, MAX_FORM_FILE_BYTES } from "@/lib/form-files";
import {
  allowedInternalDocumentTypes,
  MAX_INTERNAL_DOCUMENT_BYTES,
} from "@/lib/internal-documents";
import { getDb } from "@/db";
import { memberTasks } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { privateBlobToken } from "@/lib/private-blob";

export const runtime = "nodejs";

type UploadPurpose =
  | "self-profile"
  | "account-profile"
  | "roster-card"
  | "post-cover"
  | "gallery-photo"
  | "sponsor-logo"
  | "site-content"
  | "doc-image"
  | "notebook-image"
  | "form-image"
  | "internal-document"
  | "notebook-import"
  | "meeting-recording"
  | "task-attachment";

const allowedMeetingRecordingTypes = [
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
const MAX_MEETING_RECORDING_BYTES = 15 * 1024 * 1024;

function isPurpose(value: unknown): value is UploadPurpose {
  return [
    "self-profile",
    "account-profile",
    "roster-card",
    "post-cover",
    "gallery-photo",
    "sponsor-logo",
    "site-content",
    "doc-image",
    "notebook-image",
    "form-image",
    "internal-document",
    "notebook-import",
    "meeting-recording",
    "task-attachment",
  ].includes(String(value));
}

async function authorizePurpose(purpose: UploadPurpose, taskId?: string) {
  const member = await requireMemberEntitlement();
  if (purpose === "self-profile") return member;
  if (purpose === "internal-document") {
    if (!hasPermission(member.accessRole, "documents.manage", member.permissionOverrides))
      throw new Error("You cannot upload internal documents.");
    return member;
  }
  if (purpose === "meeting-recording") {
    if (
      !hasPermission(
        member.accessRole,
        "integrations.manage",
        member.permissionOverrides,
      )
    )
      throw new Error("You cannot upload meeting recordings.");
    return member;
  }
  if (purpose === "notebook-import" || purpose === "notebook-image") {
    if (!hasPermission(member.accessRole, "notebook.manage", member.permissionOverrides))
      throw new Error("You cannot upload to the engineering notebook.");
    return member;
  }
  if (purpose === "task-attachment") {
    if (!taskId) throw new Error("A task is required for this upload.");
    const [task] = await getDb().select({ assignedToMemberId: memberTasks.assignedToMemberId }).from(memberTasks).where(and(eq(memberTasks.id, taskId), isNull(memberTasks.archivedAt))).limit(1);
    const managesTasks = hasPermission(member.accessRole, "tasks.manage", member.permissionOverrides);
    if (!task || (task.assignedToMemberId !== member.id && !managesTasks)) throw new Error("You cannot upload to this task.");
    return member;
  }
  if (purpose === "site-content") {
    const canUploadWebsiteMedia =
      hasPermission(
        member.accessRole,
        "content.manage",
        member.permissionOverrides,
      ) ||
      hasPermission(
        member.accessRole,
        "finance.manage",
        member.permissionOverrides,
      );
    if (!canUploadWebsiteMedia)
      throw new Error("You cannot upload website images.");
    return member;
  }
  const permission = purpose === "account-profile"
    ? "members.edit"
    : purpose === "roster-card"
      ? "directory.manage"
      : purpose === "sponsor-logo"
        ? "sponsors.manage"
        : purpose === "gallery-photo"
          ? "media.manage"
        : purpose === "form-image"
          ? "forms.manage"
          : "content.manage";
  if (!hasPermission(member.accessRole, permission, member.permissionOverrides))
    throw new Error("You do not have permission to upload this image.");
  return member;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const tokenPurpose =
      body.type === "blob.generate-client-token"
        ? (JSON.parse(body.payload.clientPayload || "{}") as { purpose?: unknown }).purpose
        : undefined;
    const usesPrivateStorage =
      tokenPurpose === "internal-document" ||
      tokenPurpose === "notebook-import" ||
      tokenPurpose === "meeting-recording" ||
      tokenPurpose === "notebook-image";
    const result = await handleUpload({
      token: usesPrivateStorage ? privateBlobToken() : process.env.BLOB_READ_WRITE_TOKEN,
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = JSON.parse(clientPayload || "{}") as { purpose?: unknown; taskId?: unknown };
        if (!isPurpose(payload.purpose)) throw new Error("Invalid upload purpose.");
        const taskId = typeof payload.taskId === "string" ? payload.taskId : undefined;
        const member = await authorizePurpose(payload.purpose, taskId);
        const safePrefix = payload.purpose === "task-attachment"
          ? `uploads/task-attachment/${taskId}/${member.id}/`
          : `uploads/${payload.purpose}/${member.id}/`;
        if (!pathname.startsWith(safePrefix)) throw new Error("Invalid upload path.");
        return {
          allowedContentTypes:
            payload.purpose === "task-attachment"
              ? [...allowedFormFileTypes]
              : payload.purpose === "meeting-recording"
                ? [...allowedMeetingRecordingTypes]
              : payload.purpose === "internal-document" || payload.purpose === "notebook-import"
                ? [...allowedInternalDocumentTypes]
                : [...allowedImageTypes],
          maximumSizeInBytes:
            payload.purpose === "task-attachment"
              ? MAX_FORM_FILE_BYTES
              : payload.purpose === "meeting-recording"
                ? MAX_MEETING_RECORDING_BYTES
              : payload.purpose === "internal-document" || payload.purpose === "notebook-import"
                ? MAX_INTERNAL_DOCUMENT_BYTES
                : MAX_IMAGE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ purpose: payload.purpose, memberId: member.id }),
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    console.error("Upload authorization failed", error);
    return Response.json({ error: "Upload could not be authorized." }, { status: 400 });
  }
}

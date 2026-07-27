"use server";

import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditEvents,
  internalDocumentRevisions,
  internalDocuments,
} from "@/db/schema";
import { requireActiveMember, requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { buildInternalDocumentFile } from "@/lib/exports/notebook-document";
import {
  DOCX_MIME,
  CSV_MIME,
  MAX_INTERNAL_DOCUMENT_BYTES,
  PDF_MIME,
  XLSX_MIME,
  docxToEditableHtml,
  downloadInternalDriveFile,
  downloadSharedDriveDocument,
  isSupportedInternalDocument,
  listInternalDriveFiles,
  parseGoogleDriveDocumentLink,
  pdfToEditableHtml,
  readPrivateBlob,
  safeDocumentName,
  sanitizeInternalDocumentHtml,
  saveInternalDocumentToDrive,
  spreadsheetToArchiveHtml,
} from "@/lib/internal-documents";
import { privateBlobToken } from "@/lib/private-blob";

export type InternalDocumentActionState = {
  status: "idle" | "success" | "error";
  message: string;
  documentId?: string;
};

const uploadSchema = z.object({
  pathname: z.string().min(10).max(700),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(150),
  size: z.number().int().positive().max(MAX_INTERNAL_DOCUMENT_BYTES),
  category: z.string().trim().max(80).default("General"),
  purpose: z.enum(["internal-document", "notebook-import"]),
});

function titleFromFilename(filename: string) {
  return filename
    .replace(/\.(docx|pdf|xlsx|csv)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180) || "Imported document";
}

function effectiveMimeType(buffer: Buffer, filename: string) {
  const lower = filename.toLowerCase();
  if (
    buffer.subarray(0, 5).toString("ascii") === "%PDF-"
  )
    return PDF_MIME;
  if (lower.endsWith(".xlsx") && buffer.subarray(0, 2).toString("ascii") === "PK")
    return XLSX_MIME;
  if (lower.endsWith(".csv")) return CSV_MIME;
  if (
    buffer.subarray(0, 2).toString("ascii") === "PK"
  )
    return DOCX_MIME;
  throw new Error("Upload a valid DOCX, PDF, XLSX, or CSV file.");
}

const sharedDriveImportSchema = z.object({
  url: z.string().trim().url().max(1000),
});

async function createDocumentRecord({
  id,
  filename,
  mimeType,
  buffer,
  pathname,
  category,
  memberId,
  driveFileId,
  driveWebViewLink,
  driveModifiedAt,
  driveAlreadyStored = false,
}: {
  id: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
  pathname: string;
  category: string;
  memberId: string;
  driveFileId?: string | null;
  driveWebViewLink?: string | null;
  driveModifiedAt?: Date | null;
  driveAlreadyStored?: boolean;
}) {
  const imported =
    mimeType === DOCX_MIME
      ? await docxToEditableHtml(id, buffer)
      : mimeType === PDF_MIME
        ? {
          html: await pdfToEditableHtml(buffer),
          embeddedAssets: [],
          warnings: [] as string[],
        }
        : {
            html: await spreadsheetToArchiveHtml(buffer, mimeType),
            embeddedAssets: [],
            warnings: [] as string[],
          };
  let drive: {
    id: string;
    webViewLink?: string;
    modifiedTime?: string;
  } | null = driveFileId
    ? {
        id: driveFileId,
        webViewLink: driveWebViewLink || undefined,
        modifiedTime: driveModifiedAt?.toISOString(),
      }
    : null;
  let driveSyncStatus = drive ? "SYNCED" : "LOCAL_ONLY";
  if (!driveAlreadyStored && !drive) {
    try {
      drive = await saveInternalDocumentToDrive({
        buffer,
        filename,
        mimeType,
      });
      if (drive) driveSyncStatus = "SYNCED";
    } catch (error) {
      driveSyncStatus = "DRIVE_UNAVAILABLE";
      console.error("Internal document Drive archive failed", error);
    }
  }
  const title = titleFromFilename(filename);
  await getDb().insert(internalDocuments).values({
    id,
    title,
    category: category || "General",
    originalFilename: safeDocumentName(filename),
    mimeType,
    bytes: buffer.byteLength,
    pathname,
    contentHtml: imported.html,
    editable: mimeType === DOCX_MIME,
    embeddedAssets: imported.embeddedAssets,
    storageProvider: drive ? "BLOB_AND_DRIVE" : "BLOB",
    driveFileId: drive?.id || null,
    driveWebViewLink: drive?.webViewLink || null,
    driveModifiedAt: drive?.modifiedTime
      ? new Date(drive.modifiedTime)
      : driveModifiedAt || null,
    driveSyncStatus,
    createdByMemberId: memberId,
    updatedByMemberId: memberId,
  });
  await getDb().insert(internalDocumentRevisions).values({
    documentId: id,
    versionNumber: 1,
    title,
    category: category || "General",
    contentHtml: imported.html,
    reason:
      mimeType === DOCX_MIME
        ? "Imported editable DOCX"
        : mimeType === PDF_MIME
          ? "Imported PDF archive"
          : "Imported spreadsheet archive",
    editorMemberId: memberId,
  });
  await getDb().insert(auditEvents).values({
    actorMemberId: memberId,
    action: "internal_document.imported",
    entityType: "internal_document",
    entityId: id,
    details: {
      filename,
      mimeType,
      bytes: buffer.byteLength,
      driveSyncStatus,
      conversionWarnings: imported.warnings.length,
    },
  });
  return { id, title, driveSyncStatus };
}

export async function finalizeInternalDocumentUpload(
  input: z.input<typeof uploadSchema>,
): Promise<InternalDocumentActionState> {
  try {
    const actor = await requireActiveMember();
    const data = uploadSchema.parse(input);
    const permission =
      data.purpose === "notebook-import"
        ? "notebook.manage"
        : "documents.manage";
    if (!hasPermission(actor.accessRole, permission, actor.permissionOverrides))
      throw new Error("You do not have permission to import this document.");
    if (!isSupportedInternalDocument(data.contentType, data.filename))
      throw new Error("Only DOCX, PDF, XLSX, and CSV files can be added to the archive.");
    const prefix = `uploads/${data.purpose}/${actor.id}/`;
    if (!data.pathname.startsWith(prefix))
      throw new Error("Upload ownership could not be verified.");
    const buffer = await readPrivateBlob(data.pathname);
    const mimeType = effectiveMimeType(buffer, data.filename);
    const id = randomUUID();
    const created = await createDocumentRecord({
      id,
      filename: data.filename,
      mimeType,
      buffer,
      pathname: data.pathname,
      category: data.category,
      memberId: actor.id,
    });
    revalidatePath("/admin");
    return {
      status: "success",
      message:
        created.driveSyncStatus === "SYNCED"
          ? "Document imported and archived in Google Drive."
          : "Document imported into the secure site archive. Drive sync can be retried later.",
      documentId: created.id,
    };
  } catch (error) {
    console.error("Internal document import failed", error);
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Document import failed.",
    };
  }
}

export async function importInternalDocumentFromDriveLink(
  input: z.input<typeof sharedDriveImportSchema>,
): Promise<InternalDocumentActionState> {
  try {
    const actor = await requireActiveMember();
    if (
      !hasPermission(
        actor.accessRole,
        "documents.manage",
        actor.permissionOverrides,
      ) &&
      !hasPermission(
        actor.accessRole,
        "notebook.manage",
        actor.permissionOverrides,
      )
    ) {
      throw new Error(
        "You need document or engineering notebook access to import this Drive file.",
      );
    }
    const data = sharedDriveImportSchema.parse(input);
    const parsed = parseGoogleDriveDocumentLink(data.url);
    const [existing] = await getDb()
      .select({ id: internalDocuments.id })
      .from(internalDocuments)
      .where(
        and(
          eq(internalDocuments.driveFileId, parsed.id),
          isNull(internalDocuments.archivedAt),
        ),
      )
      .limit(1);
    if (existing)
      return {
        status: "success",
        message: "This Drive document was already in the secure archive.",
        documentId: existing.id,
      };
    const source = await downloadSharedDriveDocument(data.url);
    if (source.buffer.byteLength > MAX_INTERNAL_DOCUMENT_BYTES)
      throw new Error("The Google Drive document is larger than 40 MB.");
    const mimeType = effectiveMimeType(source.buffer, source.filename);
    const extension =
      mimeType === PDF_MIME
        ? ".pdf"
        : mimeType === XLSX_MIME
          ? ".xlsx"
          : mimeType === CSV_MIME
            ? ".csv"
            : ".docx";
    const filename = source.filename.toLowerCase().endsWith(extension)
      ? source.filename
      : `${source.filename}${extension}`;
    const id = randomUUID();
    const pathname = `internal-documents/${id}/source/${safeDocumentName(filename)}`;
    const blob = await put(pathname, source.buffer, {
      access: "private",
      token: privateBlobToken(),
      contentType: mimeType,
      addRandomSuffix: true,
    });
    const created = await createDocumentRecord({
      id,
      filename,
      mimeType,
      buffer: source.buffer,
      pathname: blob.pathname,
      category: "AI and Drive imports",
      memberId: actor.id,
      driveFileId: source.driveFileId,
      driveWebViewLink: source.driveWebViewLink,
      driveModifiedAt: source.driveModifiedAt,
      driveAlreadyStored: true,
    });
    revalidatePath("/admin");
    return {
      status: "success",
      message:
        mimeType === DOCX_MIME
          ? "Google Drive document imported as an editable internal document."
          : "Google Drive file imported into the secure internal archive.",
      documentId: created.id,
    };
  } catch (error) {
    console.error("Google Drive notebook import failed", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The Google Drive document could not be imported.",
    };
  }
}

const saveSchema = z.object({
  documentId: z.uuid(),
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1000),
  category: z.string().trim().min(1).max(80),
  contentHtml: z.string().max(5_000_000),
  reason: z.string().trim().max(300).optional(),
});

export async function saveInternalDocument(
  input: z.input<typeof saveSchema>,
): Promise<InternalDocumentActionState> {
  try {
    const actor = await requirePermission("documents.manage");
    const data = saveSchema.parse(input);
    const [existing] = await getDb()
      .select()
      .from(internalDocuments)
      .where(eq(internalDocuments.id, data.documentId))
      .limit(1);
    if (!existing || existing.archivedAt)
      throw new Error("Document not found.");
    if (!existing.editable)
      throw new Error("PDF files are view-only. Import a DOCX to edit its pages.");
    const contentHtml = sanitizeInternalDocumentHtml(data.contentHtml);
    const nextVersion = existing.currentVersion + 1;
    const docx = await buildInternalDocumentFile({
      title: data.title,
      description: data.description,
      contentHtml,
    });
    await put(existing.pathname, docx, {
      access: "private",
      token: privateBlobToken(),
      contentType: DOCX_MIME,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    let driveSyncStatus = existing.driveFileId
      ? "DRIVE_UPDATE_PENDING"
      : "LOCAL_ONLY";
    let drive = null;
    try {
      drive = await saveInternalDocumentToDrive({
        buffer: docx,
        filename: existing.originalFilename,
        mimeType: DOCX_MIME,
        driveFileId: existing.driveFileId,
      });
      if (drive) driveSyncStatus = "SYNCED";
    } catch (error) {
      driveSyncStatus = "DRIVE_UNAVAILABLE";
      console.error("Edited document Drive update failed", error);
    }
    await getDb()
      .update(internalDocuments)
      .set({
        title: data.title,
        description: data.description,
        category: data.category,
        contentHtml,
        bytes: docx.byteLength,
        currentVersion: nextVersion,
        updatedByMemberId: actor.id,
        updatedAt: new Date(),
        driveFileId: drive?.id || existing.driveFileId,
        driveWebViewLink:
          drive?.webViewLink || existing.driveWebViewLink,
        driveModifiedAt: drive?.modifiedTime
          ? new Date(drive.modifiedTime)
          : existing.driveModifiedAt,
        driveSyncStatus,
        storageProvider:
          drive || existing.driveFileId ? "BLOB_AND_DRIVE" : "BLOB",
      })
      .where(eq(internalDocuments.id, existing.id));
    await getDb().insert(internalDocumentRevisions).values({
      documentId: existing.id,
      versionNumber: nextVersion,
      title: data.title,
      description: data.description,
      category: data.category,
      contentHtml,
      reason: data.reason || "Saved in document studio",
      editorMemberId: actor.id,
    });
    await getDb().insert(auditEvents).values({
      actorMemberId: actor.id,
      action: "internal_document.updated",
      entityType: "internal_document",
      entityId: existing.id,
      details: { version: nextVersion, driveSyncStatus },
    });
    revalidatePath("/admin");
    return {
      status: "success",
      message:
        driveSyncStatus === "SYNCED"
          ? `Version ${nextVersion} saved to the site and Google Drive.`
          : `Version ${nextVersion} saved to the site archive.`,
      documentId: existing.id,
    };
  } catch (error) {
    console.error("Internal document save failed", error);
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Document save failed.",
    };
  }
}

export async function archiveInternalDocument(formData: FormData) {
  const actor = await requirePermission("documents.manage");
  const id = z.uuid().parse(formData.get("documentId"));
  await getDb()
    .update(internalDocuments)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(internalDocuments.id, id));
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "internal_document.archived",
    entityType: "internal_document",
    entityId: id,
  });
  revalidatePath("/admin");
}

export async function syncInternalDocumentsFromDrive(
  _previousState: InternalDocumentActionState,
  _formData?: FormData,
): Promise<InternalDocumentActionState> {
  void _previousState;
  void _formData;
  try {
    const actor = await requirePermission("documents.manage");
    const files = await listInternalDriveFiles();
    if (!files.length)
      return {
        status: "success",
        message:
          "The shared Drive folder is currently empty. The secure site archive remains active.",
      };
    const existing = await getDb()
      .select({ driveFileId: internalDocuments.driveFileId })
      .from(internalDocuments)
      .where(isNull(internalDocuments.archivedAt));
    const known = new Set(
      existing
        .map((row) => row.driveFileId)
        .filter((id): id is string => Boolean(id)),
    );
    let imported = 0;
    let skipped = 0;
    for (const file of files) {
      try {
        if (known.has(file.id)) {
          skipped++;
          continue;
        }
        const downloadable =
          file.mimeType === "application/vnd.google-apps.document" ||
          isSupportedInternalDocument(file.mimeType, file.name);
        if (!downloadable) {
          skipped++;
          continue;
        }
        const source = await downloadInternalDriveFile(file);
        if (source.buffer.byteLength > MAX_INTERNAL_DOCUMENT_BYTES) {
          skipped++;
          continue;
        }
        const mimeType = effectiveMimeType(source.buffer, source.filename);
        const id = randomUUID();
        const pathname = `internal-documents/${id}/source/${safeDocumentName(source.filename)}`;
        const blob = await put(pathname, source.buffer, {
          access: "private",
          token: privateBlobToken(),
          contentType: source.mimeType,
          addRandomSuffix: true,
        });
        await createDocumentRecord({
          id,
          filename: source.filename,
          mimeType,
          buffer: source.buffer,
          pathname: blob.pathname,
          category: "Google Drive",
          memberId: actor.id,
          driveFileId: file.id,
          driveWebViewLink: file.webViewLink,
          driveModifiedAt: file.modifiedTime
            ? new Date(file.modifiedTime)
            : null,
          driveAlreadyStored: true,
        });
        imported++;
      } catch (error) {
        skipped++;
        console.error(`Internal Drive document skipped: ${file.name}`, error);
      }
    }
    revalidatePath("/admin");
    return {
      status: "success",
      message: `Drive sync complete: ${imported} imported, ${skipped} already present or unsupported.`,
    };
  } catch (error) {
    console.error("Internal Drive sync failed", error);
    return {
      status: "error",
      message:
        "Google Drive is unavailable to the website runtime. Files can still be uploaded to the secure site archive.",
    };
  }
}

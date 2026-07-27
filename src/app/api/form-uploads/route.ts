import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { and, eq, gt } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { publicForms, publicFormUploads } from "@/db/schema";
import {
  allowedFormFileTypes,
  isAllowedFormFileType,
  MAX_FORM_FILE_BYTES,
  safeUploadFilename,
} from "@/lib/form-files";
import { publicRequestFingerprint } from "@/lib/public-fingerprint";

export const runtime = "nodejs";

const payloadSchema = z.object({
  accessKey: z.string().min(24).max(80),
  formId: z.uuid(),
  fieldId: z.uuid(),
  uploadId: z.uuid(),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(180),
  size: z.number().int().positive().max(MAX_FORM_FILE_BYTES),
});

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const data = payloadSchema.parse(JSON.parse(clientPayload || "{}"));
        if (!isAllowedFormFileType(data.mimeType))
          throw new Error("Unsupported file type.");
        const [form] = await getDb()
          .select()
          .from(publicForms)
          .where(eq(publicForms.accessKey, data.accessKey))
          .limit(1);
        const field = form?.fields.find(
          (candidate) => candidate.id === data.fieldId,
        );
        if (
          !form ||
          form.id !== data.formId ||
          form.status !== "OPEN" ||
          field?.type !== "FILE_UPLOAD"
        ) {
          throw new Error("This upload question is not available.");
        }
        const expected = `uploads/form-response/${form.id}/${field.id}/${data.uploadId}-${safeUploadFilename(data.filename)}`;
        if (pathname !== expected) throw new Error("Invalid upload path.");
        const fingerprint = await publicRequestFingerprint(data.accessKey);
        const recent = await getDb()
          .select({ id: publicFormUploads.id })
          .from(publicFormUploads)
          .where(
            and(
              eq(publicFormUploads.formId, form.id),
              eq(publicFormUploads.requestFingerprint, fingerprint),
              gt(publicFormUploads.createdAt, new Date(Date.now() - 60_000)),
            ),
          )
          .limit(21);
        if (recent.length >= 20)
          throw new Error("Too many uploads. Wait a minute and try again.");
        await getDb().insert(publicFormUploads).values({
          id: data.uploadId,
          formId: form.id,
          fieldId: field.id,
          pathname,
          filename: data.filename,
          mimeType: data.mimeType,
          bytes: data.size,
          requestFingerprint: fingerprint,
        });
        return {
          allowedContentTypes: [...allowedFormFileTypes],
          maximumSizeInBytes: MAX_FORM_FILE_BYTES,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ uploadId: data.uploadId }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const { uploadId } = z
          .object({ uploadId: z.uuid() })
          .parse(JSON.parse(tokenPayload || "{}"));
        await getDb()
          .update(publicFormUploads)
          .set({ blobUrl: blob.url })
          .where(
            and(
              eq(publicFormUploads.id, uploadId),
              eq(publicFormUploads.pathname, blob.pathname),
            ),
          );
      },
    });
    return Response.json(result);
  } catch (error) {
    console.error("Public form upload failed", error);
    return Response.json(
      { error: "Upload could not be authorized." },
      { status: 400 },
    );
  }
}

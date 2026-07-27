"use server";

import { del, head } from "@vercel/blob";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { publicForms, publicFormUploads } from "@/db/schema";
import type { FormFileValue } from "@/lib/form-types";
import { publicRequestFingerprint } from "@/lib/public-fingerprint";

const uploadReferenceSchema = z.object({
  accessKey: z.string().min(24).max(80),
  fieldId: z.uuid(),
  uploadId: z.uuid(),
  url: z.url(),
});

export async function confirmPublicFormUpload(
  input: unknown,
): Promise<
  { success: true; file: FormFileValue } | { success: false; message: string }
> {
  try {
    const data = uploadReferenceSchema.parse(input);
    const [form] = await getDb()
      .select()
      .from(publicForms)
      .where(eq(publicForms.accessKey, data.accessKey))
      .limit(1);
    if (
      !form ||
      form.status !== "OPEN" ||
      !form.fields.some(
        (field) => field.id === data.fieldId && field.type === "FILE_UPLOAD",
      )
    ) {
      return {
        success: false,
        message: "This upload question is no longer available.",
      };
    }
    const fingerprint = await publicRequestFingerprint(data.accessKey);
    const [grant] = await getDb()
      .select()
      .from(publicFormUploads)
      .where(
        and(
          eq(publicFormUploads.id, data.uploadId),
          eq(publicFormUploads.formId, form.id),
          eq(publicFormUploads.fieldId, data.fieldId),
          eq(publicFormUploads.requestFingerprint, fingerprint),
          isNull(publicFormUploads.claimedAt),
        ),
      )
      .limit(1);
    if (!grant)
      return { success: false, message: "This upload could not be verified." };
    const metadata = await head(data.url);
    if (
      metadata.pathname !== grant.pathname ||
      metadata.size !== grant.bytes ||
      metadata.contentType !== grant.mimeType
    ) {
      return {
        success: false,
        message: "The uploaded file did not pass verification.",
      };
    }
    await getDb()
      .update(publicFormUploads)
      .set({ blobUrl: metadata.url })
      .where(eq(publicFormUploads.id, grant.id));
    return {
      success: true,
      file: {
        uploadId: grant.id,
        url: metadata.url,
        pathname: metadata.pathname,
        filename: grant.filename,
        mimeType: grant.mimeType,
        size: grant.bytes,
      },
    };
  } catch (error) {
    console.error("Public form upload confirmation failed", error);
    return {
      success: false,
      message: "The uploaded file could not be verified.",
    };
  }
}

export async function discardPublicFormUpload(
  accessKeyValue: string,
  uploadIdValue: string,
) {
  try {
    const accessKey = z.string().min(24).max(80).parse(accessKeyValue);
    const uploadId = z.uuid().parse(uploadIdValue);
    const fingerprint = await publicRequestFingerprint(accessKey);
    const [form] = await getDb()
      .select({ id: publicForms.id })
      .from(publicForms)
      .where(eq(publicForms.accessKey, accessKey))
      .limit(1);
    if (!form) return;
    const [upload] = await getDb()
      .delete(publicFormUploads)
      .where(
        and(
          eq(publicFormUploads.id, uploadId),
          eq(publicFormUploads.formId, form.id),
          eq(publicFormUploads.requestFingerprint, fingerprint),
          isNull(publicFormUploads.claimedAt),
        ),
      )
      .returning({ pathname: publicFormUploads.pathname });
    if (upload) await del(upload.pathname);
  } catch (error) {
    console.error("Public form upload removal failed", error);
  }
}

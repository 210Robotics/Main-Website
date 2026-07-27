"use server";

import { del } from "@vercel/blob";
import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import {
  publicFormResponses,
  publicForms,
  publicFormUploads,
  members,
} from "@/db/schema";
import { getCurrentMember } from "@/lib/auth";
import type { PublicFormAnswer, PublicFormField } from "@/lib/form-types";
import { publicRequestFingerprint } from "@/lib/public-fingerprint";

export type PublicFormState = {
  status: "idle" | "success" | "error";
  message: string;
  submitted?: boolean;
  errors?: Record<string, string>;
};

function hasValue(value: string | string[]) {
  return Array.isArray(value) ? value.length > 0 : value.trim().length > 0;
}

function validateAnswer(field: PublicFormField, values: FormDataEntryValue[]) {
  const strings = values
    .map(String)
    .map((value) => value.trim())
    .filter(Boolean);
  const value: string | string[] =
    field.type === "MULTI_SELECT" ? strings : (strings[0] ?? "");
  if (field.required && !hasValue(value))
    return { error: "This question is required." };
  if (!hasValue(value)) return { value };
  if (Array.isArray(value)) {
    if (
      value.length > field.options.length ||
      value.some((item) => !field.options.includes(item))
    ) {
      return { error: "Choose only the available options." };
    }
    return { value };
  }
  if (value.length > 5000)
    return { error: "Keep this answer under 5,000 characters." };
  if (
    ["MULTIPLE_CHOICE", "DROPDOWN"].includes(field.type) &&
    !field.options.includes(value)
  ) {
    return { error: "Choose one of the available options." };
  }
  if (field.type === "EMAIL" && !z.email().safeParse(value).success) {
    return { error: "Enter a valid email address." };
  }
  if (
    field.type === "LINK" &&
    !z.url({ protocol: /^https?$/ }).safeParse(value).success
  ) {
    return { error: "Enter a complete http:// or https:// link." };
  }
  if (field.type === "NUMBER" && !Number.isFinite(Number(value))) {
    return { error: "Enter a valid number." };
  }
  if (field.type === "DATE") {
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00.000Z`)
      : null;
    if (
      !parsedDate ||
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== value
    ) {
      return { error: "Choose a valid date." };
    }
  }
  return { value };
}

export async function submitPublicForm(
  _previous: PublicFormState,
  formData: FormData,
): Promise<PublicFormState> {
  void _previous;
  try {
    const accessKey = z
      .string()
      .min(24)
      .max(80)
      .parse(formData.get("accessKey"));
    if (String(formData.get("organizationWebsite") || "")) {
      return {
        status: "success",
        message: "Thanks! Your response has been recorded.",
        submitted: true,
      };
    }
    const [form] = await getDb()
      .select()
      .from(publicForms)
      .where(eq(publicForms.accessKey, accessKey))
      .limit(1);
    if (!form || form.status !== "OPEN") {
      return {
        status: "error",
        message: "This form is not currently accepting responses.",
      };
    }

    const member = await getCurrentMember();
    const activeMember = member?.status === "ACTIVE" ? member : null;
    const responseIdValue = String(formData.get("responseId") || "");
    const responseId = responseIdValue ? z.uuid().parse(responseIdValue) : null;
    const [existingResponse] =
      responseId && activeMember
        ? await getDb()
            .select()
            .from(publicFormResponses)
            .where(
              and(
                eq(publicFormResponses.id, responseId),
                eq(publicFormResponses.formId, form.id),
                eq(publicFormResponses.submittedByMemberId, activeMember.id),
              ),
            )
            .limit(1)
        : [];
    if (responseId && !existingResponse) {
      return {
        status: "error",
        message: "This response is not available to edit.",
      };
    }

    const identity = activeMember
      ? {
          name: activeMember.displayName,
          email: activeMember.email,
          memberId: activeMember.id,
        }
      : (() => {
          const parsed = z
            .object({
              name: z.string().trim().min(2, "Enter your name.").max(100),
              email: z.email("Enter a valid email address.").max(320),
            })
            .safeParse({
              name: formData.get("respondentName"),
              email: formData.get("respondentEmail"),
            });
          return parsed.success
            ? { ...parsed.data, memberId: null as string | null }
            : null;
        })();
    if (!identity) {
      return {
        status: "error",
        message: "Enter your name and a valid email address.",
        errors: { identity: "Name and email are required." },
      };
    }
    if (!identity.memberId) {
      const [matched] = await getDb()
        .select({ id: members.id })
        .from(members)
        .where(
          and(
            eq(members.status, "ACTIVE"),
            sql`lower(${members.email}) = ${identity.email.toLowerCase()}`,
          ),
        )
        .limit(1);
      identity.memberId = matched?.id ?? null;
    }

    const fingerprint = await publicRequestFingerprint(accessKey);
    const errors: Record<string, string> = {};
    const answers: PublicFormAnswer[] = [];
    for (const field of form.fields) {
      if (field.type === "FILE_UPLOAD") {
        const uploadIds = formData
          .getAll(`field_${field.id}`)
          .map(String)
          .filter(Boolean);
        const maxFiles = field.maxFiles ?? 1;
        if (field.required && uploadIds.length === 0)
          errors[field.id] = "Upload at least one file.";
        else if (uploadIds.length > maxFiles)
          errors[field.id] = `Upload no more than ${maxFiles} files.`;
        else if (
          new Set(uploadIds).size !== uploadIds.length ||
          uploadIds.some((id) => !z.uuid().safeParse(id).success)
        ) {
          errors[field.id] = "One or more files could not be verified.";
        } else if (uploadIds.length) {
          const uploads = await getDb()
            .select()
            .from(publicFormUploads)
            .where(
              and(
                inArray(publicFormUploads.id, uploadIds),
                eq(publicFormUploads.formId, form.id),
                eq(publicFormUploads.fieldId, field.id),
                or(
                  and(
                    eq(publicFormUploads.requestFingerprint, fingerprint),
                    isNull(publicFormUploads.claimedAt),
                  ),
                  existingResponse
                    ? eq(publicFormUploads.responseId, existingResponse.id)
                    : sql`false`,
                ),
              ),
            );
          if (
            uploads.length !== uploadIds.length ||
            uploads.some((upload) => !upload.blobUrl)
          ) {
            errors[field.id] =
              "Wait for every file to finish uploading, then try again.";
          } else {
            answers.push({
              fieldId: field.id,
              label: field.label,
              type: field.type,
              value: uploads.map((upload) => ({
                uploadId: upload.id,
                url: upload.blobUrl!,
                pathname: upload.pathname,
                filename: upload.filename,
                mimeType: upload.mimeType,
                size: upload.bytes,
              })),
            });
          }
        }
        continue;
      }
      const result = validateAnswer(
        field,
        formData.getAll(`field_${field.id}`),
      );
      if (result.error) errors[field.id] = result.error;
      else if (result.value !== undefined) {
        answers.push({
          fieldId: field.id,
          label: field.label,
          type: field.type,
          value: result.value,
        });
      }
    }
    if (Object.keys(errors).length) {
      return {
        status: "error",
        message: "Review the highlighted questions.",
        errors,
      };
    }

    const recent = existingResponse
      ? []
      : await getDb()
          .select({ id: publicFormResponses.id })
          .from(publicFormResponses)
          .where(
            and(
              eq(publicFormResponses.formId, form.id),
              eq(publicFormResponses.requestFingerprint, fingerprint),
              gt(
                publicFormResponses.submittedAt,
                new Date(Date.now() - 60_000),
              ),
            ),
          )
          .orderBy(desc(publicFormResponses.submittedAt))
          .limit(6);
    if (recent.length >= 5) {
      return {
        status: "error",
        message: "Too many responses were sent. Wait a minute and try again.",
      };
    }

    const [response] = existingResponse
      ? await getDb()
          .update(publicFormResponses)
          .set({
            answers,
            respondentName: identity.name,
            respondentEmail: identity.email.toLowerCase(),
            submittedByMemberId: identity.memberId,
            requestFingerprint: fingerprint,
            updatedAt: new Date(),
          })
          .where(eq(publicFormResponses.id, existingResponse.id))
          .returning({ id: publicFormResponses.id })
      : await getDb()
          .insert(publicFormResponses)
          .values({
            formId: form.id,
            answers,
            respondentName: identity.name,
            respondentEmail: identity.email.toLowerCase(),
            submittedByMemberId: identity.memberId,
            requestFingerprint: fingerprint,
          })
          .returning({ id: publicFormResponses.id });
    const claimedIds = answers.flatMap((answer) =>
      answer.type === "FILE_UPLOAD" && Array.isArray(answer.value)
        ? answer.value
            .map((file) => (typeof file === "object" ? file.uploadId : ""))
            .filter(Boolean)
        : [],
    );
    if (claimedIds.length)
      await getDb()
        .update(publicFormUploads)
        .set({ responseId: response.id, claimedAt: new Date() })
        .where(
          and(
            inArray(publicFormUploads.id, claimedIds),
            isNull(publicFormUploads.claimedAt),
          ),
        );
    if (existingResponse) {
      const removedUploads = await getDb()
        .select({
          id: publicFormUploads.id,
          pathname: publicFormUploads.pathname,
        })
        .from(publicFormUploads)
        .where(eq(publicFormUploads.responseId, existingResponse.id));
      const removed = removedUploads.filter(
        (upload) => !claimedIds.includes(upload.id),
      );
      if (removed.length) {
        await getDb()
          .delete(publicFormUploads)
          .where(
            inArray(
              publicFormUploads.id,
              removed.map((upload) => upload.id),
            ),
          );
        try {
          await del(removed.map((upload) => upload.pathname));
        } catch (error) {
          console.error("Removed form attachment cleanup failed", error);
        }
      }
    } else {
      await getDb()
        .update(publicForms)
        .set({
          responseCount: sql`${publicForms.responseCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(publicForms.id, form.id));
    }
    revalidatePath("/admin");
    revalidatePath("/portal");
    return {
      status: "success",
      message: existingResponse
        ? "Your response was updated."
        : form.confirmationMessage,
      submitted: true,
    };
  } catch (error) {
    console.error("Public form submission failed", error);
    return {
      status: "error",
      message:
        "Your response could not be submitted. Check your answers and try again.",
    };
  }
}

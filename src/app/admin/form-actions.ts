"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { del } from "@vercel/blob";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { auditEvents, publicFormResponses, publicForms, publicFormUploads } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { publicFormFieldsSchema, sanitizeFormHtml } from "@/lib/forms";

export type FormManagerState = {
  status: "idle" | "success" | "error";
  message: string;
  formId?: string;
};

const idle: FormManagerState = { status: "idle", message: "" };
type PublicFormFieldLike = Record<string, unknown> & { options?: unknown[] };

const definitionSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(2).max(180),
  descriptionHtml: z.string().max(500_000),
  confirmationMessage: z.string().trim().min(2).max(600),
  status: z.enum(["DRAFT", "OPEN", "CLOSED"]),
  fields: publicFormFieldsSchema,
});

function newAccessKey() {
  return randomBytes(24).toString("base64url");
}

function refreshFormRoutes(accessKey?: string) {
  revalidatePath("/admin");
  if (accessKey) revalidatePath(`/f/${accessKey}`);
}

export async function createPublicForm(
  _previous: FormManagerState = idle,
  formData: FormData,
): Promise<FormManagerState> {
  void _previous;
  try {
    const actor = await requirePermission("forms.manage");
    const { title } = z
      .object({ title: z.string().trim().min(2).max(180) })
      .parse(Object.fromEntries(formData));
    const [created] = await getDb()
      .insert(publicForms)
      .values({
        title,
        accessKey: newAccessKey(),
        fields: [],
        createdByMemberId: actor.id,
        lastEditorMemberId: actor.id,
      })
      .returning({ id: publicForms.id, accessKey: publicForms.accessKey });
    await getDb().insert(auditEvents).values({
      actorMemberId: actor.id,
      action: "form.created",
      entityType: "public_form",
      entityId: created.id,
    });
    refreshFormRoutes(created.accessKey);
    return { status: "success", message: "Form created. Add questions and open it when ready.", formId: created.id };
  } catch (error) {
    console.error("Form creation failed", error);
    return { status: "error", message: "The form could not be created. Check the title and try again." };
  }
}

export async function savePublicForm(input: unknown): Promise<FormManagerState> {
  try {
    const actor = await requirePermission("forms.manage");
    const candidate = input as { fields?: Array<PublicFormFieldLike> } & Record<string, unknown>;
    const data = definitionSchema.parse({
      ...candidate,
      fields: Array.isArray(candidate.fields)
        ? candidate.fields.map((field) => ({
            ...field,
            options: Array.isArray(field.options)
              ? field.options.map((option) => String(option).trim()).filter(Boolean)
              : [],
          }))
        : candidate.fields,
    });
    const [existing] = await getDb()
      .select()
      .from(publicForms)
      .where(eq(publicForms.id, data.id))
      .limit(1);
    if (!existing) return { status: "error", message: "Form not found." };
    if (data.status === "OPEN" && !data.fields.length) {
      return { status: "error", message: "Add at least one question before opening the form." };
    }
    const now = new Date();
    await getDb()
      .update(publicForms)
      .set({
        title: data.title,
        descriptionHtml: sanitizeFormHtml(data.descriptionHtml),
        confirmationMessage: data.confirmationMessage,
        fields: data.fields,
        status: data.status,
        openedAt: data.status === "OPEN" && existing.status !== "OPEN" ? now : existing.openedAt,
        closedAt: data.status === "CLOSED" ? now : data.status === "OPEN" ? null : existing.closedAt,
        lastEditorMemberId: actor.id,
        updatedAt: now,
      })
      .where(eq(publicForms.id, data.id));
    await getDb().insert(auditEvents).values({
      actorMemberId: actor.id,
      action: "form.updated",
      entityType: "public_form",
      entityId: data.id,
      details: {
        title: data.title,
        status: data.status,
        questionCount: data.fields.length,
      },
    });
    refreshFormRoutes(existing.accessKey);
    return { status: "success", message: data.status === "OPEN" ? "Form saved and open for responses." : "Form saved." };
  } catch (error) {
    console.error("Form save failed", error);
    if (error instanceof z.ZodError) {
      return { status: "error", message: error.issues[0]?.message || "Check the form fields and try again." };
    }
    return { status: "error", message: "The form could not be saved. Refresh and try again." };
  }
}

export async function duplicatePublicForm(formId: string): Promise<FormManagerState> {
  try {
    const actor = await requirePermission("forms.manage");
    const id = z.uuid().parse(formId);
    const [source] = await getDb().select().from(publicForms).where(eq(publicForms.id, id)).limit(1);
    if (!source) return { status: "error", message: "Form not found." };
    const [copy] = await getDb()
      .insert(publicForms)
      .values({
        accessKey: newAccessKey(),
        title: `${source.title} (copy)`,
        descriptionHtml: source.descriptionHtml,
        confirmationMessage: source.confirmationMessage,
        fields: source.fields.map((field) => ({ ...field, id: randomUUID() })),
        status: "DRAFT",
        createdByMemberId: actor.id,
        lastEditorMemberId: actor.id,
      })
      .returning({ id: publicForms.id, accessKey: publicForms.accessKey });
    await getDb().insert(auditEvents).values({
      actorMemberId: actor.id,
      action: "form.duplicated",
      entityType: "public_form",
      entityId: copy.id,
      details: { sourceFormId: source.id },
    });
    refreshFormRoutes(copy.accessKey);
    return { status: "success", message: "Form duplicated as a draft.", formId: copy.id };
  } catch (error) {
    console.error("Form duplication failed", error);
    return { status: "error", message: "The form could not be duplicated." };
  }
}

export async function deletePublicForm(formId: string): Promise<FormManagerState> {
  try {
    const actor = await requirePermission("forms.manage");
    const id = z.uuid().parse(formId);
    const [form] = await getDb().select().from(publicForms).where(eq(publicForms.id, id)).limit(1);
    if (!form) return { status: "error", message: "Form not found. It may already be deleted." };
    const uploads = await getDb().select({ pathname: publicFormUploads.pathname }).from(publicFormUploads).where(eq(publicFormUploads.formId, id));
    await getDb().delete(publicForms).where(eq(publicForms.id, id));
    if (uploads.length) try { await del(uploads.map((upload) => upload.pathname)); } catch (error) { console.error("Deleted form Blob cleanup failed", error); }
    await getDb().insert(auditEvents).values({
      actorMemberId: actor.id,
      action: "form.deleted",
      entityType: "public_form",
      entityId: id,
      details: { title: form.title, responseCount: form.responseCount },
    });
    refreshFormRoutes(form.accessKey);
    return { status: "success", message: "Form and responses permanently deleted." };
  } catch (error) {
    console.error("Form deletion failed", error);
    return { status: "error", message: "The form could not be deleted." };
  }
}

export async function deletePublicFormResponse(responseId: string): Promise<FormManagerState> {
  try {
    const actor = await requirePermission("forms.manage");
    const id = z.uuid().parse(responseId);
    const uploads = await getDb().select({ pathname: publicFormUploads.pathname }).from(publicFormUploads).where(eq(publicFormUploads.responseId, id));
    const [response] = await getDb()
      .delete(publicFormResponses)
      .where(eq(publicFormResponses.id, id))
      .returning({ formId: publicFormResponses.formId });
    if (!response) return { status: "error", message: "Response not found." };
    if (uploads.length) try { await del(uploads.map((upload) => upload.pathname)); } catch (error) { console.error("Deleted response Blob cleanup failed", error); }
    const [form] = await getDb().select().from(publicForms).where(eq(publicForms.id, response.formId)).limit(1);
    if (form) await getDb()
      .update(publicForms)
      .set({ responseCount: sql`greatest(0, ${publicForms.responseCount} - 1)`, updatedAt: new Date() })
      .where(eq(publicForms.id, form.id));
    await getDb().insert(auditEvents).values({
      actorMemberId: actor.id,
      action: "form.response_deleted",
      entityType: "public_form_response",
      entityId: id,
      details: { formId: response.formId },
    });
    refreshFormRoutes(form?.accessKey);
    return { status: "success", message: "Response deleted." };
  } catch (error) {
    console.error("Form response deletion failed", error);
    return { status: "error", message: "The response could not be deleted." };
  }
}

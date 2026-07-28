"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditEvents,
  internalDocuments,
  publicSettings,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth";

export type ConstitutionActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const publishSchema = z.object({
  documentId: z.string().uuid(),
  version: z.string().trim().min(1).max(100),
  effectiveDate: z.iso.date(),
});

function refreshConstitutionPages() {
  revalidatePath("/admin");
  revalidatePath("/constitution");
  revalidatePath("/resources");
}

export async function publishConstitution(
  formData: FormData,
): Promise<ConstitutionActionState> {
  try {
    const actor = await requirePermission("documents.manage");
    const data = publishSchema.parse({
      documentId: String(formData.get("documentId") || ""),
      version: String(formData.get("version") || ""),
      effectiveDate: String(formData.get("effectiveDate") || ""),
    });
    const [document] = await getDb()
      .select()
      .from(internalDocuments)
      .where(
        eq(internalDocuments.id, data.documentId),
      )
      .limit(1);
    if (!document || document.archivedAt) {
      throw new Error("Choose an active constitution document.");
    }
    if (
      ![
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ].includes(document.mimeType)
    ) {
      throw new Error("The public constitution must be a PDF or DOCX file.");
    }
    const now = new Date();
    const effectiveDate = new Date(`${data.effectiveDate}T12:00:00.000Z`);
    await Promise.all([
      getDb()
        .update(internalDocuments)
        .set({
          category: "Constitution",
          updatedByMemberId: actor.id,
          updatedAt: now,
        })
        .where(eq(internalDocuments.id, document.id)),
      getDb()
        .insert(publicSettings)
        .values({
          id: "site",
          constitutionDocumentId: document.id,
          constitutionVersion: data.version,
          constitutionEffectiveDate: effectiveDate,
          constitutionPublishedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: publicSettings.id,
          set: {
            constitutionDocumentId: document.id,
            constitutionVersion: data.version,
            constitutionEffectiveDate: effectiveDate,
            constitutionPublishedAt: now,
            updatedAt: now,
          },
        }),
      getDb().insert(auditEvents).values({
        actorMemberId: actor.id,
        action: "CONSTITUTION_PUBLISHED",
        entityType: "internal_document",
        entityId: document.id,
        details: {
          version: data.version,
          effectiveDate: data.effectiveDate,
          filename: document.originalFilename,
        },
      }),
    ]);
    refreshConstitutionPages();
    return {
      status: "success",
      message: `${data.version} is now the public constitution.`,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The constitution could not be published.",
    };
  }
}

export async function unpublishConstitution(): Promise<ConstitutionActionState> {
  try {
    const actor = await requirePermission("documents.manage");
    const [settings] = await getDb()
      .select({ documentId: publicSettings.constitutionDocumentId })
      .from(publicSettings)
      .where(eq(publicSettings.id, "site"))
      .limit(1);
    await getDb()
      .update(publicSettings)
      .set({
        constitutionDocumentId: null,
        constitutionVersion: null,
        constitutionEffectiveDate: null,
        constitutionPublishedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(publicSettings.id, "site"));
    await getDb().insert(auditEvents).values({
      actorMemberId: actor.id,
      action: "CONSTITUTION_UNPUBLISHED",
      entityType: "internal_document",
      entityId: settings?.documentId || "none",
      details: {},
    });
    refreshConstitutionPages();
    return {
      status: "success",
      message: "The public constitution was unpublished.",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The constitution could not be unpublished.",
    };
  }
}

"use server";

import { and, asc, eq, gt, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { auditEvents, docCategories, docEditorLocks, docPages, docRevisions } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { docSearchText, sanitizeDocumentationHtml } from "@/lib/docs";

export type DocActionState = { status: "idle" | "success" | "error"; message: string; pageId?: string };
const idle: DocActionState = { status: "idle", message: "" };

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

export async function createDocCategory(_state: DocActionState = idle, formData: FormData): Promise<DocActionState> {
  void _state;
  try {
    const actor = await requirePermission("content.manage");
    const input = z.object({ title: z.string().trim().min(2).max(80), parentId: z.union([z.literal(""), z.uuid()]).optional() }).parse(Object.fromEntries(formData));
    const slug = slugify(input.title);
    if (!slug) return { status: "error", message: "Enter a valid category title." };
    const [category] = await getDb().insert(docCategories).values({ title: input.title, slug, parentId: input.parentId || null }).returning();
    await getDb().insert(auditEvents).values({ actorMemberId: actor.id, action: "docs.category_created", entityType: "doc_category", entityId: category.id });
    revalidatePath("/admin"); revalidatePath("/docs");
    return { status: "success", message: "Category created." };
  } catch (error) { return { status: "error", message: error instanceof Error ? error.message : "Could not create category." }; }
}

export async function createDocPage(_state: DocActionState = idle, formData: FormData): Promise<DocActionState> {
  void _state;
  try {
    const actor = await requirePermission("content.manage");
    const input = z.object({ title: z.string().trim().min(2).max(140), categoryId: z.uuid(), visibility: z.enum(["PUBLIC", "MEMBERS_ONLY"]) }).parse(Object.fromEntries(formData));
    const [category] = await getDb().select().from(docCategories).where(eq(docCategories.id, input.categoryId)).limit(1);
    if (!category) return { status: "error", message: "Choose a valid category." };
    const slug = slugify(input.title);
    const [page] = await getDb().insert(docPages).values({ categoryId: category.id, slug, path: `${category.slug}/${slug}`, title: input.title, visibility: input.visibility, authorMemberId: actor.id, lastEditorMemberId: actor.id }).returning();
    await getDb().insert(auditEvents).values({ actorMemberId: actor.id, action: "docs.page_created", entityType: "doc_page", entityId: page.id });
    revalidatePath("/admin"); revalidatePath("/docs");
    return { status: "success", message: "Page created. Open it below to start writing.", pageId: page.id };
  } catch (error) { return { status: "error", message: error instanceof Error ? error.message : "Could not create page." }; }
}

const pageInput = z.object({ pageId: z.uuid(), title: z.string().trim().min(2).max(140), summary: z.string().trim().max(400), bodyHtml: z.string().max(500_000), bodyJson: z.record(z.string(), z.unknown()), visibility: z.enum(["PUBLIC", "MEMBERS_ONLY"]) });

export async function saveDocPage(input: z.infer<typeof pageInput> & { publish?: boolean; reason?: string }): Promise<DocActionState> {
  try {
    const actor = await requirePermission("content.manage");
    const data = pageInput.parse(input);
    const [page] = await getDb().select().from(docPages).where(eq(docPages.id, data.pageId)).limit(1);
    if (!page) return { status: "error", message: "Documentation page not found." };
    const cleanHtml = sanitizeDocumentationHtml(data.bodyHtml);
    const status = input.publish ? "PUBLISHED" : page.status;
    await getDb().update(docPages).set({ title: data.title, summary: data.summary, bodyHtml: cleanHtml, bodyJson: data.bodyJson, searchText: docSearchText(cleanHtml), visibility: data.visibility, status, publishedAt: input.publish ? new Date() : page.publishedAt, archivedAt: null, lastEditorMemberId: actor.id, updatedAt: new Date() }).where(eq(docPages.id, page.id));
    if (input.reason !== "autosave") {
      await getDb().insert(docRevisions).values({ pageId: page.id, editorMemberId: actor.id, title: data.title, summary: data.summary, bodyHtml: cleanHtml, bodyJson: data.bodyJson, visibility: data.visibility, status, reason: input.reason || (input.publish ? "publish" : "manual save") });
      await getDb().insert(auditEvents).values({ actorMemberId: actor.id, action: input.publish ? "docs.page_published" : "docs.page_saved", entityType: "doc_page", entityId: page.id });
    }
    revalidatePath("/admin"); revalidatePath("/docs"); revalidatePath(`/docs/${page.path}`);
    return { status: "success", message: input.reason === "autosave" ? "Autosaved" : input.publish ? "Published." : "Draft saved." };
  } catch (error) { return { status: "error", message: error instanceof Error ? error.message : "Could not save page." }; }
}

export async function archiveDocPage(pageId: string) {
  const actor = await requirePermission("content.manage");
  const id = z.uuid().parse(pageId);
  await getDb().update(docPages).set({ status: "ARCHIVED", archivedAt: new Date(), updatedAt: new Date(), lastEditorMemberId: actor.id }).where(eq(docPages.id, id));
  await getDb().insert(auditEvents).values({ actorMemberId: actor.id, action: "docs.page_archived", entityType: "doc_page", entityId: id });
  revalidatePath("/admin"); revalidatePath("/docs");
}

const structureInput = z.object({
  categories: z.array(z.uuid()).max(100),
  pages: z.array(z.object({
    id: z.uuid(),
    categoryId: z.uuid(),
  })).max(1000),
});

export async function reorderDocumentationStructure(
  input: z.input<typeof structureInput>,
): Promise<DocActionState> {
  try {
    const actor = await requirePermission("content.manage");
    const data = structureInput.parse(input);
    if (new Set(data.categories).size !== data.categories.length)
      throw new Error("A category appears more than once in the requested order.");
    if (new Set(data.pages.map((page) => page.id)).size !== data.pages.length)
      throw new Error("A page appears more than once in the requested order.");

    const db = getDb();
    const existingCategories = await db
      .select({ id: docCategories.id, slug: docCategories.slug })
      .from(docCategories)
      .where(isNull(docCategories.archivedAt));
    const categoryById = new Map(
      existingCategories.map((category) => [category.id, category]),
    );
    if (data.categories.some((id) => !categoryById.has(id)))
      throw new Error("One of the documentation categories is no longer available.");
    if (data.pages.some((page) => !categoryById.has(page.categoryId)))
      throw new Error("Choose an active destination category for every page.");

    const pageRows = await db
      .select({ id: docPages.id, slug: docPages.slug })
      .from(docPages);
    const pageById = new Map(pageRows.map((page) => [page.id, page]));
    if (data.pages.some((page) => !pageById.has(page.id)))
      throw new Error("One of the documentation pages is no longer available.");

    const pathKeys = new Set<string>();
    for (const page of data.pages) {
      const key = `${page.categoryId}/${pageById.get(page.id)!.slug}`;
      if (pathKeys.has(key))
        throw new Error("Two pages with the same URL name cannot share a category.");
      pathKeys.add(key);
    }

    await db.transaction(async (tx) => {
      for (const [sortOrder, id] of data.categories.entries()) {
        await tx
          .update(docCategories)
          .set({ sortOrder, updatedAt: new Date() })
          .where(eq(docCategories.id, id));
      }
      const nextOrder = new Map<string, number>();
      for (const page of data.pages) {
        const sortOrder = nextOrder.get(page.categoryId) ?? 0;
        nextOrder.set(page.categoryId, sortOrder + 1);
        const category = categoryById.get(page.categoryId)!;
        const current = pageById.get(page.id)!;
        await tx
          .update(docPages)
          .set({
            categoryId: page.categoryId,
            path: `${category.slug}/${current.slug}`,
            sortOrder,
            updatedAt: new Date(),
          })
          .where(eq(docPages.id, page.id));
      }
      await tx.insert(auditEvents).values({
        actorMemberId: actor.id,
        action: "docs.structure_reordered",
        entityType: "documentation",
        entityId: "structure",
        details: { categories: data.categories.length, pages: data.pages.length },
      });
    });
    revalidatePath("/admin");
    revalidatePath("/docs");
    return { status: "success", message: "Documentation order saved." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not reorder documentation.",
    };
  }
}

export async function removeDocCategory(
  categoryId: string,
): Promise<DocActionState> {
  try {
    const actor = await requirePermission("content.manage");
    const id = z.uuid().parse(categoryId);
    const db = getDb();
    const categories = await db
      .select({ id: docCategories.id, slug: docCategories.slug })
      .from(docCategories)
      .where(isNull(docCategories.archivedAt))
      .orderBy(asc(docCategories.sortOrder));
    const category = categories.find((candidate) => candidate.id === id);
    if (!category) throw new Error("Category not found.");
    const categoryPages = await db
      .select({ id: docPages.id, slug: docPages.slug })
      .from(docPages)
      .where(eq(docPages.categoryId, id));
    const allPages = await db
      .select({ categoryId: docPages.categoryId, slug: docPages.slug })
      .from(docPages);
    const movingSlugs = new Set(categoryPages.map((page) => page.slug));
    const destination = categories.find((candidate) => {
      if (candidate.id === id) return false;
      return !allPages.some(
        (page) => page.categoryId === candidate.id && movingSlugs.has(page.slug),
      );
    });
    if (categoryPages.length && !destination)
      throw new Error("Create another category without matching page URLs before removing this category.");

    await db.transaction(async (tx) => {
      if (destination) {
        for (const [sortOrder, page] of categoryPages.entries()) {
          await tx
            .update(docPages)
            .set({
              categoryId: destination.id,
              path: `${destination.slug}/${page.slug}`,
              sortOrder: 10_000 + sortOrder,
              updatedAt: new Date(),
            })
            .where(eq(docPages.id, page.id));
        }
        await tx
          .update(docCategories)
          .set({ parentId: null, updatedAt: new Date() })
          .where(eq(docCategories.parentId, id));
      }
      await tx
        .update(docCategories)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(docCategories.id, id));
      await tx.insert(auditEvents).values({
        actorMemberId: actor.id,
        action: "docs.category_removed",
        entityType: "doc_category",
        entityId: id,
        details: {
          movedPages: categoryPages.length,
          destinationCategoryId: destination?.id ?? null,
        },
      });
    });
    revalidatePath("/admin");
    revalidatePath("/docs");
    return {
      status: "success",
      message: destination && categoryPages.length
        ? `Category removed. ${categoryPages.length} page${categoryPages.length === 1 ? "" : "s"} moved to the next category.`
        : "Category removed.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not remove category.",
    };
  }
}

export async function acquireDocLock(pageId: string): Promise<DocActionState> {
  const actor = await requirePermission("content.manage");
  const id = z.uuid().parse(pageId);
  const now = new Date();
  const [other] = await getDb().select().from(docEditorLocks).where(and(eq(docEditorLocks.pageId, id), ne(docEditorLocks.memberId, actor.id), gt(docEditorLocks.expiresAt, now))).limit(1);
  if (other) return { status: "error", message: "Another admin is editing this page. Try again in a few minutes." };
  await getDb().insert(docEditorLocks).values({ pageId: id, memberId: actor.id, expiresAt: new Date(Date.now() + 5 * 60_000) }).onConflictDoUpdate({ target: docEditorLocks.pageId, set: { memberId: actor.id, expiresAt: new Date(Date.now() + 5 * 60_000), updatedAt: now } });
  return { status: "success", message: "Editing lock active." };
}

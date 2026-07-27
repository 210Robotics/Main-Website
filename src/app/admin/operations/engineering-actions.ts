"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import sanitizeHtml from "sanitize-html";
import { getDb } from "@/db";
import {
  auditEvents,
  designChanges,
  engineeringNotebookComments,
  engineeringNotebookEntries,
  engineeringNotebookVersions,
  engineeringProjects,
  engineeringSeasons,
  engineeringSubsystems,
  financeEntries,
  inventoryItems,
  internalDocuments,
  purchaseRequests,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import {
  designChangeStatuses,
  notebookCommentKinds,
  notebookEntryTypes,
  notebookStatuses,
  parseTags,
  projectStatuses,
  purchaseStatuses,
  seasonStatuses,
} from "@/lib/engineering-operations";
import {
  dateValue,
  moneyToCents,
  optionalDate,
  textValue,
} from "@/lib/operations";

function refresh() {
  revalidatePath("/admin/operations");
  revalidatePath("/portal");
}

async function audit(
  actorMemberId: string,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown> = {},
) {
  await getDb().insert(auditEvents).values({
    actorMemberId,
    action,
    entityType,
    entityId,
    details,
  });
}

function optionalId(formData: FormData, key: string) {
  return textValue(formData, key) || null;
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function wholeNumber(
  formData: FormData,
  key: string,
  options: { min?: number; max?: number; fallback?: number } = {},
) {
  const value = Number(textValue(formData, key) || options.fallback || 0);
  const minimum = options.min ?? 0;
  const maximum = options.max ?? 100000;
  if (!Number.isInteger(value) || value < minimum || value > maximum)
    throw new Error(`${key} must be a whole number from ${minimum} to ${maximum}.`);
  return value;
}

function allowed<T extends readonly string[]>(
  value: string,
  options: T,
  label: string,
) {
  if (!(options as readonly string[]).includes(value))
    throw new Error(`Choose a valid ${label}.`);
  return value as T[number];
}

export async function saveEngineeringSeason(formData: FormData) {
  const actor = await requirePermission("seasons.manage");
  const id = textValue(formData, "id");
  const status = allowed(
    textValue(formData, "status") || "ACTIVE",
    seasonStatuses,
    "season status",
  );
  const startsAt = dateValue(formData.get("startsAt"));
  const endsAt = dateValue(formData.get("endsAt"));
  if (endsAt <= startsAt) throw new Error("Season end must be after its start.");
  const values = {
    name: textValue(formData, "name", true),
    competition: textValue(formData, "competition") || "VEX U",
    gameName: textValue(formData, "gameName") || "Override",
    gameManualVersion: textValue(formData, "gameManualVersion") || "1.0",
    status,
    startsAt,
    endsAt,
    isDefault: checked(formData, "isDefault"),
    updatedAt: new Date(),
  };
  if (values.isDefault)
    await getDb().update(engineeringSeasons).set({ isDefault: false });
  if (id) {
    const [row] = await getDb()
      .update(engineeringSeasons)
      .set(values)
      .where(eq(engineeringSeasons.id, id))
      .returning();
    if (!row) throw new Error("Season not found.");
    await audit(actor.id, "engineering.season_updated", "engineering_season", id);
  } else {
    const [row] = await getDb()
      .insert(engineeringSeasons)
      .values({ ...values, createdByMemberId: actor.id })
      .returning();
    await audit(actor.id, "engineering.season_created", "engineering_season", row.id);
  }
  refresh();
}

export async function saveEngineeringProject(formData: FormData) {
  const actor = await requirePermission("seasons.manage");
  const id = textValue(formData, "id");
  const status = allowed(
    textValue(formData, "status") || "ACTIVE",
    projectStatuses,
    "project status",
  );
  const values = {
    seasonId: textValue(formData, "seasonId", true),
    code: textValue(formData, "code", true).toUpperCase(),
    name: textValue(formData, "name", true),
    description: textValue(formData, "description"),
    status,
    leadMemberId: optionalId(formData, "leadMemberId"),
    startsAt: optionalDate(formData.get("startsAt")),
    dueAt: optionalDate(formData.get("dueAt")),
    updatedAt: new Date(),
  };
  if (id) {
    const [row] = await getDb()
      .update(engineeringProjects)
      .set(values)
      .where(eq(engineeringProjects.id, id))
      .returning();
    if (!row) throw new Error("Project not found.");
    await audit(actor.id, "engineering.project_updated", "engineering_project", id);
  } else {
    const [row] = await getDb()
      .insert(engineeringProjects)
      .values({ ...values, createdByMemberId: actor.id })
      .returning();
    await audit(actor.id, "engineering.project_created", "engineering_project", row.id);
  }
  refresh();
}

export async function saveEngineeringSubsystem(formData: FormData) {
  const actor = await requirePermission("seasons.manage");
  const id = textValue(formData, "id");
  const status = allowed(
    textValue(formData, "status") || "ACTIVE",
    projectStatuses,
    "subsystem status",
  );
  const values = {
    projectId: textValue(formData, "projectId", true),
    code: textValue(formData, "code", true).toUpperCase(),
    name: textValue(formData, "name", true),
    description: textValue(formData, "description"),
    status,
    leadMemberId: optionalId(formData, "leadMemberId"),
    updatedAt: new Date(),
  };
  if (id) {
    const [row] = await getDb()
      .update(engineeringSubsystems)
      .set(values)
      .where(eq(engineeringSubsystems.id, id))
      .returning();
    if (!row) throw new Error("Subsystem not found.");
    await audit(actor.id, "engineering.subsystem_updated", "engineering_subsystem", id);
  } else {
    const [row] = await getDb()
      .insert(engineeringSubsystems)
      .values({ ...values, createdByMemberId: actor.id })
      .returning();
    await audit(actor.id, "engineering.subsystem_created", "engineering_subsystem", row.id);
  }
  refresh();
}

function cleanNotebookHtml(value: string) {
  return sanitizeHtml(value, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "sub",
      "sup",
      "mark",
      "h1",
      "h2",
      "h3",
      "h4",
      "ul",
      "ol",
      "li",
      "blockquote",
      "code",
      "pre",
      "a",
      "img",
      "hr",
      "div",
      "label",
      "input",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel", "title", "class", "data-link-embed"],
      img: ["src", "alt", "title", "width", "height"],
      hr: ["data-page-break", "class"],
      ul: ["data-type"],
      li: ["data-type", "data-checked"],
      div: ["data-type"],
      input: ["type", "checked", "disabled"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
      p: ["style"],
      h1: ["style"],
      h2: ["style"],
      h3: ["style"],
      h4: ["style"],
    },
    allowedStyles: {
      "*": { "text-align": [/^left$/, /^center$/, /^right$/, /^justify$/] },
    },
    allowedSchemes: ["http", "https", "mailto"],
  });
}

function notebookValues(formData: FormData) {
  const entryType = allowed(
    textValue(formData, "entryType") || "DESIGN",
    notebookEntryTypes,
    "notebook entry type",
  );
  const status = allowed(
    textValue(formData, "status") || "DRAFT",
    notebookStatuses,
    "notebook status",
  );
  const contentHtml = cleanNotebookHtml(
    textValue(formData, "contentHtml") || "<p></p>",
  );
  const heading = contentHtml.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1];
  const headingTitle = heading
    ? sanitizeHtml(heading, { allowedTags: [], allowedAttributes: {} })
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 180)
    : "";
  return {
    seasonId: textValue(formData, "seasonId", true),
    projectId: optionalId(formData, "projectId"),
    subsystemId: optionalId(formData, "subsystemId"),
    title: headingTitle || textValue(formData, "title") || "Untitled notebook page",
    entryType,
    status,
    entryDate: dateValue(formData.get("entryDate")),
    contentHtml,
    objective: textValue(formData, "objective"),
    decisions: textValue(formData, "decisions"),
    results: textValue(formData, "results"),
    nextSteps: textValue(formData, "nextSteps"),
    tags: parseTags(textValue(formData, "tags")),
  };
}

function versionSnapshot(values: ReturnType<typeof notebookValues>) {
  return {
    ...values,
    entryDate: values.entryDate.toISOString(),
  };
}

export async function saveNotebookEntry(formData: FormData) {
  const actor = await requirePermission("notebook.manage");
  const id = textValue(formData, "id");
  const values = notebookValues(formData);
  const changeSummary = textValue(formData, "changeSummary") || "Saved notebook entry";
  if (id) {
    const [existing] = await getDb()
      .select()
      .from(engineeringNotebookEntries)
      .where(eq(engineeringNotebookEntries.id, id))
      .limit(1);
    if (!existing) throw new Error("Notebook entry not found.");
    const nextVersion = existing.currentVersion + 1;
    await getDb()
      .update(engineeringNotebookEntries)
      .set({
        ...values,
        currentVersion: nextVersion,
        updatedByMemberId: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(engineeringNotebookEntries.id, id));
    await getDb().insert(engineeringNotebookVersions).values({
      entryId: id,
      versionNumber: nextVersion,
      snapshot: versionSnapshot(values),
      changeSummary,
      createdByMemberId: actor.id,
    });
    await audit(actor.id, "notebook.entry_updated", "notebook_entry", id, {
      version: nextVersion,
      changeSummary,
    });
  } else {
    const [lastPage] = await getDb()
      .select({ sortOrder: sql<number>`coalesce(max(${engineeringNotebookEntries.sortOrder}), -1)` })
      .from(engineeringNotebookEntries)
      .where(eq(engineeringNotebookEntries.seasonId, values.seasonId));
    const [row] = await getDb()
      .insert(engineeringNotebookEntries)
      .values({
        ...values,
        sortOrder: Number(lastPage?.sortOrder ?? -1) + 1,
        createdByMemberId: actor.id,
        updatedByMemberId: actor.id,
      })
      .returning();
    await getDb().insert(engineeringNotebookVersions).values({
      entryId: row.id,
      versionNumber: 1,
      snapshot: versionSnapshot(values),
      changeSummary: changeSummary || "Initial entry",
      createdByMemberId: actor.id,
    });
    await audit(actor.id, "notebook.entry_created", "notebook_entry", row.id, {
      version: 1,
    });
  }
  refresh();
}

export async function importArchivedDocumentToNotebook(formData: FormData) {
  const actor = await requirePermission("notebook.manage");
  const documentId = textValue(formData, "documentId", true);
  const seasonId = textValue(formData, "seasonId", true);
  const entryType = allowed(
    textValue(formData, "entryType") || "DESIGN",
    notebookEntryTypes,
    "notebook entry type",
  );
  const [document] = await getDb()
    .select()
    .from(internalDocuments)
    .where(eq(internalDocuments.id, documentId))
    .limit(1);
  if (!document || document.archivedAt) throw new Error("Imported document not found.");
  const entryDate = new Date();
  const values = {
    seasonId,
    projectId: optionalId(formData, "projectId"),
    subsystemId: optionalId(formData, "subsystemId"),
    title: textValue(formData, "title") || document.title,
    entryType,
    status: "DRAFT",
    entryDate,
    contentHtml: cleanNotebookHtml(document.contentHtml),
    objective: "",
    decisions: "",
    results: "",
    nextSteps: "",
    tags: [
      "imported-document",
      document.mimeType === "application/pdf" ? "pdf-import" : "docx-import",
    ],
  };
  const [lastPage] = await getDb()
    .select({ sortOrder: sql<number>`coalesce(max(${engineeringNotebookEntries.sortOrder}), -1)` })
    .from(engineeringNotebookEntries)
    .where(eq(engineeringNotebookEntries.seasonId, seasonId));
  const [row] = await getDb()
    .insert(engineeringNotebookEntries)
    .values({
      ...values,
      sortOrder: Number(lastPage?.sortOrder ?? -1) + 1,
      createdByMemberId: actor.id,
      updatedByMemberId: actor.id,
    })
    .returning();
  await getDb().insert(engineeringNotebookVersions).values({
    entryId: row.id,
    versionNumber: 1,
    snapshot: {
      ...values,
      entryDate: entryDate.toISOString(),
    },
    changeSummary: `Imported from ${document.originalFilename}`,
    createdByMemberId: actor.id,
  });
  await audit(actor.id, "notebook.document_imported", "notebook_entry", row.id, {
    documentId,
    filename: document.originalFilename,
  });
  refresh();
  return { id: row.id };
}

export async function reorderNotebookPages(pageIds: string[]) {
  const actor = await requirePermission("notebook.manage");
  const ids = pageIds.map(String);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!ids.length || ids.length > 1000 || new Set(ids).size !== ids.length || ids.some((id) => !uuid.test(id)))
    throw new Error("Choose a valid notebook page order.");
  const existing = await getDb()
    .select({ id: engineeringNotebookEntries.id })
    .from(engineeringNotebookEntries);
  const existingIds = new Set(existing.map((entry) => entry.id));
  if (ids.some((id) => !existingIds.has(id)))
    throw new Error("One of the notebook pages is no longer available.");
  await getDb().transaction(async (tx) => {
    for (const [sortOrder, id] of ids.entries()) {
      await tx
        .update(engineeringNotebookEntries)
        .set({ sortOrder, updatedAt: new Date() })
        .where(eq(engineeringNotebookEntries.id, id));
    }
    await tx.insert(auditEvents).values({
      actorMemberId: actor.id,
      action: "notebook.pages_reordered",
      entityType: "engineering_notebook",
      entityId: "page-order",
      details: { pageCount: ids.length },
    });
  });
  refresh();
  return { status: "success" as const, message: "Notebook page order saved." };
}

export async function deleteNotebookPage(pageId: string) {
  const actor = await requirePermission("notebook.manage");
  const id = String(pageId);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
    throw new Error("Choose a valid notebook page.");
  const [deleted] = await getDb()
    .delete(engineeringNotebookEntries)
    .where(eq(engineeringNotebookEntries.id, id))
    .returning({ id: engineeringNotebookEntries.id, title: engineeringNotebookEntries.title });
  if (!deleted) throw new Error("Notebook page not found.");
  await audit(actor.id, "notebook.page_deleted", "notebook_entry", id, {
    title: deleted.title,
  });
  refresh();
  return { status: "success" as const, message: "Notebook page deleted." };
}

export async function restoreNotebookVersion(formData: FormData) {
  const actor = await requirePermission("notebook.manage");
  const entryId = textValue(formData, "entryId", true);
  const versionId = textValue(formData, "versionId", true);
  const [entry] = await getDb()
    .select()
    .from(engineeringNotebookEntries)
    .where(eq(engineeringNotebookEntries.id, entryId))
    .limit(1);
  const [version] = await getDb()
    .select()
    .from(engineeringNotebookVersions)
    .where(
      and(
        eq(engineeringNotebookVersions.id, versionId),
        eq(engineeringNotebookVersions.entryId, entryId),
      ),
    )
    .limit(1);
  if (!entry || !version) throw new Error("Notebook version not found.");
  const nextVersion = entry.currentVersion + 1;
  const snapshot = version.snapshot;
  await getDb()
    .update(engineeringNotebookEntries)
    .set({
      title: snapshot.title,
      entryType: snapshot.entryType,
      status: snapshot.status,
      entryDate: new Date(snapshot.entryDate),
      projectId: snapshot.projectId,
      subsystemId: snapshot.subsystemId,
      contentHtml: snapshot.contentHtml,
      objective: snapshot.objective,
      decisions: snapshot.decisions,
      results: snapshot.results,
      nextSteps: snapshot.nextSteps,
      tags: snapshot.tags,
      currentVersion: nextVersion,
      updatedByMemberId: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(engineeringNotebookEntries.id, entryId));
  await getDb().insert(engineeringNotebookVersions).values({
    entryId,
    versionNumber: nextVersion,
    snapshot,
    changeSummary: `Restored version ${version.versionNumber}`,
    createdByMemberId: actor.id,
  });
  await audit(actor.id, "notebook.version_restored", "notebook_entry", entryId, {
    restoredVersion: version.versionNumber,
    newVersion: nextVersion,
  });
  refresh();
}

export async function saveNotebookComment(formData: FormData) {
  const actor = await requirePermission("notebook.manage");
  const kind = allowed(
    textValue(formData, "kind") || "COMMENT",
    notebookCommentKinds,
    "comment type",
  );
  const [row] = await getDb()
    .insert(engineeringNotebookComments)
    .values({
      entryId: textValue(formData, "entryId", true),
      memberId: actor.id,
      kind,
      body: textValue(formData, "body", true),
    })
    .returning();
  await audit(actor.id, "notebook.comment_created", "notebook_comment", row.id, {
    kind,
  });
  refresh();
}

export async function resolveNotebookComment(formData: FormData) {
  const actor = await requirePermission("notebook.manage");
  const id = textValue(formData, "id", true);
  const [row] = await getDb()
    .update(engineeringNotebookComments)
    .set({
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedByMemberId: actor.id,
    })
    .where(eq(engineeringNotebookComments.id, id))
    .returning();
  if (!row) throw new Error("Notebook comment not found.");
  await audit(actor.id, "notebook.comment_resolved", "notebook_comment", id);
  refresh();
}

export async function saveInventoryItem(formData: FormData) {
  const actor = await requirePermission("inventory.manage");
  const id = textValue(formData, "id");
  const quantityOnHand = wholeNumber(formData, "quantityOnHand", { max: 100000 });
  const quantityReserved = wholeNumber(formData, "quantityReserved", { max: 100000 });
  if (quantityReserved > quantityOnHand)
    throw new Error("Reserved quantity cannot exceed quantity on hand.");
  const values = {
    seasonId: optionalId(formData, "seasonId"),
    projectId: optionalId(formData, "projectId"),
    subsystemId: optionalId(formData, "subsystemId"),
    partId: optionalId(formData, "partId"),
    sku: textValue(formData, "sku", true).toUpperCase(),
    name: textValue(formData, "name", true),
    category: textValue(formData, "category") || "Robot parts",
    location: textValue(formData, "location") || "Shop",
    quantityOnHand,
    quantityReserved,
    reorderPoint: wholeNumber(formData, "reorderPoint", { max: 100000 }),
    unitCostCents: moneyToCents(formData.get("unitCost")),
    supplier: textValue(formData, "supplier"),
    status: textValue(formData, "status") || "ACTIVE",
    notes: textValue(formData, "notes"),
    updatedAt: new Date(),
  };
  if (id) {
    const [row] = await getDb()
      .update(inventoryItems)
      .set(values)
      .where(eq(inventoryItems.id, id))
      .returning();
    if (!row) throw new Error("Inventory item not found.");
    await audit(actor.id, "inventory.item_updated", "inventory_item", id);
  } else {
    const [row] = await getDb()
      .insert(inventoryItems)
      .values({ ...values, createdByMemberId: actor.id })
      .returning();
    await audit(actor.id, "inventory.item_created", "inventory_item", row.id);
  }
  refresh();
}

export async function deleteInventoryItem(formData: FormData) {
  const actor = await requirePermission("inventory.manage");
  const id = textValue(formData, "id", true);
  const [row] = await getDb()
    .delete(inventoryItems)
    .where(eq(inventoryItems.id, id))
    .returning();
  if (row) await audit(actor.id, "inventory.item_deleted", "inventory_item", id);
  refresh();
}

export async function savePurchaseRequest(formData: FormData) {
  const actor = await requirePermission("purchasing.manage");
  const id = textValue(formData, "id");
  const status = allowed(
    textValue(formData, "status") || "DRAFT",
    purchaseStatuses,
    "purchase status",
  );
  const quantity = wholeNumber(formData, "quantity", { min: 1, max: 9999, fallback: 1 });
  const values = {
    seasonId: optionalId(formData, "seasonId"),
    projectId: optionalId(formData, "projectId"),
    subsystemId: optionalId(formData, "subsystemId"),
    inventoryItemId: optionalId(formData, "inventoryItemId"),
    financePlanId: optionalId(formData, "financePlanId"),
    item: textValue(formData, "item", true),
    category: textValue(formData, "category") || "Robot parts",
    vendor: textValue(formData, "vendor"),
    quantity,
    estimatedUnitCostCents: moneyToCents(formData.get("estimatedUnitCost")),
    priority: textValue(formData, "priority") || "NORMAL",
    status,
    neededBy: optionalDate(formData.get("neededBy")),
    notes: textValue(formData, "notes"),
    updatedAt: new Date(),
  };
  if (id) {
    const [existing] = await getDb()
      .select({ status: purchaseRequests.status })
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, id))
      .limit(1);
    if (!existing) throw new Error("Purchase request not found.");
    const editableStatuses = ["DRAFT", "SUBMITTED"];
    const nextStatus =
      editableStatuses.includes(existing.status) && editableStatuses.includes(status)
        ? status
        : existing.status;
    const [row] = await getDb()
      .update(purchaseRequests)
      .set({ ...values, status: nextStatus })
      .where(eq(purchaseRequests.id, id))
      .returning();
    if (!row) throw new Error("Purchase request not found.");
    await audit(actor.id, "purchasing.request_updated", "purchase_request", id);
  } else {
    if (!(["DRAFT", "SUBMITTED"] as string[]).includes(status)) {
      throw new Error("New purchase requests must be saved as a draft or submitted for review.");
    }
    const [row] = await getDb()
      .insert(purchaseRequests)
      .values({ ...values, requestedByMemberId: actor.id })
      .returning();
    await audit(actor.id, "purchasing.request_created", "purchase_request", row.id);
  }
  refresh();
}

export async function reviewPurchaseRequest(formData: FormData) {
  const actor = await requirePermission("purchasing.manage");
  const id = textValue(formData, "id", true);
  const status = allowed(
    textValue(formData, "status", true),
    purchaseStatuses,
    "purchase status",
  );
  const [existing] = await getDb()
    .select()
    .from(purchaseRequests)
    .where(eq(purchaseRequests.id, id))
    .limit(1);
  if (!existing) throw new Error("Purchase request not found.");
  const now = new Date();
  let financeEntryId = existing.financeEntryId;
  if (status === "RECEIVED" && existing.status !== "RECEIVED") {
    if (existing.inventoryItemId) {
      await getDb()
        .update(inventoryItems)
        .set({
          quantityOnHand: sql`${inventoryItems.quantityOnHand} + ${existing.quantity}`,
          updatedAt: now,
        })
        .where(eq(inventoryItems.id, existing.inventoryItemId));
    }
    if (existing.financePlanId && !financeEntryId) {
      const [financeRow] = await getDb()
        .insert(financeEntries)
        .values({
          planId: existing.financePlanId,
          subsystemId: existing.subsystemId,
          kind: "EXPENSE",
          category: existing.category,
          description: existing.item,
          vendor: existing.vendor,
          quantity: existing.quantity,
          unitCostCents: existing.estimatedUnitCostCents,
          amountCents: existing.quantity * existing.estimatedUnitCostCents,
          status: "PAID",
          occurredAt: now,
          notes: `Created automatically from purchase request ${existing.id}.`,
          createdByMemberId: actor.id,
        })
        .returning();
      financeEntryId = financeRow.id;
    }
  }
  await getDb()
    .update(purchaseRequests)
    .set({
      status,
      approvedByMemberId: ["APPROVED", "ORDERED", "RECEIVED"].includes(status)
        ? actor.id
        : existing.approvedByMemberId,
      approvedAt: ["APPROVED", "ORDERED", "RECEIVED"].includes(status)
        ? existing.approvedAt || now
        : existing.approvedAt,
      orderedAt: ["ORDERED", "RECEIVED"].includes(status)
        ? existing.orderedAt || now
        : existing.orderedAt,
      receivedAt: status === "RECEIVED" ? existing.receivedAt || now : existing.receivedAt,
      financeEntryId,
      updatedAt: now,
    })
    .where(eq(purchaseRequests.id, id));
  await audit(actor.id, "purchasing.status_changed", "purchase_request", id, {
    from: existing.status,
    to: status,
  });
  refresh();
}

export async function saveDesignChange(formData: FormData) {
  const actor = await requirePermission("design_changes.manage");
  const id = textValue(formData, "id");
  const status = allowed(
    textValue(formData, "status") || "DRAFT",
    designChangeStatuses,
    "design change status",
  );
  const values = {
    seasonId: optionalId(formData, "seasonId"),
    projectId: optionalId(formData, "projectId"),
    subsystemId: optionalId(formData, "subsystemId"),
    partId: optionalId(formData, "partId"),
    changeNumber: textValue(formData, "changeNumber", true).toUpperCase(),
    title: textValue(formData, "title", true),
    reason: textValue(formData, "reason", true),
    description: textValue(formData, "description", true),
    impact: textValue(formData, "impact"),
    costImpactCents: moneyToCents(formData.get("costImpact")),
    scheduleImpactDays: wholeNumber(formData, "scheduleImpactDays", { max: 3650 }),
    risk: textValue(formData, "risk") || "MEDIUM",
    status,
    revisionFrom: textValue(formData, "revisionFrom"),
    revisionTo: textValue(formData, "revisionTo"),
    verificationPlan: textValue(formData, "verificationPlan"),
    verificationResults: textValue(formData, "verificationResults"),
    updatedAt: new Date(),
  };
  if (id) {
    const [existing] = await getDb()
      .select({ status: designChanges.status })
      .from(designChanges)
      .where(eq(designChanges.id, id))
      .limit(1);
    if (!existing) throw new Error("Design change not found.");
    const editableStatuses = ["DRAFT", "IN_REVIEW"];
    const nextStatus =
      editableStatuses.includes(existing.status) && editableStatuses.includes(status)
        ? status
        : existing.status;
    const [row] = await getDb()
      .update(designChanges)
      .set({ ...values, status: nextStatus })
      .where(eq(designChanges.id, id))
      .returning();
    if (!row) throw new Error("Design change not found.");
    await audit(actor.id, "design_change.updated", "design_change", id, {
      status: nextStatus,
    });
  } else {
    if (!(["DRAFT", "IN_REVIEW"] as string[]).includes(status)) {
      throw new Error("New design changes must be drafts or submitted for review.");
    }
    const [row] = await getDb()
      .insert(designChanges)
      .values({ ...values, requestedByMemberId: actor.id })
      .returning();
    await audit(actor.id, "design_change.created", "design_change", row.id);
  }
  refresh();
}

export async function reviewDesignChange(formData: FormData) {
  const actor = await requirePermission("design_changes.manage");
  const id = textValue(formData, "id", true);
  const status = allowed(
    textValue(formData, "status", true),
    designChangeStatuses,
    "design change status",
  );
  const now = new Date();
  const [row] = await getDb()
    .update(designChanges)
    .set({
      status,
      approvedByMemberId: status === "APPROVED" || status === "IMPLEMENTED" ? actor.id : null,
      approvedAt: status === "APPROVED" || status === "IMPLEMENTED" ? now : null,
      implementedAt: status === "IMPLEMENTED" ? now : null,
      updatedAt: now,
    })
    .where(eq(designChanges.id, id))
    .returning();
  if (!row) throw new Error("Design change not found.");
  await audit(actor.id, "design_change.reviewed", "design_change", id, { status });
  refresh();
}

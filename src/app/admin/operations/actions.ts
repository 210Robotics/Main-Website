"use server";

import { randomBytes } from "node:crypto";
import { and, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditEvents,
  designChanges,
  donationCampaignSettings,
  donations,
  engineeringParts,
  financeEntries,
  financePlans,
  financeSponsorCommitments,
  glossaryTerms,
  manufacturingSteps,
  mediaAssets,
  meetingDecisions,
  meetingNotes,
  memberTasks,
  members,
  publicSettings,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import {
  DEFAULT_DONATION_CAMPAIGN,
} from "@/lib/donations";
import { notifyDiscordAdmin } from "@/lib/discord";
import { parseSuggestedDonationAmounts } from "@/lib/donation-math";
import {
  dateValue,
  financeEntryKinds,
  financeEntryStatuses,
  moneyToCents,
  optionalDate,
  taskPriorities,
  taskStatuses,
  textValue,
} from "@/lib/operations";
import {
  parseFinanceSheets,
  readTabularUpload,
  type ImportedFinanceRow,
} from "@/lib/spreadsheet-import";
import { websiteContentKey } from "@/lib/site-content-schema";

function refresh() {
  revalidatePath("/admin/operations");
  revalidatePath("/portal");
}

export async function saveDonationCampaign(formData: FormData) {
  const actor = await requirePermission("finance.manage");
  const db = getDb();
  const goalCents = moneyToCents(formData.get("goal"));
  if (goalCents < 100) throw new Error("The campaign goal must be at least $1.");
  const suggestedAmountsCents = parseSuggestedDonationAmounts(
    textValue(formData, "suggestedAmounts"),
  );
  if (!suggestedAmountsCents.length) {
    throw new Error("Add at least one suggested amount of $1 or more.");
  }
  const teamImageUploadId = String(
    formData.get("upload_teamImage") || "",
  ).trim();
  const removeTeamImage = formData.get("remove_teamImage") === "on";
  let teamImageUrl: string | undefined;
  if (teamImageUploadId) {
    if (!z.uuid().safeParse(teamImageUploadId).success)
      throw new Error("The fundraiser photo could not be verified.");
    const [asset] = await db
      .select({ blobUrl: mediaAssets.blobUrl })
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.id, teamImageUploadId),
          eq(mediaAssets.uploadedByMemberId, actor.id),
        ),
      )
      .limit(1);
    if (!asset)
      throw new Error("The fundraiser photo could not be verified.");
    teamImageUrl = asset.blobUrl;
  }
  const values = {
    title: textValue(formData, "title", true).slice(0, 120),
    description: textValue(formData, "description", true).slice(0, 600),
    goalCents,
    suggestedAmountsCents,
    isActive: formData.get("isActive") === "on",
    updatedByMemberId: actor.id,
    updatedAt: new Date(),
  };
  await db
    .insert(donationCampaignSettings)
    .values({ id: DEFAULT_DONATION_CAMPAIGN.id, ...values })
    .onConflictDoUpdate({
      target: donationCampaignSettings.id,
      set: values,
    });

  if (teamImageUploadId || removeTeamImage) {
    const [settings] = await db
      .select({ pageContent: publicSettings.pageContent })
      .from(publicSettings)
      .where(eq(publicSettings.id, "site"))
      .limit(1);
    const pageContent = { ...(settings?.pageContent ?? {}) };
    const storageKey = websiteContentKey("donate", "teamImage");
    if (removeTeamImage) {
      delete pageContent[storageKey];
    } else {
      pageContent[storageKey] = teamImageUrl!;
    }
    await db
      .insert(publicSettings)
      .values({ id: "site", pageContent })
      .onConflictDoUpdate({
        target: publicSettings.id,
        set: { pageContent, updatedAt: new Date() },
      });
  }
  await audit(
    actor.id,
    "finance.donation_campaign_updated",
    "donation_campaign",
    DEFAULT_DONATION_CAMPAIGN.id,
    { goalCents, isActive: values.isActive },
  );
  revalidatePath("/donate");
  refresh();
}

export async function saveDonationAttribution(formData: FormData) {
  const actor = await requirePermission("finance.manage");
  const donationId = textValue(formData, "donationId", true);
  const memberId = textValue(formData, "memberId") || null;
  if (memberId) {
    const [member] = await getDb()
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.id, memberId), eq(members.status, "ACTIVE")))
      .limit(1);
    if (!member) throw new Error("Choose an active team member.");
  }
  const [updated] = await getDb()
    .update(donations)
    .set({ attributedMemberId: memberId, updatedAt: new Date() })
    .where(eq(donations.id, donationId))
    .returning({ id: donations.id });
  if (!updated) throw new Error("Donation not found.");
  await audit(
    actor.id,
    "finance.donation_attribution_updated",
    "donation",
    donationId,
    { memberId },
  );
  revalidatePath("/donate");
  refresh();
}

async function audit(
  actorMemberId: string,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown> = {},
) {
  await getDb()
    .insert(auditEvents)
    .values({ actorMemberId, action, entityType, entityId, details });
  if (
    /^(task|engineering|manufacturing|inventory|purchasing|design|finance|meeting)\./.test(
      action,
    )
  ) {
    await notifyDiscordAdmin({
      title: action
        .split(".")
        .map((part) => part.replaceAll("_", " "))
        .join(" · "),
      body:
        `${entityType.replaceAll("_", " ")} ${entityId}` +
        (Object.keys(details).length
          ? `\n${JSON.stringify(details).slice(0, 900)}`
          : ""),
      path: "/admin/operations",
    }).catch((error: unknown) =>
      console.error("Discord operations notification failed", error),
    );
  }
}

export async function saveFinancePlan(formData: FormData) {
  const actor = await requirePermission("finance.manage");
  const id = textValue(formData, "id");
  const values = {
    seasonId: textValue(formData, "seasonId") || null,
    engineeringProjectId:
      textValue(formData, "engineeringProjectId") || null,
    name: textValue(formData, "name", true),
    fiscalYear: Number(textValue(formData, "fiscalYear", true)),
    project: textValue(formData, "project") || "Organization",
    status: textValue(formData, "status") || "DRAFT",
    minimumBudgetCents: moneyToCents(formData.get("minimumBudget")),
    maximumBudgetCents: moneyToCents(formData.get("maximumBudget")),
    notes: textValue(formData, "notes"),
    updatedAt: new Date(),
  };
  if (
    !Number.isInteger(values.fiscalYear) ||
    values.fiscalYear < 2000 ||
    values.fiscalYear > 2200
  )
    throw new Error("Enter a valid fiscal year.");
  if (
    values.maximumBudgetCents &&
    values.maximumBudgetCents < values.minimumBudgetCents
  )
    throw new Error("Maximum budget must be at least the minimum budget.");
  if (values.minimumBudgetCents < 0 || values.maximumBudgetCents < 0)
    throw new Error("Budget limits cannot be negative.");
  if (id) {
    const [row] = await getDb()
      .update(financePlans)
      .set(values)
      .where(eq(financePlans.id, id))
      .returning();
    if (!row) throw new Error("Budget plan not found.");
    await audit(actor.id, "finance.plan_updated", "finance_plan", id);
  } else {
    const [row] = await getDb()
      .insert(financePlans)
      .values({ ...values, createdByMemberId: actor.id })
      .returning();
    await audit(actor.id, "finance.plan_created", "finance_plan", row.id);
  }
  refresh();
}

export async function deleteFinancePlan(formData: FormData) {
  const actor = await requirePermission("finance.manage");
  const id = textValue(formData, "id", true);
  await getDb().delete(financeEntries).where(eq(financeEntries.planId, id));
  const [row] = await getDb()
    .delete(financePlans)
    .where(eq(financePlans.id, id))
    .returning();
  if (row)
    await audit(actor.id, "finance.plan_deleted", "finance_plan", id, {
      name: row.name,
    });
  refresh();
}

export async function saveFinanceEntry(formData: FormData) {
  const actor = await requirePermission("finance.manage");
  const id = textValue(formData, "id");
  const quantity = Number(textValue(formData, "quantity") || "1");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999)
    throw new Error("Quantity must be a whole number from 1 to 9,999.");
  const unitCostCents = moneyToCents(formData.get("unitCost"));
  const amountField = textValue(formData, "amount");
  const kind = textValue(formData, "kind") || "EXPENSE";
  const status = textValue(formData, "status") || "PLANNED";
  if (!(financeEntryKinds as readonly string[]).includes(kind))
    throw new Error("Choose a valid financial item type.");
  if (!(financeEntryStatuses as readonly string[]).includes(status))
    throw new Error("Choose a valid financial item status.");
  const amountCents = amountField
    ? moneyToCents(amountField)
    : quantity * unitCostCents;
  if (unitCostCents < 0 || amountCents < 0)
    throw new Error("Financial amounts cannot be negative.");
  const values = {
    planId: textValue(formData, "planId") || null,
    kind,
    category: textValue(formData, "category") || "General",
    description: textValue(formData, "description", true),
    vendor: textValue(formData, "vendor"),
    quantity,
    unitCostCents,
    amountCents,
    status,
    occurredAt: dateValue(formData.get("occurredAt")),
    receiptUrl: textValue(formData, "receiptUrl") || null,
    notes: textValue(formData, "notes"),
    updatedAt: new Date(),
  };
  if (id) {
    const [row] = await getDb()
      .update(financeEntries)
      .set(values)
      .where(eq(financeEntries.id, id))
      .returning();
    if (!row) throw new Error("Finance item not found.");
    await audit(actor.id, "finance.entry_updated", "finance_entry", id);
  } else {
    const [row] = await getDb()
      .insert(financeEntries)
      .values({ ...values, createdByMemberId: actor.id })
      .returning();
    await audit(actor.id, "finance.entry_created", "finance_entry", row.id);
  }
  refresh();
}

function financeImportDate(value: string) {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function financeImportKey(row: {
  description: string;
  amountCents: number;
  occurredAt: Date;
}) {
  return [
    row.description.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
    row.amountCents,
    row.occurredAt.toISOString().slice(0, 10),
  ].join("|");
}

export async function importFinanceSpreadsheet(formData: FormData) {
  const actor = await requirePermission("finance.manage");
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size)
    throw new Error("Choose a finance spreadsheet.");
  const planId = textValue(formData, "planId") || null;
  if (planId) {
    const [plan] = await getDb()
      .select({ id: financePlans.id })
      .from(financePlans)
      .where(eq(financePlans.id, planId))
      .limit(1);
    if (!plan) throw new Error("Choose a valid budget plan.");
  }
  const defaultKind = textValue(formData, "defaultKind") || "EXPENSE";
  const defaultStatus = textValue(formData, "defaultStatus") || "PLANNED";
  if (!(financeEntryKinds as readonly string[]).includes(defaultKind))
    throw new Error("Choose a valid default finance type.");
  if (!(financeEntryStatuses as readonly string[]).includes(defaultStatus))
    throw new Error("Choose a valid default finance status.");

  const parsed = parseFinanceSheets(await readTabularUpload(file), {
    kind: defaultKind as ImportedFinanceRow["kind"],
    status: defaultStatus as ImportedFinanceRow["status"],
  });
  const existingRows = await getDb()
    .select({
      description: financeEntries.description,
      amountCents: financeEntries.amountCents,
      occurredAt: financeEntries.occurredAt,
    })
    .from(financeEntries)
    .where(
      planId ? eq(financeEntries.planId, planId) : isNull(financeEntries.planId),
    );
  const existingKeys = new Set(existingRows.map(financeImportKey));
  const seenKeys = new Set<string>();
  const values = parsed.rows.flatMap((item) => {
    const occurredAt = financeImportDate(item.occurredAt);
    const amountCents = Math.max(0, Math.round(item.amount * 100));
    const key = financeImportKey({
      description: item.description,
      amountCents,
      occurredAt,
    });
    if (existingKeys.has(key) || seenKeys.has(key)) return [];
    seenKeys.add(key);
    return [
      {
        planId,
        kind: item.kind,
        category: item.category,
        description: item.description,
        vendor: item.vendor,
        quantity: item.quantity,
        unitCostCents: Math.max(0, Math.round(item.unitCost * 100)),
        amountCents,
        status: item.status,
        occurredAt,
        notes: `${item.notes} Source file: ${file.name}.`.trim().slice(0, 5_000),
        createdByMemberId: actor.id,
      },
    ];
  });
  for (let index = 0; index < values.length; index += 100) {
    await getDb()
      .insert(financeEntries)
      .values(values.slice(index, index + 100));
  }
  const duplicateCount = parsed.rows.length - values.length;
  await audit(
    actor.id,
    "finance.spreadsheet_imported",
    "finance_import",
    file.name,
    {
      planId,
      imported: values.length,
      duplicatesSkipped: duplicateCount,
      invalidRowsSkipped: parsed.skipped,
    },
  );
  refresh();
  return {
    message: `Imported ${values.length} finance row${values.length === 1 ? "" : "s"}${duplicateCount ? ` and skipped ${duplicateCount} duplicate${duplicateCount === 1 ? "" : "s"}` : ""}.`,
  };
}

export async function deleteFinanceEntry(formData: FormData) {
  const actor = await requirePermission("finance.manage");
  const id = textValue(formData, "id", true);
  const [row] = await getDb()
    .delete(financeEntries)
    .where(eq(financeEntries.id, id))
    .returning();
  if (row)
    await audit(actor.id, "finance.entry_deleted", "finance_entry", id, {
      description: row.description,
    });
  refresh();
}

export async function saveSponsorCommitment(formData: FormData) {
  const actor = await requirePermission("finance.manage");
  const id = textValue(formData, "id");
  const receivedAt = optionalDate(formData.get("receivedAt"));
  const amountCents = moneyToCents(formData.get("amount"));
  if (amountCents < 0) throw new Error("Sponsor funding cannot be negative.");
  const values = {
    planId: textValue(formData, "planId") || null,
    sponsorName: textValue(formData, "sponsorName", true),
    tier: textValue(formData, "tier") || "Partner",
    amountCents,
    status: textValue(formData, "status") || "PLEDGED",
    contactName: textValue(formData, "contactName"),
    contactEmail: textValue(formData, "contactEmail"),
    receivedAt,
    restrictions: textValue(formData, "restrictions"),
    updatedAt: new Date(),
  };
  if (id) {
    const [row] = await getDb()
      .update(financeSponsorCommitments)
      .set(values)
      .where(eq(financeSponsorCommitments.id, id))
      .returning();
    if (!row) throw new Error("Sponsor record not found.");
    await audit(actor.id, "finance.sponsor_updated", "finance_sponsor", id);
  } else {
    const [row] = await getDb()
      .insert(financeSponsorCommitments)
      .values({ ...values, createdByMemberId: actor.id })
      .returning();
    await audit(actor.id, "finance.sponsor_created", "finance_sponsor", row.id);
  }
  refresh();
}

export async function deleteSponsorCommitment(formData: FormData) {
  const actor = await requirePermission("finance.manage");
  const id = textValue(formData, "id", true);
  const [row] = await getDb()
    .delete(financeSponsorCommitments)
    .where(eq(financeSponsorCommitments.id, id))
    .returning();
  if (row)
    await audit(actor.id, "finance.sponsor_deleted", "finance_sponsor", id, {
      sponsor: row.sponsorName,
    });
  refresh();
}

export async function saveMeeting(formData: FormData) {
  const actor = await requirePermission("meetings.manage");
  const id = textValue(formData, "id");
  const values = {
    activityId: textValue(formData, "activityId") || null,
    title: textValue(formData, "title", true),
    heldAt: dateValue(formData.get("heldAt")),
    location: textValue(formData, "location"),
    facilitator: textValue(formData, "facilitator"),
    agenda: textValue(formData, "agenda"),
    discussion: textValue(formData, "discussion"),
    summary: textValue(formData, "summary"),
    nextMeeting: textValue(formData, "nextMeeting"),
    status: textValue(formData, "status") || "DRAFT",
    updatedAt: new Date(),
  };
  if (id) {
    const [row] = await getDb()
      .update(meetingNotes)
      .set(values)
      .where(eq(meetingNotes.id, id))
      .returning();
    if (!row) throw new Error("Meeting not found.");
    await audit(actor.id, "meeting.updated", "meeting_note", id);
  } else {
    const [row] = await getDb()
      .insert(meetingNotes)
      .values({ ...values, createdByMemberId: actor.id })
      .returning();
    await audit(actor.id, "meeting.created", "meeting_note", row.id);
  }
  refresh();
}

export async function deleteMeeting(formData: FormData) {
  const actor = await requirePermission("meetings.manage");
  const id = textValue(formData, "id", true);
  const [row] = await getDb()
    .delete(meetingNotes)
    .where(eq(meetingNotes.id, id))
    .returning();
  if (row)
    await audit(actor.id, "meeting.deleted", "meeting_note", id, {
      title: row.title,
    });
  refresh();
}

export async function saveMeetingDecision(formData: FormData) {
  const actor = await requirePermission("meetings.manage");
  const id = textValue(formData, "id");
  const values = {
    meetingId: textValue(formData, "meetingId", true),
    decision: textValue(formData, "decision", true),
    rationale: textValue(formData, "rationale"),
    impact: textValue(formData, "impact"),
  };
  if (id) {
    const [row] = await getDb()
      .update(meetingDecisions)
      .set(values)
      .where(eq(meetingDecisions.id, id))
      .returning();
    if (!row) throw new Error("Decision not found.");
    await audit(actor.id, "meeting.decision_updated", "meeting_decision", id);
  } else {
    const [row] = await getDb()
      .insert(meetingDecisions)
      .values({ ...values, createdByMemberId: actor.id })
      .returning();
    await audit(
      actor.id,
      "meeting.decision_created",
      "meeting_decision",
      row.id,
    );
  }
  refresh();
}

export async function deleteMeetingDecision(formData: FormData) {
  const actor = await requirePermission("meetings.manage");
  const id = textValue(formData, "id", true);
  const [row] = await getDb()
    .delete(meetingDecisions)
    .where(eq(meetingDecisions.id, id))
    .returning();
  if (row)
    await audit(actor.id, "meeting.decision_deleted", "meeting_decision", id);
  refresh();
}

export async function saveTask(formData: FormData) {
  const actor = await requirePermission("tasks.manage");
  const id = textValue(formData, "id");
  const status = textValue(formData, "status") || "TODO";
  const priority = textValue(formData, "priority") || "NORMAL";
  if (!(taskStatuses as readonly string[]).includes(status))
    throw new Error("Choose a valid task status.");
  if (!(taskPriorities as readonly string[]).includes(priority))
    throw new Error("Choose a valid task priority.");
  const now = new Date();
  const [existing] = id
    ? await getDb()
        .select()
        .from(memberTasks)
        .where(and(eq(memberTasks.id, id), isNull(memberTasks.archivedAt)))
        .limit(1)
    : [];
  const values = {
    meetingId: textValue(formData, "meetingId") || null,
    assignedToMemberId: textValue(formData, "assignedToMemberId", true),
    title: textValue(formData, "title", true),
    description: textValue(formData, "description"),
    project: textValue(formData, "project") || "Organization",
    priority,
    status,
    dueAt: optionalDate(formData.get("dueAt")),
    completedAt: status === "DONE" ? (existing?.completedAt ?? now) : null,
    completionRequestedAt:
      status === "IN_REVIEW" ? (existing?.completionRequestedAt ?? now) : null,
    completionRequestedByMemberId:
      status === "IN_REVIEW"
        ? (existing?.completionRequestedByMemberId ?? actor.id)
        : null,
    approvedAt: status === "DONE" ? (existing?.approvedAt ?? now) : null,
    approvedByMemberId: status === "DONE" ? actor.id : null,
    approvalNote:
      status === "IN_REVIEW" || status === "DONE"
        ? (existing?.approvalNote ?? "")
        : "",
    updatedAt: now,
  };
  if (id) {
    const [row] = await getDb()
      .update(memberTasks)
      .set(values)
      .where(and(eq(memberTasks.id, id), isNull(memberTasks.archivedAt)))
      .returning();
    if (!row) throw new Error("Task not found.");
    await audit(actor.id, "task.updated", "member_task", id, {
      status,
      assignee: values.assignedToMemberId,
    });
  } else {
    const [row] = await getDb()
      .insert(memberTasks)
      .values({ ...values, createdByMemberId: actor.id })
      .returning();
    await audit(actor.id, "task.created", "member_task", row.id, {
      assignee: values.assignedToMemberId,
    });
  }
  refresh();
}

export async function reviewTaskCompletion(formData: FormData) {
  const actor = await requirePermission("tasks.manage");
  const id = textValue(formData, "id", true);
  const decision = textValue(formData, "decision", true);
  const note = textValue(formData, "note");
  if (decision !== "APPROVE" && decision !== "REQUEST_CHANGES")
    throw new Error("Choose a valid review decision.");
  if (decision === "REQUEST_CHANGES" && !note)
    throw new Error("Add a short note describing the requested changes.");
  const [task] = await getDb()
    .select()
    .from(memberTasks)
    .where(and(eq(memberTasks.id, id), isNull(memberTasks.archivedAt)))
    .limit(1);
  if (!task) throw new Error("Task not found.");
  if (task.status !== "IN_REVIEW")
    throw new Error("This task is not awaiting completion review.");
  const approved = decision === "APPROVE";
  const now = new Date();
  await getDb()
    .update(memberTasks)
    .set({
      status: approved ? "DONE" : "IN_PROGRESS",
      completedAt: approved ? now : null,
      approvedAt: approved ? now : null,
      approvedByMemberId: approved ? actor.id : null,
      approvalNote: note,
      completionRequestedAt: approved ? task.completionRequestedAt : null,
      completionRequestedByMemberId: approved
        ? task.completionRequestedByMemberId
        : null,
      updatedAt: now,
    })
    .where(eq(memberTasks.id, id));
  await audit(
    actor.id,
    approved ? "task.completion_approved" : "task.changes_requested",
    "member_task",
    id,
    { note, assignee: task.assignedToMemberId },
  );
  refresh();
}

export async function archiveTask(formData: FormData) {
  const actor = await requirePermission("tasks.manage");
  const id = textValue(formData, "id", true);
  const [row] = await getDb()
    .update(memberTasks)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(memberTasks.id, id))
    .returning();
  if (row)
    await audit(actor.id, "task.archived", "member_task", id, {
      title: row.title,
    });
  refresh();
}

export async function saveGlossaryTerm(formData: FormData) {
  const actor = await requirePermission("glossary.manage");
  const id = textValue(formData, "id");
  const values = {
    term: textValue(formData, "term", true),
    acronym: textValue(formData, "acronym"),
    category: textValue(formData, "category") || "General",
    definition: textValue(formData, "definition", true),
    usage: textValue(formData, "usage"),
    ownerRole: textValue(formData, "ownerRole"),
    relatedTerms: textValue(formData, "relatedTerms")
      .split(",")
      .map((term) => term.trim())
      .filter(Boolean),
    published: formData.get("published") === "on",
    updatedAt: new Date(),
  };
  if (id) {
    const [row] = await getDb()
      .update(glossaryTerms)
      .set(values)
      .where(eq(glossaryTerms.id, id))
      .returning();
    if (!row) throw new Error("Glossary term not found.");
    await audit(actor.id, "glossary.updated", "glossary_term", id);
  } else {
    const [row] = await getDb()
      .insert(glossaryTerms)
      .values({ ...values, createdByMemberId: actor.id })
      .returning();
    await audit(actor.id, "glossary.created", "glossary_term", row.id);
  }
  refresh();
}

export async function deleteGlossaryTerm(formData: FormData) {
  const actor = await requirePermission("glossary.manage");
  const id = textValue(formData, "id", true);
  const [row] = await getDb()
    .delete(glossaryTerms)
    .where(eq(glossaryTerms.id, id))
    .returning();
  if (row)
    await audit(actor.id, "glossary.deleted", "glossary_term", id, {
      term: row.term,
    });
  refresh();
}

export async function saveEngineeringPart(formData: FormData) {
  const actor = await requirePermission("engineering.manage");
  const id = textValue(formData, "id");
  const quantity = Number(textValue(formData, "quantity") || "1");
  const leadTimeDays = Number(textValue(formData, "leadTimeDays") || "0");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999)
    throw new Error("Part quantity must be a whole number from 1 to 9,999.");
  if (!Number.isInteger(leadTimeDays) || leadTimeDays < 0)
    throw new Error("Lead time must be a non-negative whole number.");
  const unitCostCents = moneyToCents(formData.get("unitCost"));
  if (unitCostCents < 0) throw new Error("Part cost cannot be negative.");
  const values = {
    seasonId: textValue(formData, "seasonId") || null,
    engineeringProjectId:
      textValue(formData, "engineeringProjectId") || null,
    subsystemId: textValue(formData, "subsystemId") || null,
    project: textValue(formData, "project", true),
    partNumber: textValue(formData, "partNumber", true),
    name: textValue(formData, "name", true),
    description: textValue(formData, "description"),
    subsystem: textValue(formData, "subsystem") || "General",
    revision: textValue(formData, "revision") || "A",
    quantity,
    makeBuy: textValue(formData, "makeBuy") || "MAKE",
    material: textValue(formData, "material"),
    stockSize: textValue(formData, "stockSize"),
    manufacturingMethod: textValue(formData, "manufacturingMethod"),
    supplier: textValue(formData, "supplier"),
    unitCostCents,
    leadTimeDays,
    cadStatus: textValue(formData, "cadStatus") || "NOT_STARTED",
    camStatus: textValue(formData, "camStatus") || "NOT_STARTED",
    caeStatus: textValue(formData, "caeStatus") || "NOT_REQUIRED",
    drawingStatus: textValue(formData, "drawingStatus") || "NOT_STARTED",
    verificationStatus: textValue(formData, "verificationStatus") || "PENDING",
    lifecycleStatus: textValue(formData, "lifecycleStatus") || "DESIGN",
    cadUrl: textValue(formData, "cadUrl") || null,
    drawingUrl: textValue(formData, "drawingUrl") || null,
    sourceUrl: textValue(formData, "sourceUrl") || null,
    assignedToMemberId: textValue(formData, "assignedToMemberId") || null,
    dueAt: optionalDate(formData.get("dueAt")),
    notes: textValue(formData, "notes"),
    updatedAt: new Date(),
  };
  const [duplicate] = await getDb()
    .select({ id: engineeringParts.id })
    .from(engineeringParts)
    .where(
      and(
        eq(engineeringParts.project, values.project),
        eq(engineeringParts.partNumber, values.partNumber),
        id ? ne(engineeringParts.id, id) : undefined,
      ),
    )
    .limit(1);
  if (duplicate) {
    throw new Error(
      `Part ${values.partNumber} already exists in ${values.project}. Open that record to update its quantity or revision.`,
    );
  }
  if (id) {
    const [row] = await getDb()
      .update(engineeringParts)
      .set(values)
      .where(eq(engineeringParts.id, id))
      .returning();
    if (!row) throw new Error("Part not found.");
    await audit(actor.id, "engineering.part_updated", "engineering_part", id);
  } else {
    const [row] = await getDb()
      .insert(engineeringParts)
      .values({ ...values, createdByMemberId: actor.id })
      .returning();
    await audit(
      actor.id,
      "engineering.part_created",
      "engineering_part",
      row.id,
    );
  }
  refresh();
}

export async function importOnshapeBom(formData: FormData) {
  const actor = await requirePermission("engineering.manage");
  const rawRows = textValue(formData, "rows", true);
  const project = textValue(formData, "project", true);
  const sourceUrl = textValue(formData, "sourceUrl") || null;
  const seasonId = textValue(formData, "seasonId") || null;
  const engineeringProjectId = textValue(formData, "engineeringProjectId") || null;
  const subsystemId = textValue(formData, "subsystemId") || null;
  const subsystem = textValue(formData, "subsystem") || "General";
  const parsed = JSON.parse(rawRows) as unknown;
  if (!Array.isArray(parsed) || !parsed.length || parsed.length > 500)
    throw new Error("Import between 1 and 500 BOM rows at a time.");
  const unique = new Map<string, {
    partNumber: string;
    name: string;
    description: string;
    quantity: number;
    revision: string;
    material: string;
    supplier: string;
    makeBuy: "MAKE" | "BUY";
    unitCost: number;
  }>();
  for (const candidate of parsed) {
    if (!candidate || typeof candidate !== "object") continue;
    const row = candidate as Record<string, unknown>;
    const partNumber = String(row.partNumber || "").trim().slice(0, 200);
    const name = String(row.name || "").trim().slice(0, 500);
    const quantity = Number(row.quantity);
    const unitCost = Number(row.unitCost);
    if (!partNumber || !name || !Number.isInteger(quantity) || quantity < 1 || quantity > 9999)
      continue;
    unique.set(partNumber.toLowerCase(), {
      partNumber,
      name,
      description: String(row.description || "").trim().slice(0, 5000),
      quantity,
      revision: String(row.revision || "A").trim().slice(0, 100) || "A",
      material: String(row.material || "").trim().slice(0, 300),
      supplier: String(row.supplier || "").trim().slice(0, 300),
      makeBuy: row.makeBuy === "BUY" ? "BUY" : "MAKE",
      unitCost: Number.isFinite(unitCost) ? Math.max(0, Math.min(10_000_000, unitCost)) : 0,
    });
  }
  const rows = [...unique.values()];
  if (!rows.length) throw new Error("No valid BOM rows were found.");
  const existingRows = await getDb()
    .select()
    .from(engineeringParts)
    .where(eq(engineeringParts.project, project));
  const existingByPartNumber = new Map(
    existingRows.map((row) => [row.partNumber.toLowerCase(), row]),
  );
  const pendingChanges = rows.flatMap((row) => {
    const existing = existingByPartNumber.get(row.partNumber.toLowerCase());
    if (!existing) return [];
    const nextUnitCostCents = Math.round(row.unitCost * 100);
    const deltas: string[] = [];
    const compare = (label: string, before: string | number, after: string | number) => {
      if (before !== after) deltas.push(`${label}: ${before || "—"} → ${after || "—"}`);
    };
    compare("Name", existing.name, row.name);
    compare("Description", existing.description, row.description);
    compare("Revision", existing.revision, row.revision);
    compare("Quantity", existing.quantity, row.quantity);
    compare("Make / buy", existing.makeBuy, row.makeBuy);
    compare("Material", existing.material, row.material);
    compare("Supplier", existing.supplier, row.supplier);
    compare("Unit cost", existing.unitCostCents, nextUnitCostCents);
    if (!deltas.length) return [];
    return [{
      existing,
      row,
      deltas,
      nextUnitCostCents,
    }];
  });
  const now = new Date();
  for (let index = 0; index < rows.length; index += 100) {
    const chunk = rows.slice(index, index + 100).map((row) => ({
      seasonId,
      engineeringProjectId,
      subsystemId,
      project,
      subsystem,
      partNumber: row.partNumber,
      name: row.name,
      description: row.description,
      revision: row.revision,
      quantity: row.quantity,
      makeBuy: row.makeBuy,
      material: row.material,
      supplier: row.supplier,
      unitCostCents: Math.round(row.unitCost * 100),
      sourceUrl,
      createdByMemberId: actor.id,
      updatedAt: now,
    }));
    await getDb()
      .insert(engineeringParts)
      .values(chunk)
      .onConflictDoNothing({
        target: [engineeringParts.project, engineeringParts.partNumber],
      });
    for (const row of chunk) {
      await getDb()
        .update(engineeringParts)
        .set({
          name: row.name,
          description: row.description,
          revision: row.revision,
          quantity: row.quantity,
          makeBuy: row.makeBuy,
          material: row.material,
          supplier: row.supplier,
          unitCostCents: row.unitCostCents,
          seasonId,
          engineeringProjectId,
          subsystemId,
          subsystem,
          sourceUrl,
          updatedAt: now,
        })
        .where(and(eq(engineeringParts.project, project), eq(engineeringParts.partNumber, row.partNumber)));
    }
  }
  if (pendingChanges.length) {
    const importId = randomBytes(4).toString("hex").toUpperCase();
    await getDb().insert(designChanges).values(
      pendingChanges.map(({ existing, row, deltas, nextUnitCostCents }, index) => ({
        seasonId,
        projectId: engineeringProjectId,
        subsystemId,
        partId: existing.id,
        changeNumber: `OS-${now.getTime().toString(36).toUpperCase()}-${importId}-${index + 1}`,
        title: `${row.partNumber} · Onshape BOM update`,
        reason: "Change detected during an Onshape BOM import.",
        description: deltas.join("\n"),
        impact: "Review affected assemblies, manufacturing instructions, inventory, purchasing, and notebook documentation before implementation.",
        costImpactCents:
          row.quantity * nextUnitCostCents - existing.quantity * existing.unitCostCents,
        risk: existing.revision !== row.revision ? "MEDIUM" : "LOW",
        status: "IN_REVIEW",
        revisionFrom: existing.revision,
        revisionTo: row.revision,
        verificationPlan: "Confirm the Onshape document revision, drawing, affected assemblies, manufacturing route, and physical part before approval.",
        requestedByMemberId: actor.id,
      })),
    );
  }
  await audit(actor.id, "engineering.onshape_bom_imported", "engineering_bom", project, {
    rowCount: rows.length,
    changeCount: pendingChanges.length,
    sourceUrl,
  });
  refresh();
  return {
    status: "success" as const,
    message: `${rows.length} BOM part${rows.length === 1 ? "" : "s"} imported or updated.${pendingChanges.length ? ` ${pendingChanges.length} detected change${pendingChanges.length === 1 ? "" : "s"} sent to design-change review.` : " No controlled fields changed."}`,
  };
}

export async function deleteEngineeringPart(formData: FormData) {
  const actor = await requirePermission("engineering.manage");
  const id = textValue(formData, "id", true);
  const [row] = await getDb()
    .delete(engineeringParts)
    .where(eq(engineeringParts.id, id))
    .returning();
  if (row)
    await audit(actor.id, "engineering.part_deleted", "engineering_part", id, {
      partNumber: row.partNumber,
    });
  refresh();
}

export async function saveManufacturingStep(formData: FormData) {
  const actor = await requirePermission("engineering.manage");
  const id = textValue(formData, "id");
  const status = textValue(formData, "status") || "NOT_STARTED";
  const sequence = Number(textValue(formData, "sequence") || "10");
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 100_000) {
    throw new Error("Operation sequence must be a whole number from 1 to 100,000.");
  }
  const values = {
    partId: textValue(formData, "partId", true),
    sequence,
    process: textValue(formData, "process", true),
    machine: textValue(formData, "machine"),
    setup: textValue(formData, "setup"),
    instructions: textValue(formData, "instructions"),
    inspectionCriteria: textValue(formData, "inspectionCriteria"),
    status,
    assignedToMemberId: textValue(formData, "assignedToMemberId") || null,
    completedAt: status === "COMPLETE" ? new Date() : null,
    updatedAt: new Date(),
  };
  const [duplicate] = await getDb()
    .select({ id: manufacturingSteps.id })
    .from(manufacturingSteps)
    .where(
      and(
        eq(manufacturingSteps.partId, values.partId),
        eq(manufacturingSteps.sequence, sequence),
        id ? ne(manufacturingSteps.id, id) : undefined,
      ),
    )
    .limit(1);
  if (duplicate) {
    throw new Error(
      `This part already has operation ${sequence}. Choose the next sequence number or edit the existing operation.`,
    );
  }
  if (id) {
    const [row] = await getDb()
      .update(manufacturingSteps)
      .set(values)
      .where(eq(manufacturingSteps.id, id))
      .returning();
    if (!row) throw new Error("Manufacturing step not found.");
    await audit(actor.id, "engineering.step_updated", "manufacturing_step", id);
  } else {
    const [row] = await getDb()
      .insert(manufacturingSteps)
      .values(values)
      .returning();
    await audit(
      actor.id,
      "engineering.step_created",
      "manufacturing_step",
      row.id,
    );
  }
  refresh();
}

export async function deleteManufacturingStep(formData: FormData) {
  const actor = await requirePermission("engineering.manage");
  const id = textValue(formData, "id", true);
  const [row] = await getDb()
    .delete(manufacturingSteps)
    .where(eq(manufacturingSteps.id, id))
    .returning();
  if (row)
    await audit(actor.id, "engineering.step_deleted", "manufacturing_step", id);
  refresh();
}

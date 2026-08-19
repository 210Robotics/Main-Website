"use server";

import { createHash, randomBytes } from "node:crypto";
import { put } from "@vercel/blob";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import {
  auditEvents,
  availabilityPolls,
  activityAttendance,
  designChanges,
  donationCampaignSettings,
  discordChannels,
  discordGuildMembers,
  discordGuilds,
  engineeringNotebookComments,
  engineeringNotebookEntries,
  engineeringParts,
  financeEntries,
  financePlans,
  financeSponsorCommitments,
  hourEntries,
  internalDocuments,
  inventoryItems,
  meetingNotes,
  members,
  memberTasks,
  operationsHubRecords,
  posts,
  postRevisions,
  publicForms,
  purchaseRequests,
  teamActivities,
  taskComments,
} from "@/db/schema";
import { requireActiveMember, requirePermission } from "@/lib/auth";
import {
  assistantCommandSchema,
  inferAssistantCommand,
  isUuidReference,
  type AssistantCommand,
} from "@/lib/assistant-commands";
import {
  planAssistantCommands,
  planAssistantDocument,
} from "@/lib/assistant-planner";
import {
  DEFAULT_DONATION_CAMPAIGN,
  getDonationCampaign,
  getDonationSummary,
} from "@/lib/donations";
import { discoverPublicCompanyContacts } from "@/lib/public-company-discovery";
import {
  finalizeInternalDocumentUpload,
  type InternalDocumentActionState,
} from "@/app/admin/internal-document-actions";
import { importOnshapeBom } from "@/app/admin/operations/actions";
import { readPrivateBlob } from "@/lib/internal-documents";
import {
  downloadSharedDriveDocument,
  MAX_INTERNAL_DOCUMENT_BYTES,
  safeDocumentName,
} from "@/lib/internal-documents";
import { parseOnshapeBom } from "@/lib/onshape-bom";
import { getCalendarEvents } from "@/lib/calendar";
import {
  notifyDiscordAdmin,
  sendDiscordCalendarReminders,
  sendDiscordChannelMessage,
  sendDiscordDirectMessage,
  sendDiscordMonthlyCalendarDigest,
  setDiscordGuildMemberTimeout,
  syncDiscordGuild,
  syncDiscordMessages,
} from "@/lib/discord";
import { privateBlobToken } from "@/lib/private-blob";
import {
  applyAutomaticDueDates,
  applyNaturalLanguageContext,
} from "@/lib/assistant-context";
import { scoreDecisionMatrix } from "@/lib/control-center";
import {
  documentRouteSignals,
  extractBudgetPlanHint,
  extractDecisionMatrices,
  extractPricedMaterialCommands,
  type ExtractedDecisionMatrix,
} from "@/lib/document-intake";
import {
  parseFinanceSheets,
  readTabularBuffer,
  type ImportedFinanceRow,
  type TabularSheet,
} from "@/lib/spreadsheet-import";

export type AssistantExecutionResult = {
  status: "success" | "error";
  message: string;
  href?: string;
};

export type AssistantDocumentResult = InternalDocumentActionState & {
  importedCount?: number;
  skippedCount?: number;
  details?: string[];
};

type AssistantDocumentUpload = {
  pathname: string;
  filename: string;
  contentType: string;
  size: number;
  instructions?: string;
  sourceUrl?: string;
};

function cleanSearch(value: string) {
  return `%${value.trim().replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}

function optionalDate(value?: string, fallback?: Date) {
  if (!value) return fallback ?? null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new Error(`The date “${value}” was not valid.`);
  return parsed;
}

function deadlineLabel(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function simpleSlug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "activity"
  );
}

function simpleHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p>${paragraph
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

function privateKey() {
  return randomBytes(24).toString("base64url");
}

function plainDocumentText(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(?:td|th)>/gi, "\t")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|h[1-6]|li|tr|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/ +/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function delimitedValue(value: string) {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function spreadsheetSource(sheets: TabularSheet[]) {
  const lines: string[] = [];
  for (const sheet of sheets) {
    if (lines.length >= 1200) break;
    lines.push(`\n=== SHEET: ${sheet.name} ===`);
    for (const row of sheet.rows) {
      if (lines.length >= 1200) break;
      lines.push(row.map(delimitedValue).join(","));
    }
  }
  return lines.join("\n");
}

async function audit(actorId: string, action: string, entityType: string, entityId: string, details: Record<string, unknown>) {
  await getDb().insert(auditEvents).values({ actorMemberId: actorId, action, entityType, entityId, details });
  if (action.includes("task")) {
    await notifyDiscordAdmin({
      title: action.replaceAll(".", " · ").replaceAll("_", " "),
      body: `${entityType.replaceAll("_", " ")} ${entityId}`,
      path: "/admin/operations?tool=tasks",
    }).catch((error: unknown) =>
      console.error("Discord assistant-task notification failed", error),
    );
  }
}

async function createDecisionMatrixRecord(input: {
  actorId: string;
  matrix: ExtractedDecisionMatrix;
  sourceType: string;
  sourceId?: string;
  sourceUrl?: string;
}) {
  const criteria = input.matrix.criteria
    .map((item) => `${item.name} | ${item.weight} | ${item.goal}`)
    .join("\n");
  const options = input.matrix.concepts
    .map((item) => `${item.name} | ${item.values.join(",")}`)
    .join("\n");
  const scores = scoreDecisionMatrix(criteria, options);
  const matrixFingerprint = `decision-matrix:${createHash("sha256")
    .update(JSON.stringify({ criteria, options }))
    .digest("hex")}`;
  const [existing] = await getDb()
    .select({ id: operationsHubRecords.id })
    .from(operationsHubRecords)
    .where(
      and(
        eq(operationsHubRecords.kind, "DECISION_MATRIX"),
        eq(operationsHubRecords.fingerprint, matrixFingerprint),
      ),
    )
    .limit(1);
  if (existing) {
    return {
      id: existing.id,
      created: false,
      winner: scores[0]?.name ?? "",
    };
  }
  const [row] = await getDb()
    .insert(operationsHubRecords)
    .values({
      kind: "DECISION_MATRIX",
      title: input.matrix.title,
      description: input.matrix.recommendation,
      status: "ACTIVE",
      ownerMemberId: input.actorId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceUrl: input.sourceUrl,
      fingerprint: matrixFingerprint,
      data: {
        criteria,
        options,
        recommendation: input.matrix.recommendation,
        computedScores: scores
          .map((item) => `${item.name}: ${item.score}/10`)
          .join("\n"),
        winner: scores[0]?.name ?? "",
      },
      createdByMemberId: input.actorId,
    })
    .returning({ id: operationsHubRecords.id });
  await audit(
    input.actorId,
    "assistant.decision_matrix_created",
    "decision_matrix",
    row.id,
    {
      title: input.matrix.title,
      sourceType: input.sourceType,
      winner: scores[0]?.name ?? "",
    },
  );
  return { id: row.id, created: true, winner: scores[0]?.name ?? "" };
}

async function createDecisionMatrixConcern(input: {
  actorId: string;
  matrix: ExtractedDecisionMatrix;
  sourceType: string;
  sourceId?: string;
  sourceUrl?: string;
}) {
  const concern = input.matrix.recommendation
    .split(/\r?\n/)
    .find((line) => /^Key concerns? raised:/i.test(line))
    ?.replace(/^Key concerns? raised:\s*/i, "")
    .trim();
  if (!concern) return false;
  const datedConcern = applyAutomaticDueDates([
    {
      kind: "ENGINEERING_RECORD_CREATE",
      recordType: "ENGINEERING_QUESTION",
      title: `Resolve: ${concern}`.slice(0, 180),
      description: `Open question imported with “${input.matrix.title}”.`,
      priority: "NORMAL",
    },
  ])[0];
  const concernFingerprint = `engineering-question:${createHash("sha256")
    .update(concern.toLowerCase())
    .digest("hex")}`;
  const [existing] = await getDb()
    .select({ id: operationsHubRecords.id })
    .from(operationsHubRecords)
    .where(
      and(
        eq(operationsHubRecords.kind, "ENGINEERING_QUESTION"),
        eq(operationsHubRecords.fingerprint, concernFingerprint),
      ),
    )
    .limit(1);
  if (existing) return false;
  const [row] = await getDb()
    .insert(operationsHubRecords)
    .values({
      kind: "ENGINEERING_QUESTION",
      title:
        datedConcern.kind === "ENGINEERING_RECORD_CREATE"
          ? datedConcern.title
          : `Resolve: ${concern}`.slice(0, 180),
      description:
        datedConcern.kind === "ENGINEERING_RECORD_CREATE"
          ? datedConcern.description
          : `Open question imported with “${input.matrix.title}”.`,
      status: "ACTIVE",
      priority: "NORMAL",
      ownerMemberId: input.actorId,
      dueAt:
        datedConcern.kind === "ENGINEERING_RECORD_CREATE"
          ? optionalDate(datedConcern.dueAt)
          : null,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceUrl: input.sourceUrl,
      fingerprint: concernFingerprint,
      createdByMemberId: input.actorId,
    })
    .returning({ id: operationsHubRecords.id });
  await audit(
    input.actorId,
    "assistant.engineering_question_created",
    "operations_hub_record",
    row.id,
    { source: input.matrix.title },
  );
  return true;
}

async function resolveMember(query: string, actorId: string) {
  if (/^(me|myself)$/i.test(query.trim()))
    return (await getDb().select().from(members).where(eq(members.id, actorId)).limit(1))[0];
  const matches = await getDb()
    .select()
    .from(members)
    .where(and(eq(members.status, "ACTIVE"), or(ilike(members.displayName, cleanSearch(query)), ilike(members.email, cleanSearch(query)))))
    .limit(3);
  if (!matches.length) throw new Error(`No active member matched “${query}”.`);
  if (matches.length > 1) throw new Error(`More than one member matched “${query}”. Use their full name or email.`);
  return matches[0];
}

async function resolveDiscordGuild() {
  const [guild] = await getDb()
    .select()
    .from(discordGuilds)
    .orderBy(desc(discordGuilds.updatedAt))
    .limit(1);
  if (!guild)
    throw new Error("Connect the 210 Robotics Discord server first.");
  return guild;
}

async function resolveDiscordChannel(guildId: string, query: string) {
  const cleaned = query.trim().replace(/^#/, "");
  const matches = await getDb()
    .select()
    .from(discordChannels)
    .where(
      and(
        eq(discordChannels.guildId, guildId),
        eq(discordChannels.archived, false),
        or(
          eq(discordChannels.id, cleaned),
          ilike(discordChannels.name, cleanSearch(cleaned)),
        ),
      ),
    )
    .orderBy(discordChannels.position)
    .limit(5);
  const usable = matches.filter((channel) =>
    [0, 5, 10, 11, 12].includes(channel.type),
  );
  const exact =
    usable.find(
      (channel) => channel.name.toLowerCase() === cleaned.toLowerCase(),
    ) || usable.find((channel) => channel.id === cleaned);
  if (exact) return exact;
  if (!usable.length)
    throw new Error(`No Discord text channel matched "${query}".`);
  if (usable.length > 1)
    throw new Error(
      `More than one Discord channel matched "${query}". Use the complete channel name.`,
    );
  return usable[0];
}

async function resolveLinkedDiscordMember(
  guildId: string,
  query: string,
  actorId: string,
) {
  const member = await resolveMember(query, actorId);
  const [discordMember] = await getDb()
    .select()
    .from(discordGuildMembers)
    .where(
      and(
        eq(discordGuildMembers.guildId, guildId),
        eq(discordGuildMembers.linkedMemberId, member.id),
        isNull(discordGuildMembers.leftAt),
      ),
    )
    .limit(1);
  if (!discordMember)
    throw new Error(
      `${member.displayName} has not linked their Discord account yet.`,
    );
  return { member, discordMember };
}

async function resolveTask(query: string) {
  const match = isUuidReference(query)
    ? or(
        eq(memberTasks.id, query),
        ilike(memberTasks.title, cleanSearch(query)),
      )
    : ilike(memberTasks.title, cleanSearch(query));
  const matches = await getDb()
    .select()
    .from(memberTasks)
    .where(and(isNull(memberTasks.archivedAt), match))
    .orderBy(desc(memberTasks.updatedAt))
    .limit(3);
  if (!matches.length) throw new Error(`No active task matched “${query}”.`);
  if (matches.length > 1) throw new Error(`More than one task matched “${query}”. Use the complete task title.`);
  return matches[0];
}

async function resolveActivity(query: string) {
  const matches = await getDb()
    .select()
    .from(teamActivities)
    .where(
      and(
        isNull(teamActivities.archivedAt),
        isUuidReference(query)
          ? or(
              eq(teamActivities.id, query),
              ilike(teamActivities.title, cleanSearch(query)),
            )
          : ilike(teamActivities.title, cleanSearch(query)),
      ),
    )
    .orderBy(desc(teamActivities.startsAt))
    .limit(3);
  if (!matches.length)
    throw new Error(`No event or activity matched “${query}”.`);
  if (matches.length > 1)
    throw new Error(
      `More than one event matched “${query}”. Use the complete event title.`,
    );
  return matches[0];
}

async function resolvePart(query: string) {
  const match = isUuidReference(query)
    ? or(
        eq(engineeringParts.id, query),
        ilike(engineeringParts.partNumber, cleanSearch(query)),
        ilike(engineeringParts.name, cleanSearch(query)),
      )
    : or(
        ilike(engineeringParts.partNumber, cleanSearch(query)),
        ilike(engineeringParts.name, cleanSearch(query)),
      );
  const matches = await getDb()
    .select()
    .from(engineeringParts)
    .where(match)
    .orderBy(desc(engineeringParts.updatedAt))
    .limit(3);
  if (!matches.length) throw new Error(`No BOM part matched “${query}”.`);
  if (matches.length > 1) throw new Error(`More than one BOM part matched “${query}”. Use the exact part number.`);
  return matches[0];
}

async function resolveNotebookEntry(query?: string) {
  const match = query
    ? isUuidReference(query)
      ? or(
          eq(engineeringNotebookEntries.id, query),
          ilike(engineeringNotebookEntries.title, cleanSearch(query)),
        )
      : ilike(engineeringNotebookEntries.title, cleanSearch(query))
    : undefined;
  const matches = await getDb()
    .select()
    .from(engineeringNotebookEntries)
    .where(match)
    .orderBy(desc(engineeringNotebookEntries.updatedAt))
    .limit(query ? 3 : 1);
  if (!matches.length)
    throw new Error(
      query
        ? `No notebook page matched “${query}”.`
        : "Create a notebook page before adding a to-do list.",
    );
  if (matches.length > 1)
    throw new Error(
      `More than one notebook page matched “${query}”. Use the complete page title.`,
    );
  return matches[0];
}

async function resolvePlan(query?: string) {
  const match = query
    ? isUuidReference(query)
      ? or(
          eq(financePlans.id, query),
          ilike(financePlans.name, cleanSearch(query)),
        )
      : ilike(financePlans.name, cleanSearch(query))
    : undefined;
  const matches = await getDb()
    .select()
    .from(financePlans)
    .where(match)
    .orderBy(desc(financePlans.updatedAt))
    .limit(query ? 3 : 1);
  if (!matches.length) throw new Error(query ? `No budget plan matched “${query}”.` : "Create a budget plan before adding entries.");
  if (matches.length > 1) throw new Error(`More than one budget plan matched “${query}”. Use the complete plan name.`);
  return matches[0];
}

async function resolveCurrentPlan(query?: string) {
  if (query) return resolvePlan(query);
  const [active] = await getDb()
    .select()
    .from(financePlans)
    .where(eq(financePlans.status, "ACTIVE"))
    .orderBy(desc(financePlans.updatedAt))
    .limit(1);
  return active ?? resolvePlan();
}

function normalizedPlanName(value: string) {
  return value
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function resolveFinanceImportPlan(input: {
  actorId: string;
  instructions?: string;
  filename: string;
  sheetName: string;
}) {
  const plans = await getDb()
    .select()
    .from(financePlans)
    .orderBy(desc(financePlans.updatedAt));
  const explicitHint = extractBudgetPlanHint(input.instructions);
  const hintSources = [
    explicitHint,
    input.sheetName,
    input.filename.replace(/\.[^.]+$/, ""),
  ].filter((value): value is string => Boolean(value?.trim()));
  const scored = plans
    .map((plan) => {
      const planName = normalizedPlanName(plan.name);
      const score = hintSources.reduce((best, source, index) => {
        const hint = normalizedPlanName(source);
        if (!hint || !planName) return best;
        if (hint === planName) return Math.max(best, 100 - index);
        if (hint.includes(planName) || planName.includes(hint))
          return Math.max(best, 70 - index + Math.min(planName.length, 20));
        return best;
      }, 0);
      return { plan, score };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);
  if (scored[0]) return { plan: scored[0].plan, created: false };

  if (explicitHint || !plans.length) {
    const name =
      explicitHint ||
      `${input.filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Imported"} Budget`;
    const [plan] = await getDb()
      .insert(financePlans)
      .values({
        name: name.slice(0, 200),
        fiscalYear: new Date().getFullYear(),
        project: "Organization",
        status: plans.length ? "DRAFT" : "ACTIVE",
        minimumBudgetCents: 0,
        maximumBudgetCents: 0,
        notes: `Created automatically while importing ${input.filename}.`,
        createdByMemberId: input.actorId,
      })
      .returning();
    await audit(
      input.actorId,
      "assistant.finance_plan_created",
      "finance_plan",
      plan.id,
      { filename: input.filename, sheetName: input.sheetName },
    );
    return { plan, created: true };
  }

  const active = plans.find((plan) => plan.status === "ACTIVE");
  return { plan: active ?? plans[0], created: false };
}

function financeImportDate(value: string) {
  if (!value.trim()) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function financeImportFingerprint(input: {
  planId: string;
  kind: string;
  description: string;
  amountCents: number;
  occurredAt: Date;
}) {
  return [
    input.planId,
    input.kind,
    input.description.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
    input.amountCents,
    input.occurredAt.toISOString().slice(0, 10),
  ].join("|");
}

async function importAssistantFinanceRows(input: {
  actorId: string;
  filename: string;
  plan: typeof financePlans.$inferSelect;
  rows: ImportedFinanceRow[];
  seen: Set<string>;
}) {
  const existingRows = await getDb()
    .select({
      kind: financeEntries.kind,
      description: financeEntries.description,
      amountCents: financeEntries.amountCents,
      occurredAt: financeEntries.occurredAt,
    })
    .from(financeEntries)
    .where(eq(financeEntries.planId, input.plan.id));
  const fingerprints = new Set([
    ...input.seen,
    ...existingRows.map((row) =>
      financeImportFingerprint({
        planId: input.plan.id,
        kind: row.kind,
        description: row.description,
        amountCents: row.amountCents,
        occurredAt: row.occurredAt,
      }),
    ),
  ]);
  const values = input.rows.flatMap((row) => {
    const occurredAt = financeImportDate(row.occurredAt);
    const amountCents = Math.max(0, Math.round(row.amount * 100));
    const fingerprint = financeImportFingerprint({
      planId: input.plan.id,
      kind: row.kind,
      description: row.description,
      amountCents,
      occurredAt,
    });
    if (fingerprints.has(fingerprint)) return [];
    fingerprints.add(fingerprint);
    input.seen.add(fingerprint);
    return [{
      planId: input.plan.id,
      kind: row.kind,
      category: row.category,
      description: row.description,
      vendor: row.vendor,
      quantity: row.quantity,
      unitCostCents: Math.max(0, Math.round(row.unitCost * 100)),
      amountCents,
      status: row.status,
      occurredAt,
      notes: `${row.notes} Source file: ${input.filename}.`
        .trim()
        .slice(0, 5_000),
      createdByMemberId: input.actorId,
    }];
  });
  for (let index = 0; index < values.length; index += 100) {
    await getDb().insert(financeEntries).values(values.slice(index, index + 100));
  }
  if (values.length) {
    await audit(
      input.actorId,
      "assistant.finance_spreadsheet_imported",
      "finance_plan",
      input.plan.id,
      {
        filename: input.filename,
        imported: values.length,
        duplicatesSkipped: input.rows.length - values.length,
      },
    );
  }
  return { imported: values.length, skipped: input.rows.length - values.length };
}

async function resolveFinanceEntry(query: string, planQuery?: string) {
  const plan = planQuery ? await resolvePlan(planQuery) : null;
  const match = isUuidReference(query)
    ? or(
        eq(financeEntries.id, query),
        ilike(financeEntries.description, cleanSearch(query)),
      )
    : ilike(financeEntries.description, cleanSearch(query));
  const matches = await getDb()
    .select()
    .from(financeEntries)
    .where(and(
      plan ? eq(financeEntries.planId, plan.id) : undefined,
      match,
    ))
    .orderBy(desc(financeEntries.updatedAt))
    .limit(3);
  if (!matches.length) throw new Error(`No budget line item matched “${query}”.`);
  if (matches.length > 1) throw new Error(`More than one budget line item matched “${query}”. Use its complete description or specify the budget plan.`);
  return matches[0];
}

function refresh() {
  revalidatePath("/admin");
  revalidatePath("/admin/operations");
  revalidatePath("/portal");
}

export async function executeAssistantCommand(input: {
  prompt: string;
  command?: unknown;
  conversation?: string;
}): Promise<AssistantExecutionResult> {
  const prompt = input.prompt.trim().slice(0, 4000);
  if (prompt.length < 2) return { status: "error", message: "Enter a request for the assistant." };
  const actor = await requireActiveMember();
  console.info(JSON.stringify({
    event: "assistant.request_received",
    actorId: actor.id,
    promptLength: prompt.length,
    hasClientCommand: input.command !== undefined,
  }));
  const driveLink =
    input.command === undefined
      ? prompt.match(
          /https:\/\/(?:drive|docs)\.google\.com\/[^\s<>()"']+/i,
        )?.[0]
      : undefined;
  if (driveLink) {
    const imported = await processAssistantDriveLink({
      url: driveLink,
      instructions: prompt.replace(driveLink, "").trim(),
    });
    return {
      status: imported.status === "success" ? "success" : "error",
      message: [
        imported.message,
        ...(imported.details ?? []).map((detail) => `• ${detail}`),
      ].join("\n"),
      href: imported.documentId
        ? "/admin?tab=documents"
        : undefined,
    };
  }
  const generated = assistantCommandSchema.safeParse(input.command);
  let commands = generated.success
    ? [generated.data]
    : await planAssistantCommands(
        prompt,
        actor.id,
        input.conversation?.trim().slice(-6000) || "",
      );
  if (!commands.length) {
    const inferred = inferAssistantCommand(prompt);
    if (inferred) commands = applyNaturalLanguageContext([inferred], prompt);
  }
  if (!commands.length)
    return {
      status: "error",
      message:
        "I could not safely determine the intended record or action. Tell me the outcome in your own words and include any names, dates, amounts, links, or files you want used.",
    };
  if (!generated.success && commands.length > 1) {
    const results: AssistantExecutionResult[] = [];
    for (const planned of commands) {
      results.push(
        await executeAssistantCommand({
          prompt,
          command: planned,
        }),
      );
    }
    const succeeded = results.filter((result) => result.status === "success");
    return {
      status: succeeded.length ? "success" : "error",
      message: [
        `Completed ${succeeded.length} of ${results.length} planned actions.`,
        ...results.map(
          (result) =>
            `${result.status === "success" ? "✓" : "⚠"} ${result.message}`,
        ),
      ].join("\n"),
      href: results.find((result) => result.href)?.href,
    };
  }
  const command: AssistantCommand = commands[0];
  console.info(JSON.stringify({
    event: "assistant.command_planned",
    actorId: actor.id,
    commandKind: command.kind,
  }));
  if (command.kind === "CHAT") return { status: "success", message: command.reply };

  try {
    if (command.kind === "DISCORD_SEND") {
      const discordActor = await requirePermission("integrations.manage");
      const guild = await resolveDiscordGuild();
      const channel = await resolveDiscordChannel(guild.id, command.channel);
      const recipients = await Promise.all(
        command.mentions.map((member) =>
          resolveLinkedDiscordMember(guild.id, member, discordActor.id),
        ),
      );
      const userIds = recipients.map(
        ({ discordMember }) => discordMember.discordUserId,
      );
      const tags = userIds
        .filter((id) => !command.message.includes(`<@${id}>`))
        .map((id) => `<@${id}>`)
        .join(" ");
      const everyonePrefix =
        command.mentionEveryone &&
        !/@(?:everyone|here)\b/i.test(command.message)
          ? "@everyone\n"
          : "";
      const content =
        `${everyonePrefix}${command.message}${tags ? `\n${tags}` : ""}`;
      if (content.length > 2_000)
        throw new Error(
          "The Discord message is too long after adding member mentions.",
        );
      const sent = await sendDiscordChannelMessage({
        guildId: guild.id,
        channelId: channel.id,
        channelName: channel.name,
        content,
        allowedUserIds: userIds,
        allowEveryone: command.mentionEveryone,
      });
      await audit(
        discordActor.id,
        "assistant.discord_message_sent",
        "discord_message",
        sent.id,
        {
          prompt,
          guildId: guild.id,
          channelId: channel.id,
          mentionedMemberIds: recipients.map(({ member }) => member.id),
          mentionedEveryone: command.mentionEveryone,
        },
      );
      refresh();
      return {
        status: "success",
        message: `Sent the message to **#${channel.name}**${command.mentionEveryone ? " and tagged **@everyone**" : ""}${recipients.length ? ` and tagged ${recipients.map(({ member }) => member.displayName).join(", ")}` : ""}.`,
        href: "/admin?tab=discord#discord-channel-messages",
      };
    }
    if (command.kind === "DISCORD_DM") {
      const discordActor = await requirePermission("integrations.manage");
      const guild = await resolveDiscordGuild();
      const recipient = await resolveLinkedDiscordMember(
        guild.id,
        command.member,
        discordActor.id,
      );
      const sent = await sendDiscordDirectMessage({
        discordUserId: recipient.discordMember.discordUserId,
        content: command.message,
      });
      await audit(
        discordActor.id,
        "assistant.discord_dm_sent",
        "discord_message",
        sent.id,
        {
          prompt,
          guildId: guild.id,
          recipientMemberId: recipient.member.id,
        },
      );
      return {
        status: "success",
        message: `Sent a private Discord message to **${recipient.member.displayName}**.`,
        href: "/admin?tab=discord#discord-member-dms",
      };
    }
    if (command.kind === "DISCORD_SYNC") {
      const discordActor = await requirePermission("integrations.manage");
      const guild = await resolveDiscordGuild();
      const memberSync = await syncDiscordGuild(guild.id);
      const messageSync = command.includeMessages
        ? await syncDiscordMessages(guild.id)
        : null;
      await audit(
        discordActor.id,
        "assistant.discord_synchronized",
        "discord_guild",
        guild.id,
        {
          prompt,
          memberCount: memberSync.memberCount,
          channelsRead: messageSync?.channelsRead ?? 0,
          messagesSaved: messageSync?.messagesSaved ?? 0,
          messagesVerified: messageSync?.messagesVerified ?? 0,
          verificationFailures: messageSync?.verificationFailures ?? 0,
        },
      );
      refresh();
      return {
        status: "success",
        message:
          `Synchronized **${memberSync.memberCount} Discord members**` +
          (messageSync
            ? `, saved **${messageSync.messagesSaved} new messages**, and marked **${messageSync.messagesVerified}** with a green check across ${messageSync.channelsRead} channels.`
            : "."),
        href: "/admin?tab=discord",
      };
    }
    if (command.kind === "DISCORD_CALENDAR_REMINDERS") {
      const discordActor = await requirePermission("integrations.manage");
      const guild = await resolveDiscordGuild();
      const result = await sendDiscordCalendarReminders(guild.id);
      await audit(
        discordActor.id,
        "assistant.discord_calendar_reminders",
        "discord_guild",
        guild.id,
        { prompt, ...result },
      );
      return {
        status: "success",
        message: result.skipped
          ? "Discord calendar announcements are paused or no reminder channel is configured."
          : `Checked ${result.eligibleEvents} upcoming calendar events and sent ${result.sent} new reminder${result.sent === 1 ? "" : "s"}.`,
        href: "/admin?tab=discord#discord-calendar",
      };
    }
    if (command.kind === "DISCORD_MONTHLY_DIGEST") {
      const discordActor = await requirePermission("integrations.manage");
      const guild = await resolveDiscordGuild();
      const result = await sendDiscordMonthlyCalendarDigest(guild.id, {
        force: true,
      });
      await audit(
        discordActor.id,
        "assistant.discord_monthly_digest",
        "discord_guild",
        guild.id,
        { prompt, ...result },
      );
      return {
        status: "success",
        message: result.skipped
          ? result.reason || "The upcoming-month digest was already sent."
          : `Published the ${result.month} Discord calendar digest with ${result.eventCount} event${result.eventCount === 1 ? "" : "s"}.`,
        href: "/admin?tab=discord#discord-calendar",
      };
    }
    if (command.kind === "DISCORD_TIMEOUT") {
      const discordActor = await requirePermission("integrations.manage");
      const guild = await resolveDiscordGuild();
      const recipient = await resolveLinkedDiscordMember(
        guild.id,
        command.member,
        discordActor.id,
      );
      const result = await setDiscordGuildMemberTimeout({
        guildId: guild.id,
        discordUserId: recipient.discordMember.discordUserId,
        durationMinutes: command.durationMinutes,
        reason:
          command.reason ||
          `Requested through the 210 Robotics assistant by member ${discordActor.id}`,
      });
      await audit(
        discordActor.id,
        command.durationMinutes === 0
          ? "assistant.discord_timeout_cleared"
          : "assistant.discord_member_timed_out",
        "discord_guild_member",
        recipient.discordMember.id,
        {
          prompt,
          guildId: guild.id,
          durationMinutes: command.durationMinutes,
          until: result.until,
          reason: command.reason,
        },
      );
      return {
        status: "success",
        message:
          command.durationMinutes === 0
            ? `Cleared the Discord timeout for **${recipient.member.displayName}**.`
            : `Timed out **${recipient.member.displayName}** on Discord for ${command.durationMinutes} minute${command.durationMinutes === 1 ? "" : "s"}.`,
        href: "/admin?tab=discord#discord-moderation",
      };
    }
    if (command.kind === "TASK_CREATE") {
      const actor = await requirePermission("tasks.manage");
      const assignee = command.assignee ? await resolveMember(command.assignee, actor.id) : actor;
      const dueAt = command.dueAt ? new Date(command.dueAt) : null;
      if (dueAt && Number.isNaN(dueAt.getTime())) throw new Error("The requested task due date was not valid.");
      const [row] = await getDb().insert(memberTasks).values({
        assignedToMemberId: assignee.id,
        createdByMemberId: actor.id,
        title: command.title,
        description: command.description,
        priority: command.priority,
        status: "TODO",
        dueAt,
      }).returning({ id: memberTasks.id });
      await audit(actor.id, "assistant.task_created", "member_task", row.id, { prompt, assigneeId: assignee.id });
      refresh();
      const dueLabel = dueAt ? deadlineLabel(command.dueAt) : null;
      return {
        status: "success",
        message: `Created **${command.title}**, assigned it to **${assignee.displayName}**${dueLabel ? `, and set the deadline to **${dueLabel}**` : ""}.`,
        href: "/admin/operations?tool=tasks",
      };
    }
    if (command.kind === "TASK_BATCH_CREATE") {
      const actor = await requirePermission("tasks.manage");
      const prepared = await Promise.all(
        command.tasks.map(async (task) => {
          const assignee = task.assignee
            ? await resolveMember(task.assignee, actor.id)
            : actor;
          const dueAt = task.dueAt ? new Date(task.dueAt) : null;
          if (dueAt && Number.isNaN(dueAt.getTime()))
            throw new Error(`The due date for “${task.title}” was not valid.`);
          return {
            assignedToMemberId: assignee.id,
            createdByMemberId: actor.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: "TODO",
            dueAt,
          };
        }),
      );
      const rows = await getDb()
        .insert(memberTasks)
        .values(prepared)
        .returning({ id: memberTasks.id, title: memberTasks.title });
      for (const row of rows) {
        await audit(actor.id, "assistant.task_created", "member_task", row.id, {
          prompt,
          batchSize: rows.length,
        });
      }
      refresh();
      return {
        status: "success",
        message: `Created and allocated ${rows.length} task${rows.length === 1 ? "" : "s"}.`,
        href: "/admin/operations?tool=tasks",
      };
    }
    if (command.kind === "TASK_COMPLETE") {
      const actor = await requirePermission("tasks.manage");
      const task = await resolveTask(command.task);
      const now = new Date();
      await getDb().update(memberTasks).set({ status: "DONE", completedAt: now, approvedAt: now, approvedByMemberId: actor.id, approvalNote: "Completed through the 210 Assistant.", updatedAt: now }).where(eq(memberTasks.id, task.id));
      await audit(actor.id, "assistant.task_completed", "member_task", task.id, { prompt, previousStatus: task.status });
      refresh();
      return { status: "success", message: `Completed and approved “${task.title}”.`, href: "/admin/operations?tool=tasks" };
    }
    if (command.kind === "TASK_ASSIGN") {
      const actor = await requirePermission("tasks.manage");
      const [task, assignee] = await Promise.all([resolveTask(command.task), resolveMember(command.assignee, actor.id)]);
      await getDb().update(memberTasks).set({ assignedToMemberId: assignee.id, updatedAt: new Date() }).where(eq(memberTasks.id, task.id));
      await audit(actor.id, "assistant.task_assigned", "member_task", task.id, { prompt, assigneeId: assignee.id });
      refresh();
      return { status: "success", message: `Assigned “${task.title}” to ${assignee.displayName}.`, href: "/admin/operations?tool=tasks" };
    }
    if (command.kind === "TASK_UPDATE") {
      const actor = await requirePermission("tasks.manage");
      const task = await resolveTask(command.task);
      const dueAt = command.dueAt === "" ? null : command.dueAt ? new Date(command.dueAt) : undefined;
      if (dueAt instanceof Date && Number.isNaN(dueAt.getTime())) throw new Error("The requested task due date was not valid.");
      const now = new Date();
      const values = {
        ...(command.status !== undefined ? { status: command.status } : {}),
        ...(command.priority !== undefined ? { priority: command.priority } : {}),
        ...(command.description !== undefined ? { description: command.description } : {}),
        ...(dueAt !== undefined ? { dueAt } : {}),
        ...(command.status === "DONE"
          ? { completedAt: now, approvedAt: now, approvedByMemberId: actor.id, approvalNote: "Completed through the 210 Assistant." }
          : command.status === "IN_REVIEW"
            ? { completionRequestedAt: now, completionRequestedByMemberId: actor.id }
            : command.status
              ? { completedAt: null, approvedAt: null, approvedByMemberId: null }
              : {}),
        updatedAt: now,
      };
      if (Object.keys(values).length === 1) throw new Error("Tell me which task field to update.");
      await getDb().update(memberTasks).set(values).where(eq(memberTasks.id, task.id));
      await audit(actor.id, "assistant.task_updated", "member_task", task.id, { prompt, status: command.status, priority: command.priority });
      refresh();
      return { status: "success", message: `Updated task "${task.title}".`, href: "/admin/operations?tool=tasks" };
    }
    if (command.kind === "TASK_COMMENT") {
      const actor = await requirePermission("tasks.manage");
      const task = await resolveTask(command.task);
      const [row] = await getDb().insert(taskComments).values({ taskId: task.id, memberId: actor.id, body: command.comment, isDeliverable: command.isDeliverable }).returning({ id: taskComments.id });
      await audit(actor.id, "assistant.task_comment_created", "task_comment", row.id, { prompt, taskId: task.id, isDeliverable: command.isDeliverable });
      refresh();
      return { status: "success", message: `Added a ${command.isDeliverable ? "deliverable" : "comment"} to "${task.title}".`, href: "/admin/operations?tool=tasks" };
    }
    if (command.kind === "HOUR_LOG") {
      const hourActor = command.member
        ? await requirePermission("activity.edit_all")
        : actor;
      const member = command.member
        ? await resolveMember(command.member, hourActor.id)
        : hourActor;
      const workDate = optionalDate(command.date, new Date())!;
      const minutes = Math.max(1, Math.round(command.hours * 60));
      const [row] = await getDb()
        .insert(hourEntries)
        .values({
          memberId: member.id,
          workDate,
          minutes,
          project: command.project,
          category: command.category,
          description: command.description,
        })
        .returning({ id: hourEntries.id });
      await audit(hourActor.id, "assistant.hours_logged", "hour_entry", row.id, {
        prompt,
        memberId: member.id,
        minutes,
      });
      refresh();
      return {
        status: "success",
        message: `Logged ${command.hours.toFixed(2)} hour${command.hours === 1 ? "" : "s"} for ${member.displayName}.`,
        href: "/portal?tab=hours",
      };
    }
    if (command.kind === "NOTEBOOK_TODO") {
      const actor = await requirePermission("notebook.manage");
      const entry = await resolveNotebookEntry(command.entry);
      const body = [
        "Notebook to-do",
        ...command.items.map((item) => `- [ ] ${item}`),
      ].join("\n");
      const [row] = await getDb()
        .insert(engineeringNotebookComments)
        .values({
          entryId: entry.id,
          memberId: actor.id,
          kind: "PLAN",
          body,
        })
        .returning({ id: engineeringNotebookComments.id });
      await audit(
        actor.id,
        "assistant.notebook_todo_created",
        "notebook_comment",
        row.id,
        { prompt, entryId: entry.id, itemCount: command.items.length },
      );
      refresh();
      return {
        status: "success",
        message: `Added ${command.items.length} to-do item${command.items.length === 1 ? "" : "s"} to “${entry.title}”.`,
        href: "/admin/operations?tool=notebook",
      };
    }
    if (command.kind === "MEETING_CREATE") {
      const actor = await requirePermission("meetings.manage");
      const [row] = await getDb()
        .insert(meetingNotes)
        .values({
          title: command.title,
          heldAt: optionalDate(command.heldAt, new Date())!,
          location: command.location,
          discussion: command.notes,
          summary: command.notes,
          status: "DRAFT",
          createdByMemberId: actor.id,
        })
        .returning({ id: meetingNotes.id });
      await audit(actor.id, "assistant.meeting_created", "meeting_note", row.id, { prompt });
      refresh();
      return { status: "success", message: `Created meeting “${command.title}”.`, href: "/admin/operations?tool=meetings" };
    }
    if (command.kind === "ACTIVITY_CREATE") {
      const actor = await requirePermission("events.manage");
      const startsAt = optionalDate(command.startsAt, new Date())!;
      const endsAt = optionalDate(
        command.endsAt,
        new Date(startsAt.getTime() + 60 * 60 * 1000),
      )!;
      if (endsAt <= startsAt) throw new Error("The activity end time must be after its start time.");
      const [row] = await getDb()
        .insert(teamActivities)
        .values({
          slug: `${simpleSlug(command.title)}-${randomBytes(4).toString("hex")}`,
          title: command.title,
          description: command.description,
          type: command.activityType,
          location: command.location,
          startsAt,
          endsAt,
          status: "SCHEDULED",
          isPublic: false,
          attendanceOpenedAt: new Date(),
          createdByMemberId: actor.id,
        })
        .returning({ id: teamActivities.id });
      await audit(actor.id, "assistant.activity_created", "team_activity", row.id, { prompt });
      refresh();
      return { status: "success", message: `Created ${command.activityType.toLowerCase()} “${command.title}”.`, href: "/admin?tab=activities" };
    }
    if (command.kind === "POLL_CREATE") {
      const actor = await requirePermission("forms.manage");
      const today = new Date();
      const dates = command.dates.length
        ? command.dates
        : [0, 1, 2].map((offset) => {
            const date = new Date(today);
            date.setDate(today.getDate() + offset);
            return date.toISOString().slice(0, 10);
          });
      const [row] = await getDb()
        .insert(availabilityPolls)
        .values({
          accessKey: privateKey(),
          title: command.title,
          description: command.description,
          dates,
          startTime: command.startTime,
          endTime: command.endTime,
          status: "OPEN",
          openedAt: new Date(),
          createdByMemberId: actor.id,
          lastEditorMemberId: actor.id,
        })
        .returning({
          id: availabilityPolls.id,
          accessKey: availabilityPolls.accessKey,
        });
      await audit(actor.id, "assistant.poll_created", "availability_poll", row.id, { prompt });
      refresh();
      const firstDate = dates[0];
      const lastDate = dates.at(-1);
      return {
        status: "success",
        message: `Created and opened scheduling poll **${command.title}** for ${firstDate}${lastDate && lastDate !== firstDate ? ` through ${lastDate}` : ""}, ${command.startTime}–${command.endTime}.`,
        href: `/p/${row.accessKey}`,
      };
    }
    if (command.kind === "FORM_CREATE") {
      const actor = await requirePermission("forms.manage");
      const [row] = await getDb()
        .insert(publicForms)
        .values({
          accessKey: privateKey(),
          title: command.title,
          descriptionHtml: command.description
            ? `<p>${command.description.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</p>`
            : "<p></p>",
          fields: command.fields.map((field) => ({
            id: randomBytes(10).toString("hex"),
            type: field.type,
            label: field.label,
            description: "",
            required: field.required,
            options: field.options,
            maxFiles: field.type === "FILE_UPLOAD" ? 1 : undefined,
          })),
          status: "DRAFT",
          createdByMemberId: actor.id,
          lastEditorMemberId: actor.id,
        })
        .returning({ id: publicForms.id });
      await audit(actor.id, "assistant.form_created", "public_form", row.id, { prompt });
      refresh();
      return { status: "success", message: `Created draft form “${command.title}”.`, href: "/admin?tab=forms" };
    }
    if (command.kind === "RECOGNITION_CREATE") {
      const actor = await requirePermission("members.edit");
      const member = await resolveMember(command.member, actor.id);
      const [row] = await getDb()
        .insert(operationsHubRecords)
        .values({
          kind: "RECOGNITION",
          title: command.title,
          description: command.description,
          status: "ACTIVE",
          subjectMemberId: member.id,
          occurredAt: new Date(),
          data: { category: command.category },
          createdByMemberId: actor.id,
        })
        .returning({ id: operationsHubRecords.id });
      await audit(actor.id, "assistant.recognition_created", "operations_hub_record", row.id, { prompt, memberId: member.id });
      refresh();
      return { status: "success", message: `Added “${command.title}” to ${member.displayName}’s recognition portfolio.`, href: "/admin/control-center?tab=people" };
    }
    if (command.kind === "ATTENDANCE_RECORD") {
      const attendanceActor = await requirePermission("events.manage");
      const [activity, member] = await Promise.all([
        resolveActivity(command.activity),
        resolveMember(command.member, attendanceActor.id),
      ]);
      const [row] = await getDb()
        .insert(activityAttendance)
        .values({
          activityId: activity.id,
          memberId: member.id,
          status: "PRESENT",
          method: "AI_ASSISTANT",
          recordedByMemberId: attendanceActor.id,
          note: command.note,
        })
        .onConflictDoUpdate({
          target: [
            activityAttendance.activityId,
            activityAttendance.memberId,
          ],
          set: {
            status: "PRESENT",
            method: "AI_ASSISTANT",
            recordedByMemberId: attendanceActor.id,
            note: command.note,
            checkedInAt: new Date(),
            voidedAt: null,
            updatedAt: new Date(),
          },
        })
        .returning({ id: activityAttendance.id });
      await audit(
        attendanceActor.id,
        "assistant.attendance_recorded",
        "activity_attendance",
        row.id,
        { prompt, activityId: activity.id, memberId: member.id },
      );
      refresh();
      return {
        status: "success",
        message: `Marked ${member.displayName} present for “${activity.title}”.`,
        href: "/admin?tab=activities",
      };
    }
    if (command.kind === "NEWS_CREATE") {
      const newsActor = await requirePermission("content.manage");
      const slug = `${simpleSlug(command.title)}-${randomBytes(3).toString("hex")}`;
      const excerpt =
        command.excerpt ||
        command.body.replace(/\s+/g, " ").trim().slice(0, 240);
      const bodyHtml = simpleHtml(command.body);
      const publishedAt =
        command.status === "PUBLISHED" ? new Date() : null;
      const [row] = await getDb()
        .insert(posts)
        .values({
          slug,
          title: command.title,
          excerpt,
          bodyHtml,
          authorMemberId: newsActor.id,
          status: command.status,
          publishedAt,
        })
        .returning({ id: posts.id });
      await getDb().insert(postRevisions).values({
        postId: row.id,
        editorMemberId: newsActor.id,
        title: command.title,
        excerpt,
        bodyHtml,
      });
      await audit(newsActor.id, "assistant.news_created", "post", row.id, {
        prompt,
        status: command.status,
      });
      revalidatePath("/news");
      refresh();
      return {
        status: "success",
        message: `${command.status === "PUBLISHED" ? "Published" : "Created draft"} news post “${command.title}”.`,
        href: "/admin?tab=blog",
      };
    }
    if (command.kind === "INVENTORY_UPSERT") {
      const inventoryActor = await requirePermission("inventory.manage");
      const [existing] = await getDb()
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.sku, command.sku))
        .limit(1);
      if (!existing && !command.name)
        throw new Error(
          `Inventory item ${command.sku} is new, so include its name.`,
        );
      const values = {
        ...(command.name !== undefined ? { name: command.name } : {}),
        ...(command.quantityOnHand !== undefined
          ? { quantityOnHand: command.quantityOnHand }
          : {}),
        ...(command.reorderPoint !== undefined
          ? { reorderPoint: command.reorderPoint }
          : {}),
        ...(command.location !== undefined
          ? { location: command.location }
          : {}),
        ...(command.category !== undefined
          ? { category: command.category }
          : {}),
        ...(command.unitCost !== undefined
          ? { unitCostCents: Math.round(command.unitCost * 100) }
          : {}),
        ...(command.supplier !== undefined
          ? { supplier: command.supplier }
          : {}),
        updatedAt: new Date(),
      };
      const [row] = existing
        ? await getDb()
            .update(inventoryItems)
            .set(values)
            .where(eq(inventoryItems.id, existing.id))
            .returning({ id: inventoryItems.id })
        : await getDb()
            .insert(inventoryItems)
            .values({
              sku: command.sku,
              name: command.name!,
              quantityOnHand: command.quantityOnHand ?? 0,
              reorderPoint: command.reorderPoint ?? 0,
              location: command.location ?? "Shop",
              category: command.category ?? "Robot parts",
              unitCostCents: Math.round((command.unitCost ?? 0) * 100),
              supplier: command.supplier ?? "",
              createdByMemberId: inventoryActor.id,
            })
            .returning({ id: inventoryItems.id });
      await audit(
        inventoryActor.id,
        existing ? "assistant.inventory_updated" : "assistant.inventory_created",
        "inventory_item",
        row.id,
        { prompt, sku: command.sku },
      );
      refresh();
      return {
        status: "success",
        message: `${existing ? "Updated" : "Created"} inventory item ${command.sku}.`,
        href: "/admin/operations?tool=inventory",
      };
    }
    if (command.kind === "CONTROL_RECORD_CREATE") {
      const controlActor = await requirePermission("tasks.manage");
      const owner = command.owner
        ? await resolveMember(command.owner, controlActor.id)
        : controlActor;
      const dueAt = optionalDate(command.dueAt);
      const [row] = await getDb()
        .insert(operationsHubRecords)
        .values({
          kind: command.area,
          title: command.title,
          description: command.description,
          status: "ACTIVE",
          priority: command.priority,
          ownerMemberId: owner.id,
          dueAt,
          sourceType: "gemini-assistant",
          createdByMemberId: controlActor.id,
        })
        .returning({ id: operationsHubRecords.id });
      await audit(
        controlActor.id,
        "assistant.control_record_created",
        "operations_hub_record",
        row.id,
        { prompt, area: command.area },
      );
      refresh();
      return {
        status: "success",
        message: `Created ${command.area.toLowerCase().replaceAll("_", " ")} record “${command.title}”.`,
        href: "/admin/control-center",
      };
    }
    if (command.kind === "SPONSOR_FUNDING") {
      const sponsorActor = await requirePermission("finance.manage");
      const plan = await resolveCurrentPlan(command.plan);
      const [row] = await getDb()
        .insert(financeSponsorCommitments)
        .values({
          planId: plan.id,
          sponsorName: command.sponsorName,
          tier: command.tier,
          amountCents: Math.round(command.amount * 100),
          status: command.status,
          contactName: command.contactName,
          contactEmail: command.contactEmail,
          receivedAt: command.status === "RECEIVED" ? new Date() : null,
          createdByMemberId: sponsorActor.id,
        })
        .returning({ id: financeSponsorCommitments.id });
      await audit(
        sponsorActor.id,
        "assistant.sponsor_funding_created",
        "finance_sponsor_commitment",
        row.id,
        { prompt, planId: plan.id },
      );
      refresh();
      return {
        status: "success",
        message: `Added ${command.sponsorName} funding of $${command.amount.toFixed(2)} to ${plan.name}.`,
        href: "/admin/operations?tool=finance",
      };
    }
    if (command.kind === "PURCHASE_CREATE") {
      const actor = await requirePermission("purchasing.manage");
      const neededBy = optionalDate(command.neededBy);
      const [row] = await getDb()
        .insert(purchaseRequests)
        .values({
          item: command.item,
          quantity: command.quantity,
          vendor: command.vendor,
          estimatedUnitCostCents: Math.round((command.estimatedUnitCost || 0) * 100),
          neededBy,
          notes: command.notes,
          status: "DRAFT",
          requestedByMemberId: actor.id,
        })
        .returning({ id: purchaseRequests.id });
      await audit(actor.id, "assistant.purchase_created", "purchase_request", row.id, { prompt });
      refresh();
      return { status: "success", message: `Created a purchase request for ${command.quantity} × ${command.item}.`, href: "/admin/operations?tool=purchasing" };
    }
    if (command.kind === "ENGINEERING_RECORD_CREATE") {
      const actor = await requirePermission("engineering.manage");
      const dueAt = optionalDate(command.dueAt);
      const [row] = await getDb()
        .insert(operationsHubRecords)
        .values({
          kind: command.recordType,
          title: command.title,
          description: command.description,
          status: "ACTIVE",
          priority: command.priority,
          ownerMemberId: actor.id,
          dueAt,
          sourceType: "gemini-assistant",
          createdByMemberId: actor.id,
        })
        .returning({ id: operationsHubRecords.id });
      await audit(actor.id, "assistant.engineering_record_created", "operations_hub_record", row.id, { prompt, kind: command.recordType });
      refresh();
      return { status: "success", message: `Created engineering record “${command.title}”.`, href: "/admin/control-center?tab=team-os&view=engineering" };
    }
    if (command.kind === "DECISION_MATRIX_CREATE") {
      const actor = await requirePermission("engineering.manage");
      const result = await createDecisionMatrixRecord({
        actorId: actor.id,
        matrix: {
          title: command.title,
          criteria: command.criteria,
          concepts: command.concepts,
          recommendation: command.recommendation,
        },
        sourceType: "gemini-assistant",
      });
      refresh();
      return {
        status: "success",
        message: result.created
          ? `Created decision matrix “${command.title}”${result.winner ? ` and ranked ${result.winner} first` : ""}.`
          : `The decision matrix “${command.title}” was already imported, so no duplicate was created.`,
        href: "/admin/control-center?tab=team-os&view=decisions",
      };
    }
    if (command.kind === "SPONSOR_RESEARCH") {
      const actor = await requirePermission("sponsors.manage");
      const research = await discoverPublicCompanyContacts(command.company, command.website);
      const [row] = await getDb()
        .insert(operationsHubRecords)
        .values({
          kind: "SPONSOR_PROSPECT",
          title: command.company,
          description: `Public contact research for ${command.company}.`,
          status: "NEW",
          sourceType: "public-company-research",
          sourceUrl: research.website,
          data: {
            company: command.company,
            website: research.website,
            contactEmails: research.emails.join(", "),
            contactPhones: research.phones.join(", "),
            researchSources: research.sources.join("\n"),
            researchedAt: research.researchedAt,
          },
          createdByMemberId: actor.id,
        })
        .returning({ id: operationsHubRecords.id });
      await audit(actor.id, "assistant.sponsor_researched", "operations_hub_record", row.id, { prompt, sourceCount: research.sources.length });
      refresh();
      return { status: "success", message: `Researched ${command.company} and saved ${research.emails.length} email${research.emails.length === 1 ? "" : "s"} and ${research.phones.length} phone number${research.phones.length === 1 ? "" : "s"}.`, href: "/admin/control-center?tab=sponsors" };
    }
    if (command.kind === "BOM_ADD") {
      const actor = await requirePermission("engineering.manage");
      const [existing] = await getDb().select({ id: engineeringParts.id }).from(engineeringParts).where(and(eq(engineeringParts.project, command.project), eq(engineeringParts.partNumber, command.partNumber))).limit(1);
      if (existing) throw new Error(`${command.partNumber} already exists in ${command.project}; ask me to update it instead.`);
      const [row] = await getDb().insert(engineeringParts).values({
        project: command.project,
        subsystem: "General",
        partNumber: command.partNumber,
        name: command.name,
        description: command.description,
        quantity: command.quantity,
        revision: command.revision,
        material: command.material,
        supplier: command.supplier,
        makeBuy: command.makeBuy,
        unitCostCents: Math.round((command.unitCost || 0) * 100),
        createdByMemberId: actor.id,
      }).returning({ id: engineeringParts.id });
      await audit(actor.id, "assistant.bom_part_created", "engineering_part", row.id, { prompt, partNumber: command.partNumber });
      refresh();
      return { status: "success", message: `Added ${command.quantity} × ${command.partNumber} · ${command.name} to the ${command.project} BOM.`, href: "/admin/operations?tool=engineering" };
    }
    if (command.kind === "BOM_UPDATE") {
      const actor = await requirePermission("engineering.manage");
      const part = await resolvePart(command.part);
      const values = {
        ...(command.name !== undefined ? { name: command.name } : {}),
        ...(command.project !== undefined ? { project: command.project } : {}),
        ...(command.quantity !== undefined ? { quantity: command.quantity } : {}),
        ...(command.revision !== undefined ? { revision: command.revision } : {}),
        ...(command.material !== undefined ? { material: command.material } : {}),
        ...(command.supplier !== undefined ? { supplier: command.supplier } : {}),
        ...(command.unitCost !== undefined ? { unitCostCents: Math.round(command.unitCost * 100) } : {}),
        updatedAt: new Date(),
      };
      const deltas = Object.entries(values).filter(([key, next]) => key !== "updatedAt" && part[key as keyof typeof part] !== next).map(([key, next]) => `${key}: ${String(part[key as keyof typeof part] ?? "—")} → ${String(next)}`);
      if (!deltas.length) return { status: "success", message: `${part.partNumber} already has those values.` };
      await getDb().update(engineeringParts).set(values).where(eq(engineeringParts.id, part.id));
      const changeNumber = `AI-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
      const [change] = await getDb().insert(designChanges).values({
        seasonId: part.seasonId,
        projectId: part.engineeringProjectId,
        subsystemId: part.subsystemId,
        partId: part.id,
        changeNumber,
        title: `${part.partNumber} · Assistant update`,
        reason: "Controlled change requested through the 210 Assistant.",
        description: deltas.join("\n"),
        impact: "Review affected CAD, drawings, manufacturing instructions, inventory, and assemblies.",
        risk: command.revision && command.revision !== part.revision ? "MEDIUM" : "LOW",
        status: "IN_REVIEW",
        revisionFrom: part.revision,
        revisionTo: command.revision || part.revision,
        verificationPlan: "Verify the updated BOM values against Onshape and the physical assembly before approval.",
        requestedByMemberId: actor.id,
      }).returning({ id: designChanges.id });
      await audit(actor.id, "assistant.bom_part_updated", "engineering_part", part.id, { prompt, changeId: change.id, deltas });
      refresh();
      return { status: "success", message: `Updated ${part.partNumber} and opened design change ${changeNumber} for review.`, href: "/admin/operations?tool=changes" };
    }
    if (command.kind === "BUDGET_ADD") {
      const actor = await requirePermission("finance.manage");
      const plan = await resolveCurrentPlan(command.plan);
      const amountCents = Math.round(command.amount * 100);
      const [entry] = await getDb().insert(financeEntries).values({
        planId: plan.id,
        kind: command.entryKind,
        category: command.category,
        description: command.description,
        vendor: command.vendor,
        quantity: command.quantity,
        unitCostCents: Math.round(amountCents / command.quantity),
        amountCents,
        status: "PLANNED",
        occurredAt: new Date(),
        notes: "Created through the 210 Assistant.",
        createdByMemberId: actor.id,
      }).returning({ id: financeEntries.id });
      await audit(actor.id, "assistant.finance_entry_created", "finance_entry", entry.id, { prompt, planId: plan.id });
      refresh();
      return { status: "success", message: `Added ${command.entryKind.toLowerCase().replace("_", " ")} “${command.description}” for $${command.amount.toFixed(2)} to ${plan.name}.`, href: "/admin/operations?tool=finance" };
    }
    if (command.kind === "BUDGET_UPDATE") {
      const actor = await requirePermission("finance.manage");
      const entry = await resolveFinanceEntry(command.entry, command.plan);
      const amountCents = command.amount !== undefined ? Math.round(command.amount * 100) : entry.amountCents;
      const quantity = command.quantity ?? entry.quantity;
      await getDb().update(financeEntries).set({
        ...(command.description !== undefined ? { description: command.description } : {}),
        ...(command.category !== undefined ? { category: command.category } : {}),
        ...(command.vendor !== undefined ? { vendor: command.vendor } : {}),
        ...(command.status !== undefined ? { status: command.status } : {}),
        quantity,
        amountCents,
        unitCostCents: Math.round(amountCents / quantity),
        updatedAt: new Date(),
      }).where(eq(financeEntries.id, entry.id));
      await audit(actor.id, "assistant.finance_entry_updated", "finance_entry", entry.id, { prompt, previousAmountCents: entry.amountCents, amountCents });
      refresh();
      return { status: "success", message: `Updated budget line “${command.description || entry.description}” to $${(amountCents / 100).toFixed(2)}.`, href: "/admin/operations?tool=finance" };
    }
    if (command.kind === "DONATION_STATUS") {
      const [summary, campaign] = await Promise.all([
        getDonationSummary(),
        getDonationCampaign(),
      ]);
      const raised = summary.netRaisedCents / 100;
      const goal = campaign.goalCents / 100;
      const progress = goal > 0 ? Math.min((raised / goal) * 100, 100) : 0;
      const currency = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      });
      return {
        status: "success",
        message: `210 Robotics has raised **${currency.format(raised)}** from ${summary.confirmedCount} paid donation${summary.confirmedCount === 1 ? "" : "s"} toward the **${currency.format(goal)}** goal (${progress.toFixed(1)}%). **${currency.format(summary.last30DaysCents / 100)}** was raised in the last 30 days.`,
        href: "/donate",
      };
    }
    if (command.kind === "BUDGET_STATUS") {
      await requirePermission("finance.manage");
      const plan = await resolveCurrentPlan(command.plan);
      const entries = await getDb()
        .select({
          kind: financeEntries.kind,
          amountCents: financeEntries.amountCents,
          status: financeEntries.status,
        })
        .from(financeEntries)
        .where(eq(financeEntries.planId, plan.id));
      const activeEntries = entries.filter((entry) => entry.status !== "CANCELED");
      const expensesCents = activeEntries
        .filter((entry) => entry.kind === "EXPENSE")
        .reduce((sum, entry) => sum + entry.amountCents, 0);
      const incomeCents = activeEntries
        .filter((entry) => entry.kind === "INCOME")
        .reduce((sum, entry) => sum + entry.amountCents, 0);
      const committedCents = activeEntries
        .filter((entry) => ["BUDGET_ITEM", "BOM_ITEM"].includes(entry.kind))
        .reduce((sum, entry) => sum + entry.amountCents, 0);
      const remainingCents =
        plan.maximumBudgetCents + incomeCents - expensesCents - committedCents;
      const currency = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      });
      return {
        status: "success",
        message: `**${plan.name}** has **${currency.format(remainingCents / 100)} remaining** against its ${currency.format(plan.maximumBudgetCents / 100)} maximum. That includes ${currency.format(incomeCents / 100)} in recorded income, ${currency.format(expensesCents / 100)} in expenses, and ${currency.format(committedCents / 100)} in planned budget/BOM items.`,
        href: "/admin/operations?tool=finance",
      };
    }
    if (command.kind === "NEXT_EVENT") {
      const now = Date.now();
      const event = (await getCalendarEvents()).find(
        (candidate) => new Date(candidate.end).getTime() >= now,
      );
      if (!event) {
        return {
          status: "success",
          message: "There are no upcoming public team events on the calendar.",
          href: "/events",
        };
      }
      const startsAt = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: event.allDay ? undefined : "numeric",
        minute: event.allDay ? undefined : "2-digit",
        timeZoneName: event.allDay ? undefined : "short",
      }).format(new Date(event.start));
      return {
        status: "success",
        message: `The next event is **${event.title}** on **${startsAt}**${event.location ? ` at **${event.location}**` : ""}.`,
        href: "/events",
      };
    }
    if (command.kind === "DONATION_CAMPAIGN") {
      const actor = await requirePermission("finance.manage");
      const campaign = await getDonationCampaign();
      const values = {
        ...(command.title !== undefined ? { title: command.title } : {}),
        ...(command.description !== undefined ? { description: command.description } : {}),
        ...(command.goal !== undefined ? { goalCents: Math.round(command.goal * 100) } : {}),
        ...(command.suggestedAmounts !== undefined
          ? { suggestedAmountsCents: [...new Set(command.suggestedAmounts.map((amount) => Math.round(amount * 100)))] }
          : {}),
        ...(command.active !== undefined ? { isActive: command.active } : {}),
        updatedByMemberId: actor.id,
        updatedAt: new Date(),
      };
      if (Object.keys(values).length === 2) throw new Error("Tell me which donation campaign setting to update.");
      await getDb()
        .insert(donationCampaignSettings)
        .values({ ...campaign, ...values, id: DEFAULT_DONATION_CAMPAIGN.id })
        .onConflictDoUpdate({ target: donationCampaignSettings.id, set: values });
      await audit(actor.id, "assistant.donation_campaign_updated", "donation_campaign", campaign.id, { prompt });
      revalidatePath("/donate");
      revalidatePath("/sponsors");
      refresh();
      return { status: "success", message: "Updated the public donation campaign.", href: "/admin/operations?tool=finance" };
    }
    const financeActor = await requirePermission("finance.manage");
    const plan = await resolvePlan(command.plan);
    if (command.maximum < command.minimum) throw new Error("Maximum budget must be at least the minimum budget.");
    await getDb().update(financePlans).set({ minimumBudgetCents: Math.round(command.minimum * 100), maximumBudgetCents: Math.round(command.maximum * 100), updatedAt: new Date() }).where(eq(financePlans.id, plan.id));
    await audit(financeActor.id, "assistant.finance_limits_updated", "finance_plan", plan.id, { prompt, minimum: command.minimum, maximum: command.maximum });
    refresh();
    return { status: "success", message: `Updated ${plan.name}: minimum $${command.minimum.toFixed(2)}, maximum $${command.maximum.toFixed(2)}.`, href: "/admin/operations?tool=finance" };
  } catch (error) {
    console.error(JSON.stringify({
      event: "assistant.command_failed",
      actorId: actor.id,
      commandKind: command.kind,
      error: error instanceof Error ? error.message.slice(0, 300) : "Unknown execution error",
    }));
    return { status: "error", message: error instanceof Error ? error.message : "The requested action could not be completed." };
  }
}

export async function processAssistantDocument(
  input: AssistantDocumentUpload,
): Promise<AssistantDocumentResult> {
  try {
    const actor = await requirePermission("documents.manage");
    const archive = await finalizeInternalDocumentUpload({
      ...input,
      category: "AI intake",
      purpose: "internal-document",
    });
    if (archive.status !== "success" || !archive.documentId) return archive;

    const [document] = await getDb()
      .select({
        contentHtml: internalDocuments.contentHtml,
      })
      .from(internalDocuments)
      .where(eq(internalDocuments.id, archive.documentId))
      .limit(1);
    const buffer = await readPrivateBlob(input.pathname);
    const spreadsheet = /\.(xlsx|csv|tsv)$/i.test(input.filename);
    const tabularSheets = spreadsheet
      ? await readTabularBuffer({ filename: input.filename, buffer })
      : [];
    const sourceText = spreadsheet
      ? spreadsheetSource(tabularSheets)
      : plainDocumentText(document?.contentHtml || "");
    const routeSignals = documentRouteSignals({
      sourceText,
      contentHtml: document?.contentHtml || "",
      filename: input.filename,
      instructions: input.instructions,
    });

    const details: string[] = [];
    let importedCount = 0;
    let skippedCount = 0;
    let bomImported = false;
    const extractedMatrices = extractDecisionMatrices({
      sourceText,
      contentHtml: document?.contentHtml || "",
      filename: input.filename,
    });
    let decisionMatricesImported = false;
    if (extractedMatrices.length) {
      try {
        const engineeringActor = await requirePermission("engineering.manage");
        for (const matrix of extractedMatrices) {
          const result = await createDecisionMatrixRecord({
            actorId: engineeringActor.id,
            matrix,
            sourceType: input.sourceUrl
              ? "google-drive-assistant"
              : "assistant-document-intake",
            sourceId: archive.documentId,
            sourceUrl: input.sourceUrl,
          });
          if (result.created) {
            importedCount += 1;
            decisionMatricesImported = true;
            details.push(
              `Decision matrix: imported “${matrix.title}” with ${matrix.criteria.length} criteria and ${matrix.concepts.length} concepts${result.winner ? `; ${result.winner} ranked first` : ""}.`,
            );
          } else {
            details.push(
              `Decision matrix: “${matrix.title}” already exists, so a duplicate was not created.`,
            );
          }
          const concernCreated = await createDecisionMatrixConcern({
            actorId: engineeringActor.id,
            matrix,
            sourceType: input.sourceUrl
              ? "google-drive-assistant"
              : "assistant-document-intake",
            sourceId: archive.documentId,
            sourceUrl: input.sourceUrl,
          });
          if (concernCreated) {
            importedCount += 1;
            details.push(
              "Engineering: added the matrix’s key concern to Open Engineering Questions.",
            );
          }
        }
      } catch (error) {
        details.push(
          error instanceof Error
            ? `Decision matrix import: ${error.message}`
            : "The decision matrix could not be imported.",
        );
      }
    }
    const pricedMaterialCommands = spreadsheet || !routeSignals.finance
      ? []
      : extractPricedMaterialCommands({
          sourceText,
          filename: input.filename,
          instructions: input.instructions,
        });
    let pricedMaterialsImported = false;
    if (spreadsheet && routeSignals.finance) {
      const seenFinanceRows = new Set<string>();
      for (const sheet of tabularSheets) {
        let parsed: ReturnType<typeof parseFinanceSheets>;
        try {
          parsed = parseFinanceSheets([sheet], {
            kind: "EXPENSE",
            status: "PLANNED",
          });
        } catch {
          continue;
        }
        try {
          const financeActor = await requirePermission("finance.manage");
          const resolvedPlan = await resolveFinanceImportPlan({
            actorId: financeActor.id,
            instructions: input.instructions,
            filename: input.filename,
            sheetName: sheet.name,
          });
          const result = await importAssistantFinanceRows({
            actorId: financeActor.id,
            filename: input.filename,
            plan: resolvedPlan.plan,
            rows: parsed.rows,
            seen: seenFinanceRows,
          });
          pricedMaterialsImported = true;
          importedCount += result.imported;
          skippedCount += parsed.skipped + result.skipped;
          details.push(
            `Finance: ${resolvedPlan.created ? `created budget plan “${resolvedPlan.plan.name}” and ` : ""}added ${result.imported} row${result.imported === 1 ? "" : "s"} from ${sheet.name} to ${resolvedPlan.plan.name}${result.skipped ? `; skipped ${result.skipped} duplicate${result.skipped === 1 ? "" : "s"}` : ""}.`,
          );
        } catch (error) {
          details.push(
            error instanceof Error
              ? `Finance import (${sheet.name}): ${error.message}`
              : `Finance import (${sheet.name}) could not be completed.`,
          );
        }
      }
    }
    if (spreadsheet) {
      const parsedBom = parseOnshapeBom(sourceText);
      const normalizedHeaders = parsedBom.headers
        .join(" ")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ");
      const looksLikeBom =
        /\b(bom|part|onshape)\b/i.test(input.filename) ||
        (/\b(part number|part no|part)\b/.test(normalizedHeaders) &&
          /\b(quantity|qty|revision|material)\b/.test(normalizedHeaders));
      if (looksLikeBom && parsedBom.rows.length) {
        try {
          const formData = new FormData();
          formData.set("rows", JSON.stringify(parsedBom.rows));
          formData.set("project", "VEX U");
          formData.set("subsystem", "General");
          const result = await importOnshapeBom(formData);
          details.push(result.message);
          importedCount += parsedBom.rows.length;
          skippedCount += parsedBom.skipped;
          bomImported = true;
        } catch (error) {
          details.push(
            error instanceof Error
              ? `BOM import: ${error.message}`
              : "The BOM rows could not be imported.",
          );
        }
      }
    }

    if (pricedMaterialCommands.length) {
      try {
        const financeActor = await requirePermission("finance.manage");
        const resolvedPlan = await resolveFinanceImportPlan({
          actorId: financeActor.id,
          instructions: input.instructions,
          filename: input.filename,
          sheetName: "Document items",
        });
        const plan = resolvedPlan.plan;
        for (let index = 0; index < pricedMaterialCommands.length; index += 75) {
          const batch = pricedMaterialCommands.slice(index, index + 75);
          await getDb().insert(financeEntries).values(
            batch.map((command) => {
              if (command.kind !== "BUDGET_ADD")
                throw new Error("Unexpected priced-material command.");
              const amountCents = Math.round(command.amount * 100);
              return {
                planId: plan.id,
                kind: "EXPENSE",
                category: command.category,
                description: command.description,
                vendor: command.vendor,
                quantity: command.quantity,
                unitCostCents: Math.round(amountCents / command.quantity),
                amountCents,
                status: "PLANNED",
                occurredAt: new Date(),
                notes: `Imported from ${input.filename} through the 210 Assistant.`,
                createdByMemberId: financeActor.id,
              };
            }),
          );
        }
        importedCount += pricedMaterialCommands.length;
        pricedMaterialsImported = true;
        details.push(
          `Finance import: added ${pricedMaterialCommands.length} itemized expense${pricedMaterialCommands.length === 1 ? "" : "s"} to ${plan.name}.`,
        );
      } catch (error) {
        details.push(
          error instanceof Error
            ? `Finance import: ${error.message}`
            : "The priced material rows could not be imported.",
        );
      }
    }

    const plannedCommands = await planAssistantDocument(
      `File: ${input.filename}
User instructions: ${input.instructions || "Classify this material and import every explicit operational record into its appropriate area."}
Routing evidence: finance=${routeSignals.finance ? "yes" : "no"}, decision-matrix=${routeSignals.decision ? "yes" : "no"}, task/action=${routeSignals.task ? "yes" : "no"}.
Do not create a decision matrix when decision-matrix evidence is no. Do not create finance entries when finance evidence is no. Use task/action evidence as a strong cue for TASK_CREATE, but also recognize ordinary action language such as someone needing to do, finish, review, update, or follow up on something.
${bomImported ? "The BOM rows were already imported deterministically. Do not return BOM_ADD or BOM_UPDATE commands." : ""}
${pricedMaterialsImported ? "The conventional priced-material rows were already imported deterministically. Do not return BUDGET_ADD commands for those rows; extract only other explicit records such as purchases, tasks, schedules, or sponsor information." : ""}
${decisionMatricesImported ? "The structured decision matrix was already imported deterministically. Do not return DECISION_MATRIX_CREATE for that matrix; still extract its explicit decision record, open questions, concerns, assumptions, and action items into their appropriate areas." : ""}

${sourceText}`,
      actor.id,
    );
    const commands = plannedCommands.filter(
      (command) =>
        (!bomImported ||
          (command.kind !== "BOM_ADD" && command.kind !== "BOM_UPDATE")) &&
        (!pricedMaterialsImported || command.kind !== "BUDGET_ADD") &&
        (routeSignals.finance || command.kind !== "BUDGET_ADD") &&
        (routeSignals.decision ||
          command.kind !== "DECISION_MATRIX_CREATE") &&
        (!decisionMatricesImported ||
          command.kind !== "DECISION_MATRIX_CREATE"),
    );
    for (const command of commands) {
      const result = await executeAssistantCommand({
        prompt: `Imported from ${input.filename}`,
        command,
      });
      details.push(result.message);
      if (result.status === "success") importedCount += 1;
      else skippedCount += 1;
    }

    await audit(
      actor.id,
      "assistant.document_processed",
      "internal_document",
      archive.documentId,
      {
        filename: input.filename,
        importedCount,
        skippedCount,
        bomImported,
        commandCount: commands.length,
        pricedMaterialCount: pricedMaterialCommands.length,
        pricedMaterialsImported,
        decisionMatrixCount: extractedMatrices.length,
        decisionMatricesImported,
      },
    );
    refresh();
    return {
      status: "success",
      message: importedCount
        ? `${input.filename} was archived and ${importedCount} record${importedCount === 1 ? "" : "s"} were imported.`
        : `${input.filename} was archived. Gemini did not find any explicit records that could be safely added.`,
      documentId: archive.documentId,
      importedCount,
      skippedCount,
      details: details.slice(0, 30),
    };
  } catch (error) {
    console.error("Assistant document processing failed", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The document could not be processed.",
    };
  }
}

export async function processAssistantDriveLink(input: {
  url: string;
  instructions?: string;
}): Promise<AssistantDocumentResult> {
  try {
    const actor = await requirePermission("documents.manage");
    const source = await downloadSharedDriveDocument(input.url);
    if (source.buffer.byteLength > MAX_INTERNAL_DOCUMENT_BYTES)
      throw new Error("The Google Drive file is larger than 40 MB.");
    const filename = safeDocumentName(source.filename);
    const pathname = `uploads/internal-document/${actor.id}/${randomBytes(16).toString("hex")}-${filename}`;
    const blob = await put(pathname, source.buffer, {
      access: "private",
      token: privateBlobToken(),
      contentType: source.mimeType,
      addRandomSuffix: true,
    });
    return processAssistantDocument({
      pathname: blob.pathname,
      filename,
      contentType: source.mimeType,
      size: source.buffer.byteLength,
      instructions: input.instructions,
      sourceUrl: source.driveWebViewLink,
    });
  } catch (error) {
    console.error("Assistant Drive import failed", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The Google Drive file could not be imported.",
    };
  }
}

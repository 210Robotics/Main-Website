"use server";

import { and, eq, isNotNull, isNull, lte, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import {
  auditEvents,
  contributions,
  designChanges,
  docPages,
  inventoryItems,
  mediaAssets,
  meetingNotes,
  members,
  memberTasks,
  operationsHubRecords,
  publicForms,
  publicFormResponses,
  availabilityPolls,
  availabilityPollResponses,
  engineeringProjects,
  engineeringSeasons,
  engineeringSubsystems,
} from "@/db/schema";
import { requireActiveMember, requireAdminAccess } from "@/lib/auth";
import { getDriveAccessToken } from "@/lib/drive-sync";
import { notifyDiscordAdmin } from "@/lib/discord";
import { hasAnyPermission, type PermissionKey } from "@/lib/permissions";
import { scoreDecisionMatrix } from "@/lib/control-center";
import { discoverPublicCompanyContacts } from "@/lib/public-company-discovery";
import {
  parseDecisionMatrixRows,
  readTabularUpload,
} from "@/lib/spreadsheet-import";
import { generateGeminiText } from "@/lib/team-ai";

const kinds = [
  "RECOGNITION",
  "DECISION_MATRIX",
  "ISSUE",
  "RACI",
  "TEMPLATE",
  "AUTOMATION",
  "NOTIFICATION",
  "NOTEBOOK_SUGGESTION",
  "SPONSOR_ENGAGEMENT",
  "SPONSOR_TEMPLATE",
  "SPONSOR_PROSPECT",
  "COMPETITION_EVENT",
  "BATTERY",
  "ROBOT_CONFIG",
  "PIT_CHECK",
  "ENGINEERING_QUESTION",
  "TECH_DEBT",
  "CORRECTIVE_ACTION",
  "KNOWLEDGE_GAP",
  "CROSS_TRAINING",
  "APPROVAL",
  "DEPENDENCY",
  "GITHUB_REPO",
  "GITHUB_ACCOUNT",
  "IMPACT_METRIC",
] as const;

function value(formData: FormData, key: string, required = false) {
  const result = String(formData.get(key) ?? "").trim();
  if (required && !result) throw new Error(`${key} is required.`);
  if (result.length > 20_000) throw new Error(`${key} is too long.`);
  return result;
}

function optionalDate(raw: FormDataEntryValue | null) {
  if (!raw || typeof raw !== "string") return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new Error("Enter a valid date.");
  return parsed;
}

function fingerprint(kind: string, title: string, subject = "") {
  return `${kind}:${title}:${subject}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function recordData(formData: FormData) {
  const allowed = [
    "category",
    "evidenceUrl",
    "issuer",
    "criteria",
    "options",
    "recommendation",
    "responsible",
    "accountable",
    "consulted",
    "informed",
    "severity",
    "failureMode",
    "rootCause",
    "resolution",
    "templateKind",
    "templateBody",
    "trigger",
    "action",
    "cadUrl",
    "drawingUrl",
    "instructionsUrl",
    "sku",
    "contactEmails",
    "commitment",
    "deliverables",
    "renewal",
    "nextAction",
    "driveStatus",
    "sourceSummary",
    "website",
    "industry",
    "contactName",
    "contactRole",
    "contactPhones",
    "responseStatus",
    "ownerNotes",
    "emailSubject",
    "emailBody",
    "emailStage",
    "lastContactedAt",
    "nextFollowUpAt",
    "researchSources",
    "eventName",
    "matchNumber",
    "pitLocation",
    "batteryId",
    "batteryVoltage",
    "batteryCycles",
    "robotName",
    "configuration",
    "firmwareVersion",
    "checklistGroup",
    "checklistItem",
    "assumption",
    "answer",
    "impact",
    "rootCause",
    "correctiveAction",
    "skill",
    "currentLevel",
    "targetLevel",
    "trainer",
    "approvalType",
    "approvalNote",
    "blockedBy",
    "dependencyType",
    "repoUrl",
    "githubUsername",
    "metricValue",
    "metricUnit",
    "reportYear",
  ];
  const data: Record<string, unknown> = Object.fromEntries(
    allowed
      .map((key) => [key, value(formData, key)])
      .filter(([, item]) => item !== ""),
  );
  const criteria = value(formData, "criteria");
  const options = value(formData, "options");
  if (criteria && options) {
    const scores = scoreDecisionMatrix(criteria, options);
    data.computedScores = scores
      .map((item) => `${item.name}: ${item.score}/10`)
      .join("\n");
    data.winner = scores[0]?.name ?? "";
  }
  return data;
}

function refresh() {
  revalidatePath("/admin/control-center");
  revalidatePath("/portal");
  revalidatePath("/shop");
}

export async function saveHubRecord(formData: FormData) {
  const actor = await requireAdminAccess();
  const kind = value(formData, "kind", true);
  if (!kinds.includes(kind as (typeof kinds)[number]))
    throw new Error("Unsupported record type.");
  assertKindAccess(actor, kind);
  const id = value(formData, "id");
  const title = value(formData, "title", true);
  const subjectMemberId = value(formData, "subjectMemberId") || null;
  const values = {
    kind,
    title,
    description: value(formData, "description"),
    status: value(formData, "status") || "ACTIVE",
    priority: value(formData, "priority") || "NORMAL",
    ownerMemberId: value(formData, "ownerMemberId") || null,
    subjectMemberId,
    seasonId: value(formData, "seasonId") || null,
    projectId: value(formData, "projectId") || null,
    subsystemId: value(formData, "subsystemId") || null,
    partId: value(formData, "partId") || null,
    dueAt: optionalDate(formData.get("dueAt")),
    occurredAt: optionalDate(formData.get("occurredAt")),
    sourceType: value(formData, "sourceType") || null,
    sourceId: value(formData, "sourceId") || null,
    sourceUrl: value(formData, "sourceUrl") || null,
    data: recordData(formData),
    updatedAt: new Date(),
  };
  if (id) {
    const [existing] = await getDb()
      .select({ data: operationsHubRecords.data })
      .from(operationsHubRecords)
      .where(eq(operationsHubRecords.id, id))
      .limit(1);
    const [updated] = await getDb()
      .update(operationsHubRecords)
      .set({ ...values, data: { ...(existing?.data ?? {}), ...values.data } })
      .where(eq(operationsHubRecords.id, id))
      .returning();
    if (!updated) throw new Error("Record not found.");
  } else {
    const fp = [
      "RECOGNITION",
      "RACI",
      "ISSUE",
      "SPONSOR_ENGAGEMENT",
      "SPONSOR_PROSPECT",
    ].includes(kind)
      ? fingerprint(kind, title, subjectMemberId ?? "")
      : null;
    await getDb()
      .insert(operationsHubRecords)
      .values({ ...values, fingerprint: fp, createdByMemberId: actor.id });
  }
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: id ? "control.record_updated" : "control.record_created",
      entityType: kind.toLowerCase(),
      entityId: id || title,
      details: { title },
    });
  await notifyDiscordAdmin({
    title: `${id ? "Updated" : "New"} ${kind.replaceAll("_", " ").toLowerCase()}`,
    body: title,
    path: "/admin/control-center",
  }).catch((error: unknown) =>
    console.error("Discord control-center notification failed", error),
  );
  refresh();
}

export async function importDecisionMatrix(formData: FormData) {
  const actor = await requireAdminAccess();
  assertKindAccess(actor, "DECISION_MATRIX");
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size)
    throw new Error("Choose a decision-matrix spreadsheet.");
  const sheets = await readTabularUpload(file);
  let parsed: ReturnType<typeof parseDecisionMatrixRows> | null = null;
  let sheetName = "";
  const errors: string[] = [];
  for (const sheet of sheets) {
    try {
      parsed = parseDecisionMatrixRows(sheet.rows);
      sheetName = sheet.name;
      break;
    } catch (error) {
      if (error instanceof Error) errors.push(error.message);
    }
  }
  if (!parsed)
    throw new Error(
      errors[0] ||
        "No decision matrix was found in the uploaded spreadsheet.",
    );
  const criteria = parsed.criteria
    .map((item) => `${item.name} | ${item.weight} | ${item.goal}`)
    .join("\n");
  const options = parsed.concepts
    .map((item) => `${item.name} | ${item.values.join(",")}`)
    .join("\n");
  const scores = scoreDecisionMatrix(criteria, options);
  const title =
    value(formData, "title") ||
    file.name.replace(/\.(xlsx|csv|tsv)$/i, "").replaceAll(/[-_]+/g, " ");
  const [row] = await getDb()
    .insert(operationsHubRecords)
    .values({
      kind: "DECISION_MATRIX",
      title: title.slice(0, 300),
      status: "ACTIVE",
      seasonId: value(formData, "seasonId") || null,
      projectId: value(formData, "projectId") || null,
      subsystemId: value(formData, "subsystemId") || null,
      sourceType: "spreadsheet-import",
      sourceId: file.name.slice(0, 500),
      data: {
        criteria,
        options,
        recommendation: value(formData, "recommendation"),
        computedScores: scores
          .map((item) => `${item.name}: ${item.score}/10`)
          .join("\n"),
        winner: scores[0]?.name ?? "",
        importedSheet: sheetName,
        importedFilename: file.name,
      },
      createdByMemberId: actor.id,
    })
    .returning({ id: operationsHubRecords.id });
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: "control.decision_matrix_imported",
      entityType: "decision_matrix",
      entityId: row.id,
      details: {
        filename: file.name,
        sheetName,
        criteria: parsed.criteria.length,
        concepts: parsed.concepts.length,
        winner: scores[0]?.name ?? "",
      },
    });
  refresh();
  return {
    message: `Imported ${parsed.concepts.length} designs across ${parsed.criteria.length} criteria. ${scores[0]?.name ? `${scores[0].name} currently ranks first.` : ""}`.trim(),
  };
}

export async function archiveHubRecord(formData: FormData) {
  const actor = await requireAdminAccess();
  const id = value(formData, "id", true);
  const [existing] = await getDb()
    .select({ kind: operationsHubRecords.kind })
    .from(operationsHubRecords)
    .where(eq(operationsHubRecords.id, id))
    .limit(1);
  if (!existing) throw new Error("Record not found.");
  assertKindAccess(actor, existing.kind);
  const [record] = await getDb()
    .update(operationsHubRecords)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(operationsHubRecords.id, id))
    .returning();
  if (record)
    await getDb()
      .insert(auditEvents)
      .values({
        actorMemberId: actor.id,
        action: "control.record_archived",
        entityType: record.kind.toLowerCase(),
        entityId: id,
        details: { title: record.title },
      });
  refresh();
}

export async function setHubRecordStatus(formData: FormData) {
  const actor = await requireAdminAccess();
  const id = value(formData, "id", true);
  const status = value(formData, "status", true).slice(0, 60);
  const [existing] = await getDb()
    .select({ kind: operationsHubRecords.kind, title: operationsHubRecords.title })
    .from(operationsHubRecords)
    .where(eq(operationsHubRecords.id, id))
    .limit(1);
  if (!existing) throw new Error("Record not found.");
  assertKindAccess(actor, existing.kind);
  await getDb()
    .update(operationsHubRecords)
    .set({ status, updatedAt: new Date() })
    .where(eq(operationsHubRecords.id, id));
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "control.record_status_updated",
    entityType: existing.kind.toLowerCase(),
    entityId: id,
    details: { title: existing.title, status },
  });
  refresh();
}

export async function rolloverEngineeringSeason(formData: FormData) {
  const actor = await requireAdminAccess();
  if (
    !hasAnyPermission(
      actor.accessRole,
      ["seasons.manage", "engineering.manage"],
      actor.permissionOverrides,
    )
  )
    throw new Error("You do not have season rollover access.");
  const sourceId = value(formData, "sourceSeasonId", true);
  const name = value(formData, "name", true).slice(0, 120);
  const competition = value(formData, "competition") || "VEX U";
  const gameName = value(formData, "gameName") || "New season";
  const startsAt = optionalDate(formData.get("startsAt"));
  const endsAt = optionalDate(formData.get("endsAt"));
  if (!startsAt || !endsAt)
    throw new Error("Enter both the season start and end dates.");
  if (endsAt <= startsAt)
    throw new Error("The season end date must be after the start date.");
  const [source] = await getDb()
    .select()
    .from(engineeringSeasons)
    .where(eq(engineeringSeasons.id, sourceId))
    .limit(1);
  if (!source) throw new Error("Source season not found.");
  const [created] = await getDb()
    .insert(engineeringSeasons)
    .values({
      name,
      competition,
      gameName,
      gameManualVersion: "1.0",
      status: "PLANNING",
      isDefault: formData.get("isDefault") === "on",
      startsAt,
      endsAt,
      createdByMemberId: actor.id,
    })
    .returning();
  if (created.isDefault)
    await getDb()
      .update(engineeringSeasons)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(ne(engineeringSeasons.id, created.id));
  const projectMap = new Map<string, string>();
  if (formData.get("cloneStructure") === "on") {
    const sourceProjects = await getDb()
      .select()
      .from(engineeringProjects)
      .where(eq(engineeringProjects.seasonId, sourceId));
    for (const project of sourceProjects) {
      const [copy] = await getDb()
        .insert(engineeringProjects)
        .values({
          seasonId: created.id,
          code: project.code,
          name: project.name,
          description: project.description,
          status: "PLANNING",
          leadMemberId: project.leadMemberId,
          createdByMemberId: actor.id,
        })
        .returning({ id: engineeringProjects.id });
      projectMap.set(project.id, copy.id);
    }
    const sourceSubsystems = await getDb()
      .select()
      .from(engineeringSubsystems);
    for (const subsystem of sourceSubsystems) {
      const projectId = projectMap.get(subsystem.projectId);
      if (!projectId) continue;
      await getDb().insert(engineeringSubsystems).values({
        projectId,
        code: subsystem.code,
        name: subsystem.name,
        description: subsystem.description,
        status: "PLANNING",
        leadMemberId: subsystem.leadMemberId,
        createdByMemberId: actor.id,
      });
    }
  }
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "control.season_rolled_over",
    entityType: "engineering_season",
    entityId: created.id,
    details: { sourceId, name, projectsCloned: projectMap.size },
  });
  revalidatePath("/admin/operations");
  refresh();
}

export async function createAdminEntryFromPrompt(formData: FormData) {
  const actor = await requireAdminAccess();
  const prompt = value(formData, "prompt", true).slice(0, 4000);
  const requestedType = value(formData, "creationType") || "AUTO";
  const createTask =
    requestedType === "TASK" ||
    (requestedType === "AUTO" && /\b(task|assign|todo|to-do)\b/i.test(prompt));
  let draft = inferAdminDraft(prompt);
  let sourceType = "admin-assistant-fallback";
  {
    const raw = await generateGeminiText({
      userId: actor.id,
      feature: "admin-entry",
      system:
        "Turn the request into one concise Team OS draft. Return only valid JSON with kind, title, description, status, priority, and dueAt. Allowed kinds: ENGINEERING_QUESTION, TECH_DEBT, CORRECTIVE_ACTION, KNOWLEDGE_GAP, CROSS_TRAINING, APPROVAL, DEPENDENCY, PIT_CHECK, COMPETITION_EVENT.",
      prompt,
      maxOutputTokens: 500,
    });
    if (raw)
      try {
        const parsed = JSON.parse(
          raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""),
        ) as typeof draft;
        if (kinds.includes(parsed.kind as (typeof kinds)[number])) {
          draft = parsed;
          sourceType = "gemini-admin-assistant";
        }
      } catch {
        // Keep the deterministic draft when structured generation is malformed.
      }
  }
  if (createTask) {
    const requestedAssignee = value(formData, "assignedToMemberId") || actor.id;
    const [assignee] = await getDb()
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.id, requestedAssignee), eq(members.status, "ACTIVE")))
      .limit(1);
    if (!assignee) throw new Error("Choose an active member for this task.");
    const [task] = await getDb()
      .insert(memberTasks)
      .values({
        assignedToMemberId: assignee.id,
        createdByMemberId: actor.id,
        title: draft.title.slice(0, 180),
        description: draft.description.slice(0, 4000),
        project: "Organization",
        priority: draft.priority === "HIGH" ? "HIGH" : "NORMAL",
        status: "TODO",
        dueAt: draft.dueAt ? optionalDate(draft.dueAt) : null,
      })
      .returning({ id: memberTasks.id });
    await getDb().insert(auditEvents).values({
      actorMemberId: actor.id,
      action: "task.created_by_assistant",
      entityType: "member_task",
      entityId: task.id,
      details: { sourceType, originalPrompt: prompt, assigneeId: assignee.id },
    });
    await notifyDiscordAdmin({
      title: "Task created by assistant",
      body: draft.title.slice(0, 180),
      path: "/admin/operations?tool=tasks",
    }).catch((error: unknown) =>
      console.error("Discord assistant-task notification failed", error),
    );
    revalidatePath("/admin/operations");
    revalidatePath("/portal");
    refresh();
    return;
  }
  assertKindAccess(actor, draft.kind);
  await getDb().insert(operationsHubRecords).values({
    kind: draft.kind,
    title: draft.title.slice(0, 180),
    description: draft.description.slice(0, 4000),
    status: draft.status || "DRAFT",
    priority: draft.priority || "NORMAL",
    dueAt: draft.dueAt ? optionalDate(draft.dueAt) : null,
    sourceType,
    data: { originalPrompt: prompt },
    createdByMemberId: actor.id,
  });
  refresh();
}

function inferAdminDraft(prompt: string) {
  const lower = prompt.toLowerCase();
  const kind = lower.includes("approve")
    ? "APPROVAL"
    : lower.includes("check") || lower.includes("inspect")
      ? "PIT_CHECK"
      : lower.includes("train") || lower.includes("learn")
        ? "KNOWLEDGE_GAP"
        : lower.includes("depend") || lower.includes("blocked by")
          ? "DEPENDENCY"
          : lower.includes("fix") || lower.includes("correct")
            ? "CORRECTIVE_ACTION"
            : lower.includes("debt")
              ? "TECH_DEBT"
              : "ENGINEERING_QUESTION";
  return {
    kind,
    title: prompt.split(/[.!?\n]/)[0].slice(0, 180) || "New Team OS draft",
    description: prompt,
    status: "DRAFT",
    priority: /urgent|critical/i.test(prompt) ? "HIGH" : "NORMAL",
    dueAt: null as string | null,
  };
}

export async function memberQuickAdd(formData: FormData) {
  const actor = await requireActiveMember();
  const kind = value(formData, "quickKind", true);
  const title = value(formData, "title", true);
  const description = value(formData, "description");
  if (kind === "CONTRIBUTION") {
    await getDb()
      .insert(contributions)
      .values({
        memberId: actor.id,
        contributionDate:
          optionalDate(formData.get("occurredAt")) ?? new Date(),
        title,
        project: value(formData, "project") || "Organization",
        category: value(formData, "category") || "General",
        description,
        evidenceUrl: value(formData, "sourceUrl") || null,
      });
  } else if (kind === "NOTEBOOK_SUGGESTION" || kind === "ISSUE") {
    await getDb()
      .insert(operationsHubRecords)
      .values({
        kind,
        title,
        description,
        status: kind === "ISSUE" ? "OPEN" : "SUGGESTED",
        priority: value(formData, "priority") || "NORMAL",
        ownerMemberId: actor.id,
        seasonId: value(formData, "seasonId") || null,
        projectId: value(formData, "projectId") || null,
        subsystemId: value(formData, "subsystemId") || null,
        occurredAt: optionalDate(formData.get("occurredAt")) ?? new Date(),
        sourceUrl: value(formData, "sourceUrl") || null,
        data: { category: value(formData, "category") },
        createdByMemberId: actor.id,
      });
  } else {
    throw new Error("Unsupported quick-add type.");
  }
  refresh();
}

async function insertAlert(args: {
  title: string;
  description: string;
  fingerprint: string;
  subjectMemberId?: string | null;
  ownerMemberId?: string | null;
  dueAt?: Date | null;
  sourceType: string;
  sourceId: string;
  sourceUrl: string;
  data?: Record<string, unknown>;
}) {
  const inserted = await getDb()
    .insert(operationsHubRecords)
    .values({
      kind: "NOTIFICATION",
      title: args.title,
      description: args.description,
      status: "UNREAD",
      priority: "HIGH",
      fingerprint: args.fingerprint,
      subjectMemberId: args.subjectMemberId ?? null,
      ownerMemberId: args.ownerMemberId ?? null,
      dueAt: args.dueAt ?? null,
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      sourceUrl: args.sourceUrl,
      data: args.data ?? {},
    })
    .onConflictDoNothing()
    .returning({ id: operationsHubRecords.id });
  return inserted.length > 0;
}

export async function runOperationsAutomation() {
  const actor = await requireAdminAccess();
  if (
    !hasAnyPermission(
      actor.accessRole,
      ["tasks.manage", "inventory.manage", "notebook.manage"],
      actor.permissionOverrides,
    )
  )
    throw new Error("You do not have automation access.");
  const now = new Date();
  const staleDate = new Date(now.getTime() - 14 * 86400000);
  const [
    lowStock,
    overdue,
    staleDocs,
    approvedTasks,
    meetings,
    changes,
    media,
    failedIssues,
    activeMembers,
    openForms,
    formResponses,
    openPolls,
    pollResponses,
    pendingApprovals,
  ] = await Promise.all([
    getDb()
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.status, "ACTIVE"),
          lte(inventoryItems.quantityOnHand, inventoryItems.reorderPoint),
        ),
      ),
    getDb()
      .select()
      .from(memberTasks)
      .where(
        and(
          isNull(memberTasks.archivedAt),
          ne(memberTasks.status, "DONE"),
          lte(memberTasks.dueAt, now),
        ),
      ),
    getDb()
      .select()
      .from(docPages)
      .where(
        and(eq(docPages.status, "DRAFT"), lte(docPages.updatedAt, staleDate)),
      ),
    getDb()
      .select()
      .from(memberTasks)
      .where(
        and(eq(memberTasks.status, "DONE"), lte(memberTasks.updatedAt, now)),
      ),
    getDb().select().from(meetingNotes).where(lte(meetingNotes.heldAt, now)),
    getDb()
      .select()
      .from(designChanges)
      .where(
        or(
          eq(designChanges.status, "APPROVED"),
          eq(designChanges.status, "IMPLEMENTED"),
        ),
      ),
    getDb().select().from(mediaAssets).where(lte(mediaAssets.createdAt, now)),
    getDb()
      .select()
      .from(operationsHubRecords)
      .where(
        and(
          eq(operationsHubRecords.kind, "ISSUE"),
          or(
            eq(operationsHubRecords.status, "FAILED"),
            eq(operationsHubRecords.status, "OPEN"),
          ),
          isNull(operationsHubRecords.archivedAt),
        ),
      ),
    getDb()
      .select({ id: members.id })
      .from(members)
      .where(eq(members.status, "ACTIVE"))
      .limit(150),
    getDb()
      .select()
      .from(publicForms)
      .where(eq(publicForms.status, "OPEN"))
      .limit(20),
    getDb()
      .select({
        formId: publicFormResponses.formId,
        memberId: publicFormResponses.submittedByMemberId,
      })
      .from(publicFormResponses),
    getDb()
      .select()
      .from(availabilityPolls)
      .where(eq(availabilityPolls.status, "OPEN"))
      .limit(20),
    getDb()
      .select({
        pollId: availabilityPollResponses.pollId,
        memberId: availabilityPollResponses.submittedByMemberId,
      })
      .from(availabilityPollResponses),
    getDb()
      .select()
      .from(memberTasks)
      .where(
        and(
          isNotNull(memberTasks.completionRequestedAt),
          isNull(memberTasks.approvedAt),
          isNull(memberTasks.archivedAt),
        ),
      ),
  ]);
  for (const item of lowStock) {
    const created = await insertAlert({
      title: `Low stock: ${item.name}`,
      description: `${item.quantityOnHand} on hand; reorder point ${item.reorderPoint}.`,
      fingerprint: `low-stock:${item.id}`,
      sourceType: "inventory",
      sourceId: item.id,
      sourceUrl: "/admin/operations?tool=inventory",
      data: { sku: item.sku },
    });
    if (created)
      await getDb()
        .insert(memberTasks)
        .values({
          assignedToMemberId: actor.id,
          createdByMemberId: actor.id,
          title: `Reorder ${item.name}`,
          description: `${item.sku} is at ${item.quantityOnHand}; reorder point is ${item.reorderPoint}. Confirm need, quantity, vendor, and purchasing approval.`,
          project: "Inventory",
          priority: item.quantityOnHand === 0 ? "CRITICAL" : "HIGH",
          status: "TODO",
          dueAt: new Date(now.getTime() + 3 * 86400000),
        });
  }
  for (const task of overdue)
    await insertAlert({
      title: `Overdue: ${task.title}`,
      description: task.description,
      fingerprint: `overdue-task:${task.id}`,
      subjectMemberId: task.assignedToMemberId,
      dueAt: task.dueAt,
      sourceType: "task",
      sourceId: task.id,
      sourceUrl: "/portal?tab=tasks",
    });
  for (const page of staleDocs) {
    const created = await insertAlert({
      title: `Document review needed: ${page.title}`,
      description: "This draft has not been updated in 14 days.",
      fingerprint: `doc-review:${page.id}:${page.updatedAt.toISOString().slice(0, 10)}`,
      sourceType: "document",
      sourceId: page.id,
      sourceUrl: "/admin?tab=docs",
    });
    if (created)
      await getDb()
        .insert(memberTasks)
        .values({
          assignedToMemberId: actor.id,
          createdByMemberId: actor.id,
          title: `Review document: ${page.title}`,
          description:
            "Review this stale draft, request changes, publish it, or archive it.",
          project: "Documentation",
          priority: "NORMAL",
          status: "TODO",
          dueAt: new Date(now.getTime() + 7 * 86400000),
        });
  }
  for (const issue of failedIssues.filter((item) => item.status === "FAILED")) {
    const fp = `failed-issue-task:${issue.id}`;
    const [existing] = await getDb()
      .select({ id: operationsHubRecords.id })
      .from(operationsHubRecords)
      .where(
        and(
          eq(operationsHubRecords.kind, "NOTIFICATION"),
          eq(operationsHubRecords.fingerprint, fp),
        ),
      )
      .limit(1);
    if (existing) continue;
    await insertAlert({
      title: `Failed test needs corrective action: ${issue.title}`,
      description: issue.description,
      fingerprint: fp,
      subjectMemberId: issue.ownerMemberId ?? actor.id,
      ownerMemberId: issue.ownerMemberId ?? actor.id,
      dueAt: issue.dueAt,
      sourceType: "issue",
      sourceId: issue.id,
      sourceUrl: "/admin/control-center?tab=decisions",
    });
    await getDb()
      .insert(memberTasks)
      .values({
        assignedToMemberId: issue.ownerMemberId ?? actor.id,
        createdByMemberId: actor.id,
        title: `Correct failed test: ${issue.title}`,
        description: `${issue.description}\n\nDocument root cause, corrective action, and verification evidence in the issue tracker.`,
        project: "Engineering",
        priority: issue.priority,
        status: "TODO",
        dueAt: issue.dueAt ?? new Date(now.getTime() + 5 * 86400000),
      });
  }
  for (const member of activeMembers) {
    for (const form of openForms) {
      if (
        formResponses.some(
          (response) =>
            response.formId === form.id && response.memberId === member.id,
        )
      )
        continue;
      await insertAlert({
        title: `Form response needed: ${form.title}`,
        description: form.descriptionHtml
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
        fingerprint: `missing-form:${form.id}:${member.id}`,
        subjectMemberId: member.id,
        sourceType: "form",
        sourceId: form.id,
        sourceUrl: `/f/${form.accessKey}`,
      });
    }
    for (const poll of openPolls) {
      if (
        pollResponses.some(
          (response) =>
            response.pollId === poll.id && response.memberId === member.id,
        )
      )
        continue;
      await insertAlert({
        title: `Scheduling response needed: ${poll.title}`,
        description: poll.description,
        fingerprint: `missing-poll:${poll.id}:${member.id}`,
        subjectMemberId: member.id,
        sourceType: "poll",
        sourceId: poll.id,
        sourceUrl: `/p/${poll.accessKey}`,
      });
    }
  }
  for (const task of pendingApprovals)
    await insertAlert({
      title: `Completion approval needed: ${task.title}`,
      description: task.approvalNote || task.description,
      fingerprint: `task-approval:${task.id}`,
      ownerMemberId: task.createdByMemberId ?? actor.id,
      sourceType: "task",
      sourceId: task.id,
      sourceUrl: "/admin/operations?tool=tasks",
    });

  const suggestions = [
    ...approvedTasks.slice(0, 80).map((item) => ({
      source: "task",
      id: item.id,
      title: item.title,
      body: item.description,
      owner: item.assignedToMemberId,
    })),
    ...meetings.slice(0, 40).map((item) => ({
      source: "meeting",
      id: item.id,
      title: item.title,
      body: item.summary,
      owner: item.createdByMemberId,
    })),
    ...changes.slice(0, 40).map((item) => ({
      source: "design-change",
      id: item.id,
      title: item.title,
      body: item.description,
      owner: item.requestedByMemberId,
    })),
    ...media.slice(0, 30).map((item) => ({
      source: "media",
      id: item.id,
      title: item.alt || item.filename,
      body: item.caption,
      owner: item.uploadedByMemberId,
    })),
    ...failedIssues.slice(0, 40).map((item) => ({
      source: "test-or-issue",
      id: item.id,
      title: item.title,
      body: item.description,
      owner: item.ownerMemberId,
    })),
  ];
  for (const item of suggestions)
    await getDb()
      .insert(operationsHubRecords)
      .values({
        kind: "NOTEBOOK_SUGGESTION",
        title: item.title,
        description: item.body,
        status: "SUGGESTED",
        ownerMemberId: item.owner,
        sourceType: item.source,
        sourceId: item.id,
        fingerprint: `notebook:${item.source}:${item.id}`,
        data: { generatedAt: now.toISOString() },
      })
      .onConflictDoNothing();
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: "control.automation_run",
      entityType: "automation",
      entityId: now.toISOString(),
      details: {
        lowStock: lowStock.length,
        overdue: overdue.length,
        staleDocs: staleDocs.length,
        suggestions: suggestions.length,
      },
    });
  refresh();
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export async function logSponsorOutreach(formData: FormData) {
  const actor = await requireAdminAccess();
  assertKindAccess(actor, "SPONSOR_ENGAGEMENT");
  const id = value(formData, "id", true);
  const [record] = await getDb()
    .select()
    .from(operationsHubRecords)
    .where(
      and(
        eq(operationsHubRecords.id, id),
        eq(operationsHubRecords.kind, "SPONSOR_ENGAGEMENT"),
      ),
    )
    .limit(1);
  if (!record) throw new Error("Sponsor company not found.");
  const outcome = value(formData, "outcome") || "NO_RESPONSE";
  const contactedAt = optionalDate(formData.get("contactedAt")) ?? new Date();
  const history = Array.isArray(record.data.history)
    ? (record.data.history as Record<string, unknown>[])
    : [];
  const entry = {
    id: crypto.randomUUID(),
    contactedAt: contactedAt.toISOString(),
    channel: value(formData, "channel") || "EMAIL",
    recipient: value(formData, "recipient"),
    subject: value(formData, "subject"),
    outcome,
    notes: value(formData, "notes"),
    recordedBy: actor.id,
  };
  await getDb()
    .update(operationsHubRecords)
    .set({
      status:
        outcome === "BOUNCED"
          ? "BOUNCED"
          : outcome === "RESPONDED"
            ? "RESPONDED"
            : "WAITING",
      occurredAt: contactedAt,
      data: {
        ...record.data,
        history: [entry, ...history].slice(0, 150),
        lastContactedAt: contactedAt.toISOString(),
        responseStatus: outcome,
        bounced: outcome === "BOUNCED",
        responseReceived: outcome === "RESPONDED",
      },
      updatedAt: new Date(),
    })
    .where(eq(operationsHubRecords.id, id));
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: "control.sponsor_outreach_logged",
      entityType: "sponsor_engagement",
      entityId: id,
      details: { company: record.title, outcome },
    });
  refresh();
}

export async function researchSponsorCompanies(formData: FormData) {
  const actor = await requireAdminAccess();
  assertKindAccess(actor, "SPONSOR_PROSPECT");
  const companies = value(formData, "companies", true)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);
  const website = value(formData, "website");
  for (const company of companies) {
    const result = await discoverPublicCompanyContacts(
      company,
      companies.length === 1 ? website : undefined,
    );
    const fp = fingerprint("SPONSOR_PROSPECT", company);
    await getDb()
      .insert(operationsHubRecords)
      .values({
        kind: "SPONSOR_PROSPECT",
        title: company,
        description: "Public company contact research",
        status:
          result.emails.length || result.phones.length ? "FOUND" : "REVIEW",
        sourceType: "public-company-website",
        sourceUrl: result.website,
        fingerprint: fp,
        data: {
          website: result.website,
          contactEmails: result.emails.join(", "),
          contactPhones: result.phones.join(", "),
          researchSources: result.sources.join("\n"),
          researchedAt: result.researchedAt,
        },
        createdByMemberId: actor.id,
      })
      .onConflictDoUpdate({
        target: [operationsHubRecords.kind, operationsHubRecords.fingerprint],
        targetWhere: isNotNull(operationsHubRecords.fingerprint),
        set: {
          status:
            result.emails.length || result.phones.length ? "FOUND" : "REVIEW",
          sourceUrl: result.website,
          data: {
            website: result.website,
            contactEmails: result.emails.join(", "),
            contactPhones: result.phones.join(", "),
            researchSources: result.sources.join("\n"),
            researchedAt: result.researchedAt,
          },
          archivedAt: null,
          updatedAt: new Date(),
        },
      });
  }
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: "control.sponsor_research_completed",
      entityType: "sponsor_prospect",
      entityId: companies.join(", "),
      details: { companies: companies.length },
    });
  refresh();
}

export async function promoteSponsorProspect(formData: FormData) {
  const actor = await requireAdminAccess();
  assertKindAccess(actor, "SPONSOR_ENGAGEMENT");
  const id = value(formData, "id", true);
  const [record] = await getDb()
    .select()
    .from(operationsHubRecords)
    .where(
      and(
        eq(operationsHubRecords.id, id),
        eq(operationsHubRecords.kind, "SPONSOR_PROSPECT"),
      ),
    )
    .limit(1);
  if (!record) throw new Error("Sponsor prospect not found.");
  const fp = fingerprint("SPONSOR_ENGAGEMENT", record.title);
  await getDb()
    .insert(operationsHubRecords)
    .values({
      ...record,
      id: undefined,
      kind: "SPONSOR_ENGAGEMENT",
      status: "NEW",
      fingerprint: fp,
      createdByMemberId: actor.id,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();
  await getDb()
    .update(operationsHubRecords)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(operationsHubRecords.id, id));
  refresh();
}

export async function syncSponsorMaster() {
  const actor = await requireAdminAccess();
  if (
    !hasAnyPermission(
      actor.accessRole,
      ["sponsors.manage", "finance.manage"],
      actor.permissionOverrides,
    )
  )
    throw new Error("You do not have sponsor access.");
  const fileId =
    process.env.SPONSOR_MASTER_SHEET_ID ||
    "19wJQVwm0WEGP6r5Gqf8rMm7f8iRPO5wgChOammI9TbY";
  const tabs = [
    { name: "Organization Master", gid: "1173141948" },
    { name: "Email Log", gid: "596913059" },
    { name: "Applications", gid: "1499977661" },
    { name: "Responses & Outcomes", gid: "635647553" },
  ];
  let token: string | null = null;
  try {
    token = await getDriveAccessToken([
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
    ]);
  } catch (credentialError) {
    console.warn(
      "Authenticated sponsor sync unavailable; using link access.",
      credentialError,
    );
  }
  async function readTab(name: string, gid: string) {
    if (token) {
      const range = `'${name.replaceAll("'", "''")}'!A1:Z2000`;
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent(range)}`,
        { headers: { authorization: `Bearer ${token}` }, cache: "no-store" },
      );
      if (response.ok)
        return (
          ((await response.json()) as { values?: string[][] }).values ?? []
        );
      console.warn(
        `Sponsor tab ${name} could not be read with Sheets API (${response.status}).`,
      );
    }
    const response = await fetch(
      `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv&gid=${gid}`,
      { cache: "no-store" },
    );
    if (!response.ok)
      throw new Error(`The sponsor workbook tab “${name}” is not readable.`);
    return parseCsv(await response.text());
  }
  const tabRows = Object.fromEntries(
    await Promise.all(
      tabs.map(async (tab) => [tab.name, await readTab(tab.name, tab.gid)]),
    ),
  ) as Record<string, string[][]>;
  function objects(rows: string[][]) {
    const headerIndex = rows.findIndex((row) =>
      row.some((cell) => /company|organization/i.test(cell)),
    );
    if (headerIndex < 0) return [];
    const headers = rows[headerIndex].map((header) => header.trim());
    return rows
      .slice(headerIndex + 1)
      .map((row) =>
        Object.fromEntries(
          headers.map((header, index) => [header, row[index]?.trim() || ""]),
        ),
      );
  }
  const organizations = objects(tabRows["Organization Master"]);
  if (!organizations.length)
    throw new Error(
      "The Organization Master tab did not contain sponsor rows.",
    );
  const emailLog = objects(tabRows["Email Log"]);
  const applications = objects(tabRows.Applications);
  const outcomes = objects(tabRows["Responses & Outcomes"]);
  const normalized = (value: string) => value.trim().toLowerCase();
  const newest = (rows: Record<string, string>[], field: string) =>
    [...rows].sort(
      (a, b) =>
        (Date.parse(b[field] || "") || 0) - (Date.parse(a[field] || "") || 0),
    )[0];
  let imported = 0;
  for (const row of organizations.slice(0, 1500)) {
    const company = row.Company || row.Organization || "";
    if (!company) continue;
    const companyEmails = emailLog.filter(
      (item) => normalized(item.Company || "") === normalized(company),
    );
    const companyApplications = applications.filter(
      (item) => normalized(item.Company || "") === normalized(company),
    );
    const companyOutcomes = outcomes.filter(
      (item) => normalized(item.Company || "") === normalized(company),
    );
    const latestEmail = newest(companyEmails, "Sent Date/Time");
    const latestApplication = newest(companyApplications, "Submission Date");
    const latestOutcome = newest(companyOutcomes, "Response Date");
    const responseType = latestOutcome?.["Response Type"] || "";
    const fp = fingerprint("SPONSOR_ENGAGEMENT", company);
    const data = {
      contactEmails:
        row["Known Recipient Email(s)"] || latestEmail?.["Recipient(s)"] || "",
      verifiedEmailCount: row["Verified Email Count"] || "",
      firstVerifiedEmail: row["First Verified Email"] || "",
      latestVerifiedEmail: row["Latest Verified Email"] || "",
      driveStatus: row["Overall Status"] || "TRACKED",
      nextAction:
        row["Next Action"] || latestOutcome?.["Recommended Action"] || "",
      evidence: row["Evidence Level"] || "",
      applicationRecorded: row["Application Recorded"] || "",
      ownerNotes: row["Owner / Notes"] || "",
      outreachCount: companyEmails.length,
      lastContactedAt: latestEmail?.["Sent Date/Time"] || "",
      lastSubject: latestEmail?.Subject || "",
      lastStage: latestEmail?.Stage || "",
      responseReceived: Boolean(latestOutcome),
      responseStatus:
        responseType || (latestOutcome ? "RESPONDED" : "NO_RESPONSE"),
      bounced: /bounce/i.test(responseType),
      responseSummary: latestOutcome?.Summary || "",
      responseDate: latestOutcome?.["Response Date"] || "",
      applicationStatus: latestApplication?.["Confirmation Status"] || "",
      applicationOutcome: latestApplication?.Outcome || "",
      applicationProgram: latestApplication?.["Application / Program"] || "",
      applicationSubmittedAt: latestApplication?.["Submission Date"] || "",
      syncedAt: new Date().toISOString(),
    };
    const [existing] = await getDb()
      .select({ id: operationsHubRecords.id, data: operationsHubRecords.data })
      .from(operationsHubRecords)
      .where(
        and(
          eq(operationsHubRecords.kind, "SPONSOR_ENGAGEMENT"),
          eq(operationsHubRecords.fingerprint, fp),
        ),
      )
      .limit(1);
    if (existing) {
      await getDb()
        .update(operationsHubRecords)
        .set({
          title: company,
          description: data.ownerNotes,
          status: data.driveStatus || "TRACKED",
          sourceUrl: `https://docs.google.com/spreadsheets/d/${fileId}`,
          data: { ...existing.data, ...data },
          archivedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(operationsHubRecords.id, existing.id));
    } else {
      await getDb()
        .insert(operationsHubRecords)
        .values({
          kind: "SPONSOR_ENGAGEMENT",
          title: company,
          description: data.ownerNotes,
          status: data.driveStatus || "TRACKED",
          sourceType: "google-sheet",
          sourceId: fileId,
          sourceUrl: `https://docs.google.com/spreadsheets/d/${fileId}`,
          fingerprint: fp,
          data,
          createdByMemberId: actor.id,
        });
    }
    imported += 1;
  }
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: actor.id,
      action: "control.sponsors_synced",
      entityType: "sponsor_master",
      entityId: fileId,
      details: {
        imported,
        tabs: tabs.map((tab) => tab.name),
        emailLogRows: emailLog.length,
        applicationRows: applications.length,
        outcomeRows: outcomes.length,
      },
    });
  refresh();
}

function assertKindAccess(
  actor: Awaited<ReturnType<typeof requireAdminAccess>>,
  kind: string,
) {
  const byKind: Record<string, PermissionKey[]> = {
    RECOGNITION: ["members.edit", "tasks.manage"],
    DECISION_MATRIX: ["engineering.manage"],
    ISSUE: ["engineering.manage"],
    RACI: ["tasks.manage", "seasons.manage"],
    TEMPLATE: ["tasks.manage", "content.manage"],
    AUTOMATION: ["tasks.manage", "inventory.manage"],
    NOTIFICATION: ["tasks.manage"],
    NOTEBOOK_SUGGESTION: ["notebook.manage"],
    SPONSOR_ENGAGEMENT: ["sponsors.manage", "finance.manage"],
    SPONSOR_TEMPLATE: ["sponsors.manage", "finance.manage"],
    SPONSOR_PROSPECT: ["sponsors.manage", "finance.manage"],
    COMPETITION_EVENT: ["tasks.manage", "engineering.manage"],
    BATTERY: ["engineering.manage", "inventory.manage"],
    ROBOT_CONFIG: ["engineering.manage"],
    PIT_CHECK: ["engineering.manage", "tasks.manage"],
    ENGINEERING_QUESTION: ["engineering.manage", "notebook.manage"],
    TECH_DEBT: ["engineering.manage", "tasks.manage"],
    CORRECTIVE_ACTION: ["engineering.manage", "tasks.manage"],
    KNOWLEDGE_GAP: ["members.edit", "tasks.manage"],
    CROSS_TRAINING: ["members.edit", "tasks.manage"],
    APPROVAL: ["tasks.manage", "engineering.manage", "finance.manage"],
    DEPENDENCY: ["engineering.manage", "tasks.manage"],
    GITHUB_REPO: ["engineering.manage", "content.manage"],
    GITHUB_ACCOUNT: ["engineering.manage", "members.edit"],
    IMPACT_METRIC: ["reports.export", "content.manage"],
  };
  if (
    !hasAnyPermission(
      actor.accessRole,
      byKind[kind] ?? [],
      actor.permissionOverrides,
    )
  )
    throw new Error("You do not have access to this control-center area.");
}

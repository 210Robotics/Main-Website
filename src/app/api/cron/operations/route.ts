import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, inArray, isNull, lte, ne, or } from "drizzle-orm";
import { getDb, hasDatabase } from "@/db";
import {
  docPages,
  inventoryItems,
  members,
  memberTasks,
  operationsHubRecords,
  publicForms,
  publicFormResponses,
  availabilityPolls,
  availabilityPollResponses,
} from "@/db/schema";
import { syncAllDonationIncomeEntries } from "@/lib/donations";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasDatabase())
    return NextResponse.json(
      { error: "Database is not configured" },
      { status: 503 },
    );
  const db = getDb();
  const donationsReconciled = await syncAllDonationIncomeEntries();
  const [owner] = await db
    .select({ id: members.id })
    .from(members)
    .where(
      and(
        eq(members.status, "ACTIVE"),
        inArray(members.accessRole, [
          "SUPER_ADMIN",
          "FULL_ADMIN",
          "OFFICER",
          "DIRECTOR",
          "LEAD",
        ]),
      ),
    )
    .orderBy(asc(members.createdAt))
    .limit(1);
  if (!owner)
    return NextResponse.json(
      { error: "No active leadership account can own generated work" },
      { status: 409 },
    );
  const now = new Date();
  const staleDate = new Date(now.getTime() - 14 * 86400000);
  const [
    lowStock,
    overdue,
    staleDocs,
    failedIssues,
    completedTasks,
    activeMembers,
    openForms,
    formResponses,
    openPolls,
    pollResponses,
    pendingApprovals,
  ] = await Promise.all([
    db
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.status, "ACTIVE"),
          lte(inventoryItems.quantityOnHand, inventoryItems.reorderPoint),
        ),
      ),
    db
      .select()
      .from(memberTasks)
      .where(
        and(
          isNull(memberTasks.archivedAt),
          ne(memberTasks.status, "DONE"),
          lte(memberTasks.dueAt, now),
        ),
      ),
    db
      .select()
      .from(docPages)
      .where(
        and(eq(docPages.status, "DRAFT"), lte(docPages.updatedAt, staleDate)),
      ),
    db
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
    db
      .select()
      .from(memberTasks)
      .where(
        and(eq(memberTasks.status, "DONE"), lte(memberTasks.updatedAt, now)),
      ),
    db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.status, "ACTIVE"))
      .limit(150),
    db
      .select()
      .from(publicForms)
      .where(eq(publicForms.status, "OPEN"))
      .limit(20),
    db
      .select({
        formId: publicFormResponses.formId,
        memberId: publicFormResponses.submittedByMemberId,
      })
      .from(publicFormResponses),
    db
      .select()
      .from(availabilityPolls)
      .where(eq(availabilityPolls.status, "OPEN"))
      .limit(20),
    db
      .select({
        pollId: availabilityPollResponses.pollId,
        memberId: availabilityPollResponses.submittedByMemberId,
      })
      .from(availabilityPollResponses),
    db
      .select()
      .from(memberTasks)
      .where(
        and(
          isNull(memberTasks.approvedAt),
          isNull(memberTasks.archivedAt),
          eq(memberTasks.status, "IN_REVIEW"),
        ),
      ),
  ]);
  let tasksCreated = 0,
    remindersCreated = 0,
    suggestionsCreated = 0;
  async function alert(values: typeof operationsHubRecords.$inferInsert) {
    const rows = await db
      .insert(operationsHubRecords)
      .values(values)
      .onConflictDoNothing()
      .returning({ id: operationsHubRecords.id });
    remindersCreated += rows.length;
    return rows.length > 0;
  }
  for (const item of lowStock) {
    const created = await alert({
      kind: "NOTIFICATION",
      title: `Low stock: ${item.name}`,
      description: `${item.quantityOnHand} on hand; reorder point ${item.reorderPoint}.`,
      status: "UNREAD",
      priority: item.quantityOnHand === 0 ? "CRITICAL" : "HIGH",
      fingerprint: `low-stock:${item.id}`,
      ownerMemberId: owner.id,
      sourceType: "inventory",
      sourceId: item.id,
      sourceUrl: "/admin/operations?tool=inventory",
      data: { sku: item.sku },
    });
    if (created) {
      await db.insert(memberTasks).values({
        assignedToMemberId: owner.id,
        createdByMemberId: owner.id,
        title: `Reorder ${item.name}`,
        description: `${item.sku} is at ${item.quantityOnHand}; reorder point is ${item.reorderPoint}.`,
        project: "Inventory",
        priority: item.quantityOnHand === 0 ? "CRITICAL" : "HIGH",
        status: "TODO",
        dueAt: new Date(now.getTime() + 3 * 86400000),
      });
      tasksCreated += 1;
    }
  }
  for (const task of overdue)
    await alert({
      kind: "NOTIFICATION",
      title: `Overdue: ${task.title}`,
      description: task.description,
      status: "UNREAD",
      priority: "HIGH",
      fingerprint: `overdue-task:${task.id}`,
      subjectMemberId: task.assignedToMemberId,
      dueAt: task.dueAt,
      sourceType: "task",
      sourceId: task.id,
      sourceUrl: "/portal?tab=tasks",
    });
  for (const page of staleDocs) {
    const fingerprint = `doc-review:${page.id}:${page.updatedAt.toISOString().slice(0, 10)}`;
    const created = await alert({
      kind: "NOTIFICATION",
      title: `Document review needed: ${page.title}`,
      description: "This draft has not been updated in 14 days.",
      status: "UNREAD",
      priority: "NORMAL",
      fingerprint,
      ownerMemberId: owner.id,
      sourceType: "document",
      sourceId: page.id,
      sourceUrl: "/admin?tab=docs",
    });
    if (created) {
      await db.insert(memberTasks).values({
        assignedToMemberId: owner.id,
        createdByMemberId: owner.id,
        title: `Review document: ${page.title}`,
        description:
          "Review, publish, request changes, or archive this stale draft.",
        project: "Documentation",
        priority: "NORMAL",
        status: "TODO",
        dueAt: new Date(now.getTime() + 7 * 86400000),
      });
      tasksCreated += 1;
    }
  }
  for (const issue of failedIssues.filter((item) => item.status === "FAILED")) {
    const created = await alert({
      kind: "NOTIFICATION",
      title: `Failed test needs corrective action: ${issue.title}`,
      description: issue.description,
      status: "UNREAD",
      priority: issue.priority,
      fingerprint: `failed-issue-task:${issue.id}`,
      subjectMemberId: issue.ownerMemberId ?? owner.id,
      ownerMemberId: issue.ownerMemberId ?? owner.id,
      dueAt: issue.dueAt,
      sourceType: "issue",
      sourceId: issue.id,
      sourceUrl: "/admin/control-center?tab=decisions",
    });
    if (created) {
      await db.insert(memberTasks).values({
        assignedToMemberId: issue.ownerMemberId ?? owner.id,
        createdByMemberId: owner.id,
        title: `Correct failed test: ${issue.title}`,
        description: `${issue.description}\n\nDocument root cause, corrective action, and verification evidence.`,
        project: "Engineering",
        priority: issue.priority,
        status: "TODO",
        dueAt: issue.dueAt ?? new Date(now.getTime() + 5 * 86400000),
      });
      tasksCreated += 1;
    }
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
      await alert({
        kind: "NOTIFICATION",
        title: `Form response needed: ${form.title}`,
        description: form.descriptionHtml
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
        status: "UNREAD",
        priority: "NORMAL",
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
      await alert({
        kind: "NOTIFICATION",
        title: `Scheduling response needed: ${poll.title}`,
        description: poll.description,
        status: "UNREAD",
        priority: "NORMAL",
        fingerprint: `missing-poll:${poll.id}:${member.id}`,
        subjectMemberId: member.id,
        sourceType: "poll",
        sourceId: poll.id,
        sourceUrl: `/p/${poll.accessKey}`,
      });
    }
  }
  for (const task of pendingApprovals)
    await alert({
      kind: "NOTIFICATION",
      title: `Completion approval needed: ${task.title}`,
      description: task.approvalNote || task.description,
      status: "UNREAD",
      priority: "HIGH",
      fingerprint: `task-approval:${task.id}`,
      ownerMemberId: task.createdByMemberId ?? owner.id,
      sourceType: "task",
      sourceId: task.id,
      sourceUrl: "/admin/operations?tool=tasks",
    });
  for (const task of completedTasks.slice(0, 150)) {
    const rows = await db
      .insert(operationsHubRecords)
      .values({
        kind: "NOTEBOOK_SUGGESTION",
        title: task.title,
        description: task.description,
        status: "SUGGESTED",
        ownerMemberId: task.assignedToMemberId,
        sourceType: "task",
        sourceId: task.id,
        fingerprint: `notebook:task:${task.id}`,
        data: { generatedAt: now.toISOString() },
      })
      .onConflictDoNothing()
      .returning({ id: operationsHubRecords.id });
    suggestionsCreated += rows.length;
  }
  return NextResponse.json({
    tasksCreated,
    remindersCreated,
    suggestionsCreated,
    donationsReconciled,
    scanned: {
      lowStock: lowStock.length,
      overdue: overdue.length,
      staleDocs: staleDocs.length,
      failedIssues: failedIssues.length,
    },
  });
}

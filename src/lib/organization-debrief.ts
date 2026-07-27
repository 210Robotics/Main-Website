import "server-only";

import sanitizeHtml from "sanitize-html";
import { asc, desc, eq, isNull, ne } from "drizzle-orm";
import { getDb } from "@/db";
import {
  activityAttendance,
  availabilityPolls,
  contributions,
  designChanges,
  discordGuildMembers,
  docPages,
  donationCampaignSettings,
  donations,
  engineeringNotebookComments,
  engineeringNotebookEntries,
  engineeringParts,
  engineeringProjects,
  financeEntries,
  financePlans,
  financeSponsorCommitments,
  galleryEvents,
  glossaryTerms,
  hourEntries,
  inquiries,
  internalDocuments,
  inventoryItems,
  manufacturingSteps,
  mediaAssets,
  meetingDecisions,
  meetingNotes,
  memberTasks,
  members,
  membershipDues,
  operationsHubRecords,
  posts,
  publicForms,
  purchaseRequests,
  scoutingMatches,
  sponsors,
  teamActivities,
  timeSessions,
} from "@/db/schema";
import { getCalendarEvents } from "@/lib/calendar";
import { centsToMoney, summarizeBudget } from "@/lib/operations";

type Deadline = {
  date: Date;
  area: string;
  title: string;
  owner?: string;
  status: string;
};

export type OrganizationDebrief = {
  generatedAt: Date;
  markdown: string;
  summaryMessage: string;
  warningCount: number;
  openTaskCount: number;
  upcomingEventCount: number;
  documentCount: number;
};

function compact(value: string | null | undefined, maximum = 280) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maximum) return text;
  return `${text.slice(0, Math.max(1, maximum - 1)).trimEnd()}…`;
}

function plainText(html: string, maximum = 600) {
  const separated = html.replace(
    /<\/?(?:p|div|h[1-6]|li|tr|td|th|blockquote|br|hr)[^>]*>/gi,
    " ",
  );
  return compact(
    sanitizeHtml(separated, {
      allowedTags: [],
      allowedAttributes: {},
    }),
    maximum,
  );
}

function formatDate(value: Date | null | undefined, withTime = false) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" as const } : {}),
  }).format(value);
}

function statusLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function section(title: string, lines: string[], empty: string) {
  return [`## ${title}`, "", ...(lines.length ? lines : [`- ${empty}`]), ""];
}

function byDate(left: Deadline, right: Deadline) {
  return left.date.getTime() - right.date.getTime();
}

function isCompleteStatus(status: string) {
  return [
    "DONE",
    "COMPLETE",
    "COMPLETED",
    "CANCELED",
    "CLOSED",
    "ARCHIVED",
    "RECEIVED",
    "IMPLEMENTED",
    "APPROVED",
    "PAID",
    "WAIVED",
    "RESOLVED",
  ].includes(status.toUpperCase());
}

export async function buildOrganizationDebrief(): Promise<OrganizationDebrief> {
  const db = getDb();
  const generatedAt = new Date();
  const [
    memberRows,
    taskRows,
    planRows,
    financeRows,
    financeSponsorRows,
    donationRows,
    campaignRows,
    activityRows,
    meetingRows,
    decisionRows,
    engineeringProjectRows,
    partRows,
    manufacturingRows,
    inventoryRows,
    purchasingRows,
    changeRows,
    hubRows,
    notebookRows,
    notebookCommentRows,
    documentRows,
    formRows,
    pollRows,
    inquiryRows,
    duesRows,
    attendanceRows,
    hoursRows,
    activeClockRows,
    contributionRows,
    postRows,
    mediaRows,
    galleryRows,
    sponsorRows,
    docsRows,
    glossaryRows,
    scoutingRows,
    discordMemberRows,
    calendarRows,
  ] = await Promise.all([
    db.select().from(members).orderBy(asc(members.displayName)),
    db
      .select()
      .from(memberTasks)
      .where(isNull(memberTasks.archivedAt))
      .orderBy(asc(memberTasks.dueAt), desc(memberTasks.updatedAt)),
    db.select().from(financePlans).orderBy(desc(financePlans.fiscalYear)),
    db
      .select()
      .from(financeEntries)
      .orderBy(desc(financeEntries.occurredAt)),
    db
      .select()
      .from(financeSponsorCommitments)
      .orderBy(asc(financeSponsorCommitments.sponsorName)),
    db
      .select()
      .from(donations)
      .where(eq(donations.status, "PAID"))
      .orderBy(desc(donations.paidAt)),
    db.select().from(donationCampaignSettings),
    db
      .select()
      .from(teamActivities)
      .where(isNull(teamActivities.archivedAt))
      .orderBy(asc(teamActivities.startsAt)),
    db.select().from(meetingNotes).orderBy(desc(meetingNotes.heldAt)),
    db.select().from(meetingDecisions).orderBy(desc(meetingDecisions.createdAt)),
    db
      .select()
      .from(engineeringProjects)
      .orderBy(asc(engineeringProjects.dueAt)),
    db.select().from(engineeringParts).orderBy(asc(engineeringParts.dueAt)),
    db
      .select()
      .from(manufacturingSteps)
      .orderBy(asc(manufacturingSteps.sequence)),
    db.select().from(inventoryItems).orderBy(asc(inventoryItems.name)),
    db
      .select()
      .from(purchaseRequests)
      .orderBy(asc(purchaseRequests.neededBy)),
    db.select().from(designChanges).orderBy(desc(designChanges.updatedAt)),
    db
      .select()
      .from(operationsHubRecords)
      .where(isNull(operationsHubRecords.archivedAt))
      .orderBy(asc(operationsHubRecords.dueAt), desc(operationsHubRecords.updatedAt)),
    db
      .select()
      .from(engineeringNotebookEntries)
      .orderBy(desc(engineeringNotebookEntries.entryDate)),
    db
      .select()
      .from(engineeringNotebookComments)
      .orderBy(desc(engineeringNotebookComments.createdAt)),
    db
      .select()
      .from(internalDocuments)
      .where(isNull(internalDocuments.archivedAt))
      .orderBy(desc(internalDocuments.updatedAt)),
    db.select().from(publicForms).orderBy(desc(publicForms.updatedAt)),
    db
      .select()
      .from(availabilityPolls)
      .orderBy(desc(availabilityPolls.updatedAt)),
    db
      .select()
      .from(inquiries)
      .where(ne(inquiries.status, "CLOSED"))
      .orderBy(desc(inquiries.createdAt)),
    db.select().from(membershipDues).orderBy(asc(membershipDues.dueAt)),
    db.select().from(activityAttendance),
    db
      .select()
      .from(hourEntries)
      .where(isNull(hourEntries.deletedAt)),
    db.select().from(timeSessions).where(isNull(timeSessions.clockOut)),
    db
      .select()
      .from(contributions)
      .where(isNull(contributions.deletedAt)),
    db.select().from(posts).where(ne(posts.status, "ARCHIVED")),
    db.select().from(mediaAssets).where(isNull(mediaAssets.archivedAt)),
    db.select().from(galleryEvents).where(isNull(galleryEvents.archivedAt)),
    db.select().from(sponsors),
    db.select().from(docPages).where(ne(docPages.status, "ARCHIVED")),
    db.select().from(glossaryTerms),
    db.select().from(scoutingMatches),
    db
      .select()
      .from(discordGuildMembers)
      .where(isNull(discordGuildMembers.leftAt)),
    getCalendarEvents(),
  ]);

  const names = new Map(memberRows.map((member) => [member.id, member.displayName]));
  const planNames = new Map(planRows.map((plan) => [plan.id, plan.name]));
  const partsById = new Map(partRows.map((part) => [part.id, part]));
  const meetingsById = new Map(meetingRows.map((meeting) => [meeting.id, meeting]));
  const activeMembers = memberRows.filter((member) => member.status === "ACTIVE");
  const pendingMembers = memberRows.filter((member) => member.status === "PENDING");
  const openTasks = taskRows.filter((task) => task.status !== "DONE");
  const overdueTasks = openTasks.filter(
    (task) => task.dueAt && task.dueAt.getTime() < generatedAt.getTime(),
  );
  const blockedTasks = openTasks.filter((task) => task.status === "BLOCKED");
  const reviewTasks = openTasks.filter((task) => task.status === "IN_REVIEW");
  const unresolvedNotebookComments = notebookCommentRows.filter(
    (comment) => comment.status !== "RESOLVED",
  );
  const lowInventory = inventoryRows.filter(
    (item) =>
      item.status === "ACTIVE" &&
      item.quantityOnHand - item.quantityReserved <= item.reorderPoint,
  );
  const openPurchases = purchasingRows.filter(
    (request) => !["RECEIVED", "CANCELED"].includes(request.status),
  );
  const overduePurchases = openPurchases.filter(
    (request) =>
      request.neededBy && request.neededBy.getTime() < generatedAt.getTime(),
  );
  const unpaidDues = duesRows.filter(
    (due) => !["PAID", "WAIVED"].includes(due.status),
  );
  const overdueDues = unpaidDues.filter(
    (due) => due.dueAt && due.dueAt.getTime() < generatedAt.getTime(),
  );
  const openHubRecords = hubRows.filter(
    (record) => !isCompleteStatus(record.status),
  );
  const unlinkedDiscord = discordMemberRows.filter(
    (member) => !member.isBot && !member.linkedMemberId,
  );
  const documentSyncWarnings = documentRows.filter(
    (document) =>
      !["SYNCED", "LOCAL_ONLY"].includes(document.driveSyncStatus),
  );
  const paidDonationTotal = donationRows.reduce(
    (sum, donation) =>
      sum + Math.max(0, donation.amountCents - donation.refundedCents),
    0,
  );
  const upcomingCalendar = calendarRows
    .filter((event) => new Date(event.end).getTime() >= generatedAt.getTime())
    .sort((left, right) => left.start.localeCompare(right.start));
  const upcomingActivities = activityRows.filter(
    (activity) =>
      activity.status === "SCHEDULED" &&
      activity.endsAt.getTime() >= generatedAt.getTime(),
  );

  const deadlines: Deadline[] = [];
  for (const task of openTasks) {
    if (task.dueAt) {
      deadlines.push({
        date: task.dueAt,
        area: "Task",
        title: task.title,
        owner: names.get(task.assignedToMemberId),
        status: task.status,
      });
    }
  }
  for (const project of engineeringProjectRows) {
    if (project.dueAt && !isCompleteStatus(project.status)) {
      deadlines.push({
        date: project.dueAt,
        area: "Engineering project",
        title: project.name,
        owner: project.leadMemberId
          ? names.get(project.leadMemberId)
          : undefined,
        status: project.status,
      });
    }
  }
  for (const part of partRows) {
    if (part.dueAt && !isCompleteStatus(part.lifecycleStatus)) {
      deadlines.push({
        date: part.dueAt,
        area: "Part",
        title: `${part.partNumber} ${part.name}`,
        owner: part.assignedToMemberId
          ? names.get(part.assignedToMemberId)
          : undefined,
        status: part.lifecycleStatus,
      });
    }
  }
  for (const request of openPurchases) {
    if (request.neededBy) {
      deadlines.push({
        date: request.neededBy,
        area: "Purchase",
        title: `${request.quantity}× ${request.item}`,
        owner: names.get(request.requestedByMemberId),
        status: request.status,
      });
    }
  }
  for (const record of openHubRecords) {
    if (record.dueAt) {
      deadlines.push({
        date: record.dueAt,
        area: statusLabel(record.kind),
        title: record.title,
        owner: record.ownerMemberId
          ? names.get(record.ownerMemberId)
          : undefined,
        status: record.status,
      });
    }
  }
  for (const due of unpaidDues) {
    if (due.dueAt) {
      deadlines.push({
        date: due.dueAt,
        area: "Membership dues",
        title: `${due.period} dues`,
        owner: names.get(due.memberId),
        status: due.status,
      });
    }
  }
  deadlines.sort(byDate);

  const warnings: string[] = [];
  if (overdueTasks.length)
    warnings.push(`${overdueTasks.length} task(s) are overdue.`);
  if (blockedTasks.length)
    warnings.push(`${blockedTasks.length} task(s) are blocked.`);
  if (reviewTasks.length)
    warnings.push(`${reviewTasks.length} completed task(s) need approval.`);
  if (overduePurchases.length)
    warnings.push(`${overduePurchases.length} purchase request(s) are past needed-by dates.`);
  if (lowInventory.length)
    warnings.push(`${lowInventory.length} inventory item(s) are at or below reorder level.`);
  if (overdueDues.length)
    warnings.push(`${overdueDues.length} membership due record(s) are overdue.`);
  if (pendingMembers.length)
    warnings.push(`${pendingMembers.length} portal account(s) await approval.`);
  if (unlinkedDiscord.length)
    warnings.push(`${unlinkedDiscord.length} Discord member(s) are not linked to portal accounts.`);
  if (inquiryRows.length)
    warnings.push(`${inquiryRows.length} inquiry or sponsor contact(s) remain open.`);
  if (unresolvedNotebookComments.length)
    warnings.push(`${unresolvedNotebookComments.length} notebook review note(s) remain open.`);
  if (documentSyncWarnings.length)
    warnings.push(`${documentSyncWarnings.length} internal document(s) report Drive sync issues.`);
  if (activeClockRows.length)
    warnings.push(`${activeClockRows.length} member time clock(s) are still running.`);

  const financePlanLines = planRows.map((plan) => {
    const entries = financeRows.filter((entry) => entry.planId === plan.id);
    const commitments = financeSponsorRows.filter(
      (commitment) => commitment.planId === plan.id,
    );
    const totals = summarizeBudget(entries, commitments);
    const committed = totals.expenses + totals.planned;
    if (totals.availableCash < 0) {
      warnings.push(
        `${plan.name} has negative available cash (${centsToMoney(totals.availableCash)}).`,
      );
    }
    if (plan.maximumBudgetCents > 0 && committed > plan.maximumBudgetCents) {
      warnings.push(
        `${plan.name} commitments exceed its maximum budget by ${centsToMoney(
          committed - plan.maximumBudgetCents,
        )}.`,
      );
    }
    return (
      `- **${compact(plan.name, 100)}** (${plan.fiscalYear}, ${statusLabel(plan.status)}): ` +
      `income ${centsToMoney(totals.income)}, sponsors ${centsToMoney(
        totals.sponsorFunding,
      )}, expenses ${centsToMoney(totals.expenses)}, planned ${centsToMoney(
        totals.planned,
      )}, available cash ${centsToMoney(totals.availableCash)}, ` +
      `min/max ${centsToMoney(plan.minimumBudgetCents)} / ${centsToMoney(
        plan.maximumBudgetCents,
      )}.`
    );
  });

  const generatedLabel = formatDate(generatedAt, true);
  const markdown: string[] = [
    "# 210 Robotics Full Organization Debrief",
    "",
    `Generated manually from the live 210 Robotics portal on **${generatedLabel} CT**.`,
    "",
    `This report covers current deadlines, events, people, tasks, approvals, finances, giving, engineering, inventory, purchasing, notebook work, forms, content, Discord linkage, and internal-document intelligence.`,
    "",
    ...section(
      "Executive warnings",
      warnings.map((warning) => `- ⚠️ ${warning}`),
      "No automatic warning conditions were detected.",
    ),
    ...section(
      "All active organization deadlines",
      deadlines.map(
        (deadline) =>
          `- **${formatDate(deadline.date, true)}** — ${deadline.area}: ${compact(
            deadline.title,
            160,
          )} · ${statusLabel(deadline.status)}${
            deadline.owner ? ` · Owner: ${deadline.owner}` : ""
          }`,
      ),
      "No active records currently have deadlines.",
    ),
    ...section(
      "Upcoming events and calendar",
      upcomingCalendar.map(
        (event) =>
          `- **${formatDate(new Date(event.start), !event.allDay)}** — ${compact(
            event.title,
            170,
          )}${event.location ? ` · ${compact(event.location, 100)}` : ""}`,
      ),
      "No upcoming events were found in the connected calendar.",
    ),
    ...section(
      "Portal activities and attendance",
      [
        ...upcomingActivities.map(
          (activity) =>
            `- **${formatDate(activity.startsAt, true)}** — ${activity.title} (${statusLabel(
              activity.type,
            )}) · ${activity.location || "Location pending"}`,
        ),
        `- Attendance records stored: ${attendanceRows.length}.`,
        `- Logged team hours: ${(
          hoursRows.reduce((sum, row) => sum + row.minutes, 0) / 60
        ).toFixed(1)} across ${hoursRows.length} entries.`,
        `- Contribution portfolio entries: ${contributionRows.length}.`,
      ],
      "No activities or attendance records are stored.",
    ),
    ...section(
      "Tasks and approval workflow",
      [
        `- Open: ${openTasks.length}; overdue: ${overdueTasks.length}; blocked: ${blockedTasks.length}; awaiting approval: ${reviewTasks.length}; completed: ${
          taskRows.filter((task) => task.status === "DONE").length
        }.`,
        ...openTasks.map(
          (task) =>
            `- **[${statusLabel(task.status)} / ${statusLabel(
              task.priority,
            )}] ${compact(task.title, 160)}** · ${names.get(
              task.assignedToMemberId,
            ) || "Unknown assignee"} · ${
              task.dueAt ? `Due ${formatDate(task.dueAt, true)}` : "No deadline"
            } · ${compact(task.description, 220) || "No description"}`,
        ),
      ],
      "No open tasks.",
    ),
    ...section(
      "Operations and leadership records",
      openHubRecords.map(
        (record) =>
          `- **${statusLabel(record.kind)} — ${compact(record.title, 150)}** · ${statusLabel(
            record.status,
          )}/${statusLabel(record.priority)}${
            record.ownerMemberId
              ? ` · Owner: ${names.get(record.ownerMemberId) || "Unknown"}`
              : ""
          }${record.dueAt ? ` · Due ${formatDate(record.dueAt, true)}` : ""} · ${
            compact(record.description, 240) || "No description"
          }`,
      ),
      "No active leadership, risk, issue, approval, automation, or control-center records.",
    ),
    ...section(
      "Meetings and decisions",
      [
        ...meetingRows.map(
          (meeting) =>
            `- **${formatDate(meeting.heldAt)} — ${compact(
              meeting.title,
              150,
            )}** (${statusLabel(meeting.status)}) · ${
              compact(meeting.summary, 300) || "No summary"
            }${
              meeting.nextMeeting
                ? ` · Next: ${compact(meeting.nextMeeting, 120)}`
                : ""
            }`,
        ),
        ...decisionRows.map((decision) => {
          const meeting = meetingsById.get(decision.meetingId);
          return `- Decision${meeting ? ` from ${meeting.title}` : ""}: ${compact(
            decision.decision,
            260,
          )}${decision.impact ? ` · Impact: ${compact(decision.impact, 180)}` : ""}`;
        }),
      ],
      "No meeting notes or decisions are stored.",
    ),
    ...section(
      "Finance plan summary",
      financePlanLines,
      "No finance plans are stored.",
    ),
    ...section(
      "All finance entries",
      financeRows.map(
        (entry) =>
          `- **${formatDate(entry.occurredAt)} — ${statusLabel(
            entry.kind,
          )}: ${compact(entry.description, 150)}** · ${centsToMoney(
            entry.amountCents,
          )} · ${statusLabel(entry.status)} · ${
            entry.planId ? planNames.get(entry.planId) || "Unknown plan" : "No plan"
          }${entry.vendor ? ` · ${compact(entry.vendor, 100)}` : ""}`,
      ),
      "No finance entries are stored.",
    ),
    ...section(
      "Sponsors, donations, and membership dues",
      [
        `- Paid donations: ${donationRows.length}, net total ${centsToMoney(
          paidDonationTotal,
        )}${
          campaignRows[0]
            ? ` toward a ${centsToMoney(campaignRows[0].goalCents)} goal`
            : ""
        }.`,
        ...donationRows.map(
          (donation) =>
            `- Donation: ${donation.donorName || "Anonymous"} · ${centsToMoney(
              Math.max(0, donation.amountCents - donation.refundedCents),
            )} · ${formatDate(donation.paidAt || donation.createdAt)}${
              donation.attributedMemberId
                ? ` · Credited to ${
                    names.get(donation.attributedMemberId) || "Former member"
                  }`
                : ""
            }`,
        ),
        ...financeSponsorRows.map(
          (commitment) =>
            `- Sponsor commitment: **${compact(
              commitment.sponsorName,
              120,
            )}** · ${centsToMoney(commitment.amountCents)} · ${statusLabel(
              commitment.status,
            )}${commitment.restrictions ? ` · ${compact(commitment.restrictions, 180)}` : ""}`,
        ),
        ...unpaidDues.map(
          (due) =>
            `- Dues: ${names.get(due.memberId) || "Unknown member"} · ${due.period} · ${centsToMoney(
              due.amountPaidCents,
            )} / ${centsToMoney(due.amountDueCents)} paid · ${statusLabel(
              due.status,
            )}${due.dueAt ? ` · Due ${formatDate(due.dueAt)}` : ""}`,
        ),
        `- Public sponsor directory records: ${sponsorRows.length}.`,
      ],
      "No giving, sponsor, or membership-dues records are stored.",
    ),
    ...section(
      "Engineering projects and parts",
      [
        ...engineeringProjectRows.map(
          (project) =>
            `- Project **${compact(project.name, 150)}** (${project.code}) · ${statusLabel(
              project.status,
            )}${project.leadMemberId ? ` · Lead: ${names.get(project.leadMemberId) || "Unknown"}` : ""}${
              project.dueAt ? ` · Due ${formatDate(project.dueAt)}` : ""
            } · ${compact(project.description, 220) || "No description"}`,
        ),
        ...partRows.map(
          (part) =>
            `- Part **${part.partNumber} — ${compact(part.name, 130)}** · Qty ${
              part.quantity
            } · ${part.subsystem} · ${statusLabel(
              part.lifecycleStatus,
            )} · CAD ${statusLabel(part.cadStatus)}, drawing ${statusLabel(
              part.drawingStatus,
            )}, verification ${statusLabel(part.verificationStatus)}${
              part.dueAt ? ` · Due ${formatDate(part.dueAt)}` : ""
            }`,
        ),
      ],
      "No engineering projects or parts are stored.",
    ),
    ...section(
      "Manufacturing, inventory, and purchasing",
      [
        ...manufacturingRows
          .filter((step) => !isCompleteStatus(step.status))
          .map((step) => {
            const part = partsById.get(step.partId);
            return `- Manufacturing: ${
              part ? `${part.partNumber} ${part.name}` : "Unknown part"
            } · Step ${step.sequence} ${compact(step.process, 100)} · ${statusLabel(
              step.status,
            )}${
              step.assignedToMemberId
                ? ` · ${names.get(step.assignedToMemberId) || "Unknown assignee"}`
                : ""
            }`;
          }),
        ...inventoryRows.map(
          (item) =>
            `- Inventory: **${item.sku} — ${compact(
              item.name,
              120,
            )}** · ${item.quantityOnHand} on hand, ${item.quantityReserved} reserved, reorder at ${
              item.reorderPoint
            } · ${item.location} · ${statusLabel(item.status)}`,
        ),
        ...openPurchases.map(
          (request) =>
            `- Purchase: **${request.quantity}× ${compact(
              request.item,
              140,
            )}** · ${centsToMoney(
              request.quantity * request.estimatedUnitCostCents,
            )} estimated · ${statusLabel(request.status)}/${statusLabel(
              request.priority,
            )}${request.neededBy ? ` · Needed ${formatDate(request.neededBy)}` : ""}${
              request.vendor ? ` · ${compact(request.vendor, 100)}` : ""
            }`,
        ),
      ],
      "No manufacturing, inventory, or purchasing records are stored.",
    ),
    ...section(
      "Design-change control",
      changeRows.map(
        (change) =>
          `- **${change.changeNumber} — ${compact(change.title, 150)}** · ${statusLabel(
            change.status,
          )}/${statusLabel(change.risk)} risk · cost impact ${centsToMoney(
            change.costImpactCents,
          )} · schedule impact ${change.scheduleImpactDays} day(s) · ${compact(
            change.reason,
            220,
          )}`,
      ),
      "No design changes are stored.",
    ),
    ...section(
      "Engineering notebook and scouting",
      [
        ...notebookRows.map(
          (entry) =>
            `- Notebook: **${formatDate(entry.entryDate)} — ${compact(
              entry.title,
              150,
            )}** · ${statusLabel(entry.entryType)}/${statusLabel(
              entry.status,
            )} · v${entry.currentVersion} · ${
              compact(entry.nextSteps, 240) || "No next steps"
            }`,
        ),
        ...unresolvedNotebookComments.map(
          (comment) =>
            `- Open notebook ${statusLabel(comment.kind)}: ${compact(
              comment.body,
              260,
            )} · ${names.get(comment.memberId) || "Unknown reviewer"}`,
        ),
        `- Scouting match records: ${scoutingRows.length}.`,
      ],
      "No notebook or scouting records are stored.",
    ),
    ...section(
      "Members, accounts, and Discord linkage",
      [
        `- Portal accounts: ${memberRows.length} total; ${activeMembers.length} active; ${pendingMembers.length} pending; ${
          memberRows.filter((member) => member.status === "SUSPENDED").length
        } suspended.`,
        `- Discord members: ${
          discordMemberRows.filter((member) => !member.isBot).length
        } human; ${unlinkedDiscord.length} not linked to a portal account.`,
        ...pendingMembers.map(
          (member) =>
            `- Pending portal account: ${member.displayName} · ${member.organizationRole} · created ${formatDate(
              member.createdAt,
            )}.`,
        ),
        ...unlinkedDiscord.map(
          (member) =>
            `- Unlinked Discord member: ${member.displayName} (@${member.username}).`,
        ),
        ...activeClockRows.map(
          (clock) =>
            `- Active time clock: ${names.get(clock.memberId) || "Unknown member"} · since ${formatDate(
              clock.clockIn,
              true,
            )} · ${clock.project}/${clock.category}.`,
        ),
      ],
      "No member or Discord-account records are stored.",
    ),
    ...section(
      "Forms, scheduling polls, and inbox",
      [
        ...formRows.map(
          (form) =>
            `- Form: **${compact(form.title, 150)}** · ${form.status} · ${form.responseCount} response(s) · updated ${formatDate(
              form.updatedAt,
            )}.`,
        ),
        ...pollRows.map(
          (poll) =>
            `- Poll: **${compact(poll.title, 150)}** · ${poll.status} · ${poll.responseCount} response(s) · ${
              poll.dates.length
            } date option(s), ${poll.startTime}–${poll.endTime} ${poll.timezone}.`,
        ),
        ...inquiryRows.map(
          (inquiry) =>
            `- Inbox: **${statusLabel(inquiry.kind)} from ${compact(
              inquiry.name,
              100,
            )}${inquiry.organization ? ` / ${compact(inquiry.organization, 100)}` : ""}** · ${statusLabel(
              inquiry.status,
            )} · ${formatDate(inquiry.createdAt)} · ${compact(inquiry.message, 260)}`,
        ),
      ],
      "No forms, polls, or open inbox records.",
    ),
    ...section(
      "Internal-document intelligence",
      [
        `- ${documentRows.length} active internal document(s) were reviewed for this debrief.`,
        ...documentRows.map((document) => {
          const description = compact(document.description, 240);
          const extracted = plainText(document.contentHtml, 700);
          return (
            `- **${compact(document.title, 160)}** · ${document.category} · v${document.currentVersion} · ` +
            `${statusLabel(document.driveSyncStatus)} · updated ${formatDate(
              document.updatedAt,
            )}${description ? ` · ${description}` : ""} · Extracted content: ${
              extracted || "No readable text was extracted; review the original file."
            }`
          );
        }),
      ],
      "No active internal documents are stored.",
    ),
    ...section(
      "Website content and knowledge base",
      [
        `- News posts: ${postRows.length} active/draft; ${postRows.filter((post) => post.status === "DRAFT").length} draft.`,
        `- Documentation pages: ${docsRows.length}.`,
        `- Glossary terms: ${glossaryRows.length}.`,
        `- Media assets: ${mediaRows.length}; gallery events: ${galleryRows.length}.`,
      ],
      "No content records are stored.",
    ),
    "## Portal links",
    "",
    "- Admin overview: https://210robotics.com/admin",
    "- Operations: https://210robotics.com/admin/operations",
    "- Internal documents: https://210robotics.com/admin?tab=documents",
    "- Discord management: https://210robotics.com/admin?tab=discord",
    "",
    "_Generated from the live portal database and connected 210 Robotics calendar. Internal-document entries use stored extracted text; original files remain the authoritative source._",
    "",
  ];

  const topWarnings = warnings.slice(0, 8);
  const summaryMessage = [
    "📋 **210 Robotics Full Organization Debrief**",
    `Generated ${generatedLabel} CT from the live portal and connected calendar.`,
    "",
    `**At a glance:** ${warnings.length} warning(s) · ${openTasks.length} open task(s) · ${deadlines.length} active deadline(s) · ${upcomingCalendar.length} upcoming event(s) · ${documentRows.length} internal document(s) reviewed · ${centsToMoney(
      paidDonationTotal,
    )} in paid donations.`,
    "",
    "**Priority warnings**",
    ...(topWarnings.length
      ? topWarnings.map((warning) => `• ${warning}`)
      : ["• No automatic warning conditions were detected."]),
    "",
    "The attached Markdown file contains the complete organization-wide debrief, including all current finance entries, deadlines, tasks, operational records, engineering work, and extracted internal-document intelligence.",
  ]
    .join("\n")
    .slice(0, 1_900);

  return {
    generatedAt,
    markdown: markdown.join("\n"),
    summaryMessage,
    warningCount: warnings.length,
    openTaskCount: openTasks.length,
    upcomingEventCount: upcomingCalendar.length,
    documentCount: documentRows.length,
  };
}

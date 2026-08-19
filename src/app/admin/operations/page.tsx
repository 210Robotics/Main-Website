/* eslint-disable @next/next/no-html-link-for-pages */
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { asc, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import {
  activityAttendance,
  engineeringParts,
  engineeringSeasons,
  engineeringProjects,
  engineeringSubsystems,
  engineeringNotebookEntries,
  engineeringNotebookVersions,
  engineeringNotebookComments,
  engineeringNotebookCompilations,
  scoutingMatches,
  inventoryItems,
  purchaseRequests,
  designChanges,
  donationCampaignSettings,
  donations,
  financeEntries,
  financePlans,
  financeSponsorCommitments,
  glossaryTerms,
  manufacturingSteps,
  meetingDecisions,
  meetingNotes,
  members,
  memberTasks,
  taskComments,
  teamActivities,
} from "@/db/schema";
import { requireAdminAccess } from "@/lib/auth";
import { hasPermission, type PermissionKey } from "@/lib/permissions";
import { DashboardNavigation } from "@/components/dashboard-navigation";
import { ActionForm } from "@/components/action-form";
import { ImportActionForm } from "@/components/import-action-form";
import { QuantityStepper } from "@/components/quantity-stepper";
import { CalendarInput } from "@/components/calendar-input";
import { ImageUpload } from "@/components/image-upload";
import { OnshapeBomImporter } from "@/components/onshape-bom-importer";
import {
  DesignChangesWorkspace,
  InventoryWorkspace,
  NotebookWorkspace,
  PurchasingWorkspace,
  ScoutingAdminWorkspace,
  SharedEngineeringModelWorkspace,
} from "@/components/engineering-operations-workspaces";
import {
  archiveTask,
  deleteEngineeringPart,
  deleteFinanceEntry,
  deleteFinancePlan,
  deleteGlossaryTerm,
  deleteManufacturingStep,
  deleteMeeting,
  deleteMeetingDecision,
  deleteSponsorCommitment,
  importFinanceSpreadsheet,
  saveEngineeringPart,
  saveDonationCampaign,
  saveDonationAttribution,
  saveFinanceEntry,
  saveFinancePlan,
  saveGlossaryTerm,
  saveManufacturingStep,
  saveMeeting,
  saveMeetingDecision,
  saveSponsorCommitment,
  saveTask,
  reviewTaskCompletion,
} from "./actions";
import {
  centsToMoney,
  displayStatus,
  financeEntryKinds,
  financeEntryStatuses,
  sponsorStatuses,
  summarizeBudget,
  taskPriorities,
  taskStatuses,
  verificationStatuses,
  workStatuses,
} from "@/lib/operations";
import { financeCategories } from "@/lib/engineering-operations";
import {
  getDonationCampaign,
  getDonationSummary,
  getRecentDonations,
  type DonationSummary,
} from "@/lib/donations";
import { donationProgress } from "@/lib/donation-math";
import {
  getStripeBalanceSnapshot,
  type StripeBalanceSnapshot,
} from "@/lib/stripe";
import {
  normalizeOperationTool,
  operationsLoadPlan,
} from "@/lib/workspace-loading";
import { getWebsitePageContent } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Operations | Admin",
  robots: { index: false, follow: false },
};

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tool?: string; entry?: string }>;
}) {
  const actor = await requireAdminAccess();
  const resolvedSearchParams = await searchParams;
  const tool = normalizeOperationTool(resolvedSearchParams.tool);
  const load = operationsLoadPlan(tool);
  const can = (permission: PermissionKey) =>
    hasPermission(actor.accessRole, permission, actor.permissionOverrides);
  const permissions = {
    tasks: can("tasks.manage"),
    meetings: can("meetings.manage"),
    finance: can("finance.manage"),
    structure: can("seasons.manage"),
    notebook: can("notebook.view"),
    notebookEdit: can("notebook.manage"),
    scouting: can("scouting.manage"),
    engineering: can("engineering.manage"),
    inventory: can("inventory.manage"),
    purchasing: can("purchasing.manage"),
    changes: can("design_changes.manage"),
    glossary: can("glossary.manage"),
  };
  const db = getDb();
  const [
    memberRows,
    activityRows,
    taskRows,
    commentRows,
    meetingRows,
    decisionRows,
    attendanceRows,
    planRows,
    entryRows,
    sponsorRows,
    partRows,
    stepRows,
    glossaryRows,
    seasonRows,
    engineeringProjectRows,
    subsystemRows,
    notebookRows,
    notebookVersionRows,
    notebookCommentRows,
    notebookCompilationRows,
    scoutingRows,
    inventoryRows,
    purchaseRows,
    designChangeRows,
  ] = await Promise.all([
    load.members
      ? db
      .select({
        id: members.id,
        name: members.displayName,
        role: members.organizationRole,
      })
      .from(members)
      .where(eq(members.status, "ACTIVE"))
      .orderBy(asc(members.displayName))
      : Promise.resolve([]),
    load.activities && permissions.meetings
      ? db
          .select()
          .from(teamActivities)
          .orderBy(desc(teamActivities.startsAt))
          .limit(100)
      : Promise.resolve([]),
    load.tasks && permissions.tasks
      ? db
          .select()
          .from(memberTasks)
          .where(isNull(memberTasks.archivedAt))
          .orderBy(desc(memberTasks.createdAt))
      : Promise.resolve([]),
    load.taskComments && permissions.tasks
      ? db.select().from(taskComments).orderBy(asc(taskComments.createdAt))
      : Promise.resolve([]),
    load.meetings && permissions.meetings
      ? db.select().from(meetingNotes).orderBy(desc(meetingNotes.heldAt))
      : Promise.resolve([]),
    load.meetingDetails && permissions.meetings
      ? db
          .select()
          .from(meetingDecisions)
          .orderBy(asc(meetingDecisions.createdAt))
      : Promise.resolve([]),
    load.meetingDetails && permissions.meetings
      ? db
          .select()
          .from(activityAttendance)
          .where(eq(activityAttendance.status, "PRESENT"))
      : Promise.resolve([]),
    load.financePlans && (permissions.finance || permissions.purchasing)
      ? db
          .select()
          .from(financePlans)
          .orderBy(desc(financePlans.fiscalYear), asc(financePlans.name))
      : Promise.resolve([]),
    load.financeEntries && permissions.finance
      ? db
          .select()
          .from(financeEntries)
          .orderBy(desc(financeEntries.occurredAt))
      : Promise.resolve([]),
    load.financeSponsors && permissions.finance
      ? db
          .select()
          .from(financeSponsorCommitments)
          .orderBy(desc(financeSponsorCommitments.createdAt))
      : Promise.resolve([]),
    load.parts && (permissions.engineering || permissions.inventory || permissions.changes)
      ? db
          .select()
          .from(engineeringParts)
          .orderBy(
            asc(engineeringParts.project),
            asc(engineeringParts.partNumber),
          )
      : Promise.resolve([]),
    load.manufacturing && permissions.engineering
      ? db
          .select()
          .from(manufacturingSteps)
          .orderBy(asc(manufacturingSteps.sequence))
      : Promise.resolve([]),
    load.glossary && permissions.glossary
      ? db.select().from(glossaryTerms).orderBy(asc(glossaryTerms.term))
      : Promise.resolve([]),
    load.seasons &&
    (permissions.structure ||
      permissions.notebook ||
      permissions.engineering ||
      permissions.inventory ||
      permissions.purchasing ||
      permissions.changes ||
      permissions.scouting ||
      permissions.finance)
      ? db
          .select()
          .from(engineeringSeasons)
          .orderBy(desc(engineeringSeasons.isDefault), desc(engineeringSeasons.startsAt))
      : Promise.resolve([]),
    load.projects &&
    (permissions.structure ||
      permissions.notebook ||
      permissions.engineering ||
      permissions.inventory ||
      permissions.purchasing ||
      permissions.changes ||
      permissions.finance)
      ? db.select().from(engineeringProjects).orderBy(asc(engineeringProjects.code))
      : Promise.resolve([]),
    load.subsystems &&
    (permissions.structure ||
      permissions.notebook ||
      permissions.engineering ||
      permissions.inventory ||
      permissions.purchasing ||
      permissions.changes)
      ? db.select().from(engineeringSubsystems).orderBy(asc(engineeringSubsystems.code))
      : Promise.resolve([]),
    load.notebook && permissions.notebook
      ? db
          .select()
          .from(engineeringNotebookEntries)
          .orderBy(
            asc(engineeringNotebookEntries.sortOrder),
            asc(engineeringNotebookEntries.entryDate),
          )
      : Promise.resolve([]),
    load.notebook && permissions.notebook
      ? db.select().from(engineeringNotebookVersions).orderBy(desc(engineeringNotebookVersions.createdAt))
      : Promise.resolve([]),
    load.notebook && permissions.notebook
      ? db.select().from(engineeringNotebookComments).orderBy(desc(engineeringNotebookComments.createdAt))
      : Promise.resolve([]),
    load.notebook && permissions.notebook
      ? db.select().from(engineeringNotebookCompilations).orderBy(desc(engineeringNotebookCompilations.createdAt)).limit(50)
      : Promise.resolve([]),
    load.scouting && permissions.scouting
      ? db.select().from(scoutingMatches).orderBy(desc(scoutingMatches.createdAt))
      : Promise.resolve([]),
    load.inventory && (permissions.inventory || permissions.purchasing)
      ? db.select().from(inventoryItems).orderBy(asc(inventoryItems.name))
      : Promise.resolve([]),
    load.purchasing && permissions.purchasing
      ? db.select().from(purchaseRequests).orderBy(desc(purchaseRequests.createdAt))
      : Promise.resolve([]),
    load.designChanges && permissions.changes
      ? db.select().from(designChanges).orderBy(desc(designChanges.updatedAt))
      : Promise.resolve([]),
  ]);
  const [
    donationCampaign,
    donationSummary,
    recentDonationRows,
    stripeBalance,
    donationPageContent,
  ] =
    load.financeEntries && permissions.finance
      ? await Promise.all([
          getDonationCampaign(),
          getDonationSummary(),
          getRecentDonations(250),
          getStripeBalanceSnapshot(),
          getWebsitePageContent("donate"),
        ])
      : [null, null, [], null, null];
  const nameById = new Map(
    memberRows.map((member) => [member.id, member.name]),
  );
  const allowedItems = [
    { value: "overview", label: "Overview", href: "/admin/operations" },
    ...(permissions.tasks
      ? [
          {
            value: "tasks",
            label: "Tasks",
            href: "/admin/operations?tool=tasks",
          },
        ]
      : []),
    ...(permissions.meetings
      ? [
          {
            value: "meetings",
            label: "Meetings",
            href: "/admin/operations?tool=meetings",
          },
        ]
      : []),
    ...(permissions.finance
      ? [
          {
            value: "finance",
            label: "Finance",
            href: "/admin/operations?tool=finance",
          },
        ]
      : []),
    ...(permissions.structure
      ? [
          {
            value: "structure",
            label: "Seasons & projects",
            href: "/admin/operations?tool=structure",
          },
        ]
      : []),
    ...(permissions.notebook
      ? [
          {
            value: "notebook",
            label: "Notebook",
            href: "/admin/operations?tool=notebook",
          },
        ]
      : []),
    ...(permissions.scouting
      ? [
          {
            value: "scouting",
            label: "Scouting",
            href: "/admin/operations?tool=scouting",
          },
        ]
      : []),
    ...(permissions.engineering
      ? [
          {
            value: "engineering",
            label: "Engineering",
            href: "/admin/operations?tool=engineering",
          },
        ]
      : []),
    ...(permissions.inventory
      ? [
          {
            value: "inventory",
            label: "Inventory",
            href: "/admin/operations?tool=inventory",
          },
        ]
      : []),
    ...(permissions.purchasing
      ? [
          {
            value: "purchasing",
            label: "Purchasing",
            href: "/admin/operations?tool=purchasing",
          },
        ]
      : []),
    ...(permissions.changes
      ? [
          {
            value: "changes",
            label: "Design changes",
            href: "/admin/operations?tool=changes",
          },
        ]
      : []),
    ...(permissions.glossary
      ? [
          {
            value: "glossary",
            label: "Glossary",
            href: "/admin/operations?tool=glossary",
          },
        ]
      : []),
  ];

  return (
    <main className="min-h-screen bg-[#090909] grid-bg">
      <div className="shell admin-workspace py-8 md:py-12">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow">Operations workspace</p>
            <h1 className="mt-3 text-4xl font-bold tracking-[-.04em] md:text-5xl">
              Run the team from one place.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[#aaa]">
              Turn meetings into owned work, manage budgets and sponsor funding,
              publish shared terminology, and carry robot parts from design
              through verified manufacturing.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="button" href="/admin/control-center">
              Leadership control center
            </Link>
            <Link className="button secondary" href="/portal">
              Member portal
            </Link>
            <Link className="button secondary" href="/admin">
              Admin home
            </Link>
          </div>
        </div>
        <DashboardNavigation
          current={tool}
          label="Operations tools"
          items={allowedItems}
        />

        {tool === "overview" && (
          <Overview
            permissions={permissions}
            tasks={taskRows}
            meetings={meetingRows}
            plans={planRows}
            entries={entryRows}
            parts={partRows}
            glossary={glossaryRows}
          />
        )}
        {tool === "tasks" && permissions.tasks && (
          <TasksWorkspace
            tasks={taskRows}
            comments={commentRows}
            members={memberRows}
            meetings={meetingRows}
            nameById={nameById}
          />
        )}
        {tool === "meetings" && permissions.meetings && (
          <MeetingsWorkspace
            meetings={meetingRows}
            decisions={decisionRows}
            activities={activityRows}
            attendance={attendanceRows}
            tasks={taskRows}
            members={memberRows}
            nameById={nameById}
          />
        )}
        {tool === "finance" && permissions.finance && (
          <FinanceWorkspace
            plans={planRows}
            entries={entryRows}
            sponsors={sponsorRows}
            seasons={seasonRows}
            projects={engineeringProjectRows}
            donationCampaign={donationCampaign}
            donationSummary={donationSummary}
            recentDonations={recentDonationRows}
            stripeBalance={stripeBalance}
            members={memberRows}
            uploaderId={actor.id}
            donationPageContent={donationPageContent}
          />
        )}
        {tool === "structure" && permissions.structure && (
          <SharedEngineeringModelWorkspace
            seasons={seasonRows}
            projects={engineeringProjectRows}
            subsystems={subsystemRows}
            members={memberRows}
          />
        )}
        {tool === "notebook" && permissions.notebook && (
          <NotebookWorkspace
            seasons={seasonRows}
            projects={engineeringProjectRows}
            subsystems={subsystemRows}
            entries={notebookRows}
            versions={notebookVersionRows}
            comments={notebookCommentRows}
            compilations={notebookCompilationRows}
            nameById={nameById}
            canEdit={permissions.notebookEdit}
            uploaderId={actor.id}
            selectedEntryId={resolvedSearchParams.entry}
          />
        )}
        {tool === "scouting" && permissions.scouting && (
          <ScoutingAdminWorkspace records={scoutingRows} />
        )}
        {tool === "engineering" && permissions.engineering && (
          <EngineeringWorkspace
            parts={partRows}
            steps={stepRows}
            members={memberRows}
            nameById={nameById}
            seasons={seasonRows}
            projects={engineeringProjectRows}
            subsystems={subsystemRows}
          />
        )}
        {tool === "inventory" && permissions.inventory && (
          <InventoryWorkspace
            items={inventoryRows}
            seasons={seasonRows}
            projects={engineeringProjectRows}
            subsystems={subsystemRows}
            parts={partRows}
          />
        )}
        {tool === "purchasing" && permissions.purchasing && (
          <PurchasingWorkspace
            requests={purchaseRows}
            seasons={seasonRows}
            projects={engineeringProjectRows}
            subsystems={subsystemRows}
            inventory={inventoryRows}
            plans={planRows}
            nameById={nameById}
          />
        )}
        {tool === "changes" && permissions.changes && (
          <DesignChangesWorkspace
            changes={designChangeRows}
            seasons={seasonRows}
            projects={engineeringProjectRows}
            subsystems={subsystemRows}
            parts={partRows}
            nameById={nameById}
          />
        )}
        {tool === "glossary" && permissions.glossary && (
          <GlossaryWorkspace terms={glossaryRows} />
        )}
        {tool !== "overview" &&
          !permissions[tool as keyof typeof permissions] && (
            <EmptyState
              title="Permission required"
              body="Your role does not include access to this operations tool."
            />
          )}
      </div>
    </main>
  );
}

type RowMap = {
  tasks: typeof memberTasks.$inferSelect;
  comments: typeof taskComments.$inferSelect;
  meetings: typeof meetingNotes.$inferSelect;
  decisions: typeof meetingDecisions.$inferSelect;
  plans: typeof financePlans.$inferSelect;
  entries: typeof financeEntries.$inferSelect;
  sponsors: typeof financeSponsorCommitments.$inferSelect;
  donationCampaign: typeof donationCampaignSettings.$inferSelect;
  donation: typeof donations.$inferSelect;
  parts: typeof engineeringParts.$inferSelect;
  steps: typeof manufacturingSteps.$inferSelect;
  glossary: typeof glossaryTerms.$inferSelect;
  activities: typeof teamActivities.$inferSelect;
  attendance: typeof activityAttendance.$inferSelect;
};
type Row<T extends keyof RowMap> = RowMap[T];
type Person = { id: string; name: string; role: string };

function Overview({
  permissions,
  tasks,
  meetings,
  plans,
  entries,
  parts,
  glossary,
}: {
  permissions: Record<string, boolean>;
  tasks: Row<"tasks">[];
  meetings: Row<"meetings">[];
  plans: Row<"plans">[];
  entries: Row<"entries">[];
  parts: Row<"parts">[];
  glossary: Row<"glossary">[];
}) {
  const openTasks = tasks.filter((task) => task.status !== "DONE").length;
  const expenses = entries
    .filter((entry) => entry.kind === "EXPENSE" && entry.status !== "CANCELED")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const needsReview = parts.filter(
    (part) => !["APPROVED", "NOT_REQUIRED"].includes(part.verificationStatus),
  ).length;
  const cards = [
    {
      permission: "tasks",
      href: "/admin/operations?tool=tasks",
      value: String(openTasks),
      label: "Open assignments",
      text: "Assign owners, deadlines, deliverables, and review work.",
    },
    {
      permission: "meetings",
      href: "/admin/operations?tool=meetings",
      value: String(meetings.length),
      label: "Meeting records",
      text: "Capture decisions and convert the next actions into tasks.",
    },
    {
      permission: "finance",
      href: "/admin/operations?tool=finance",
      value: centsToMoney(expenses),
      label: "Recorded expenses",
      text: `${plans.length} budget plan${plans.length === 1 ? "" : "s"} with branded workbook exports.`,
    },
    {
      permission: "engineering",
      href: "/admin/operations?tool=engineering",
      value: String(needsReview),
      label: "Parts needing verification",
      text: "Track BOM, CAD/CAM/CAE, routers, inspection, and readiness.",
    },
    {
      permission: "glossary",
      href: "/admin/operations?tool=glossary",
      value: String(glossary.filter((term) => term.published).length),
      label: "Published terms",
      text: "Keep acronyms, roles, systems, and metrics understandable.",
    },
  ];
  return (
    <div className="grid gap-8">
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {cards
          .filter((card) => permissions[card.permission])
          .map((card) => (
            <Link
              href={card.href}
              key={card.permission}
              className="card group min-h-56 p-7 transition hover:-translate-y-1 hover:border-[#fd7803]/60"
            >
              <p className="font-mono text-3xl font-bold text-[#fd7803]">
                {card.value}
              </p>
              <h2 className="mt-5 text-xl font-bold">{card.label}</h2>
              <p className="mt-3 text-sm leading-7 text-[#999]">{card.text}</p>
              <span className="mt-7 inline-block text-sm font-semibold text-[#fd7803]">
                Open tool →
              </span>
            </Link>
          ))}
      </section>
      <OpsCard
        title="A connected operating rhythm"
        subtitle="The tools share people, meetings, projects, and export-ready records."
      >
        <div className="grid gap-6 md:grid-cols-3">
          <ProcessStep
            number="01"
            title="Document"
            body="Record a meeting, budget assumption, part, or organizational definition."
          />
          <ProcessStep
            number="02"
            title="Assign"
            body="Give the next action a member, project, priority, deadline, and review state."
          />
          <ProcessStep
            number="03"
            title="Deliver"
            body="Members comment and attach work; admins export polished evidence for the notebook."
          />
        </div>
      </OpsCard>
    </div>
  );
}

function TasksWorkspace({
  tasks,
  comments,
  members: people,
  meetings,
  nameById,
}: {
  tasks: Row<"tasks">[];
  comments: Row<"comments">[];
  members: Person[];
  meetings: Row<"meetings">[];
  nameById: Map<string, string>;
}) {
  return (
    <div className="grid gap-8">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          value={String(tasks.filter((task) => task.status === "TODO").length)}
          label="To do"
        />
        <Metric
          value={String(
            tasks.filter((task) => task.status === "IN_PROGRESS").length,
          )}
          label="In progress"
        />
        <Metric
          value={String(
            tasks.filter((task) => task.status === "BLOCKED").length,
          )}
          label="Blocked"
        />
        <Metric
          value={String(
            tasks.filter((task) => task.status === "IN_REVIEW").length,
          )}
          label="In review"
        />
      </div>
      <OpsCard
        title="Assign a task"
        subtitle="Every assignment appears in the member’s hub immediately."
      >
        <TaskForm members={people} meetings={meetings} />
      </OpsCard>
      <section className="grid gap-5">
        {tasks.map((task) => (
          <details className="card p-6 open:border-[#fd7803]/45" key={task.id}>
            <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Status value={task.status} />
                    <Status value={task.priority} />
                    <span className="tag">{task.project}</span>
                  </div>
                  <h2 className="mt-3 text-xl font-bold">{task.title}</h2>
                  <p className="mt-2 text-sm text-[#999]">
                    {nameById.get(task.assignedToMemberId) ?? "Unknown member"}
                    {task.dueAt
                      ? ` · Due ${task.dueAt.toLocaleDateString()}`
                      : " · No deadline"}
                  </p>
                </div>
                <span className="text-xs text-[#777]">
                  {
                    comments.filter((comment) => comment.taskId === task.id)
                      .length
                  }{" "}
                  updates
                </span>
              </div>
            </summary>
            <div className="mt-6 grid gap-6 border-t border-[#333] pt-6 xl:grid-cols-[1.1fr_.9fr]">
              <div>
                <p className="whitespace-pre-wrap text-sm leading-7 text-[#bbb]">
                  {task.description || "No additional instructions."}
                </p>
                <div className="mt-5 grid gap-3">
                  {comments
                    .filter((comment) => comment.taskId === task.id)
                    .map((comment) => (
                      <div
                        className="rounded-xl border border-[#333] bg-black/30 p-4"
                        key={comment.id}
                      >
                        <div className="flex flex-wrap justify-between gap-3">
                          <strong className="text-sm">
                            {nameById.get(comment.memberId) ?? "Team member"}
                          </strong>
                          <span className="text-xs text-[#777]">
                            {comment.createdAt.toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-[#aaa]">
                          {comment.body}
                        </p>
                        {comment.attachmentUrl && (
                          <a
                            className="mt-3 inline-block text-sm font-semibold text-[#fd7803]"
                            href={comment.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {comment.isDeliverable
                              ? "Deliverable: "
                              : "Attachment: "}
                            {comment.attachmentName ?? "Open file"}
                          </a>
                        )}
                      </div>
                    ))}
                </div>
              </div>
              <div className="grid gap-4">
                {task.status === "IN_REVIEW" && (
                  <div className="rounded-sm border border-[#fd7803]/45 bg-[#fd7803]/8 p-5">
                    <p className="eyebrow">Completion approval</p>
                    <h3 className="mt-2 text-lg font-bold">
                      Review the member&apos;s handoff
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-[#aaa]">
                      Submitted
                      {task.completionRequestedAt
                        ? ` ${task.completionRequestedAt.toLocaleString()}`
                        : " for review"}
                      . Check the deliverables and approve it or return it with
                      clear edits.
                    </p>
                    <ActionForm
                      action={reviewTaskCompletion}
                      successMessage="Task review saved."
                      className="mt-4 grid gap-3"
                    >
                      <input type="hidden" name="id" value={task.id} />
                      <Field label="Review note">
                        <textarea
                          className="input min-h-20"
                          name="note"
                          placeholder="Optional approval note, or required edits when returning the task."
                        />
                      </Field>
                      <div className="flex flex-wrap gap-3">
                        <button
                          className="button"
                          name="decision"
                          value="APPROVE"
                        >
                          Approve completion
                        </button>
                        <button
                          className="button secondary"
                          name="decision"
                          value="REQUEST_CHANGES"
                        >
                          Request edits
                        </button>
                      </div>
                    </ActionForm>
                  </div>
                )}
                {task.status === "DONE" && (
                  <div className="rounded-sm border border-emerald-500/35 bg-emerald-500/8 p-4 text-sm leading-6 text-emerald-200">
                    Approved
                    {task.approvedAt
                      ? ` ${task.approvedAt.toLocaleString()}`
                      : ""}
                    {task.approvedByMemberId
                      ? ` by ${nameById.get(task.approvedByMemberId) ?? "a task manager"}`
                      : ""}
                    .
                    {task.approvalNote && (
                      <span className="mt-2 block text-[#bbb]">
                        {task.approvalNote}
                      </span>
                    )}
                  </div>
                )}
                <h3 className="font-bold">Edit assignment</h3>
                <TaskForm task={task} members={people} meetings={meetings} />
                <ActionForm
                  action={archiveTask}
                  successMessage="Task archived."
                  className="border-t border-[#333] pt-4"
                >
                  <input type="hidden" name="id" value={task.id} />
                  <button className="text-sm text-red-300 hover:text-red-200">
                    Archive task
                  </button>
                </ActionForm>
              </div>
            </div>
          </details>
        ))}
        {!tasks.length && (
          <EmptyState
            title="No tasks yet"
            body="Create the first assignment to start the team queue."
          />
        )}
      </section>
    </div>
  );
}

function TaskForm({
  task,
  members: people,
  meetings,
  selectedMeetingId,
}: {
  task?: Row<"tasks">;
  members: Person[];
  meetings: Row<"meetings">[];
  selectedMeetingId?: string;
}) {
  return (
    <ActionForm
      action={saveTask}
      successMessage={task ? "Task updated." : "Task assigned."}
      className="grid gap-5"
    >
      {task && <input type="hidden" name="id" value={task.id} />}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Assigned member">
          <select
            className="input"
            name="assignedToMemberId"
            defaultValue={task?.assignedToMemberId}
            required
          >
            <option value="">Select member</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name} · {person.role}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Project">
          <input
            className="input"
            name="project"
            defaultValue={task?.project ?? "Organization"}
            required
          />
        </Field>
        <Field label="Priority">
          <Select
            name="priority"
            options={taskPriorities}
            value={task?.priority}
          />
        </Field>
        <Field label="Status">
          <Select name="status" options={taskStatuses} value={task?.status} />
        </Field>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Task title">
          <input
            className="input"
            name="title"
            defaultValue={task?.title}
            required
          />
        </Field>
        <Field label="Deadline">
          <CalendarInput
            name="dueAt"
            type="datetime-local"
            defaultValue={toLocalInput(task?.dueAt)}
          />
        </Field>
      </div>
      <Field label="Instructions and acceptance criteria">
        <textarea
          className="input min-h-32"
          name="description"
          defaultValue={task?.description}
        />
      </Field>
      <Field label="Source meeting (optional)">
        <select
          className="input"
          name="meetingId"
          defaultValue={task?.meetingId ?? selectedMeetingId ?? ""}
        >
          <option value="">No linked meeting</option>
          {meetings.map((meeting) => (
            <option key={meeting.id} value={meeting.id}>
              {meeting.title} · {meeting.heldAt.toLocaleDateString()}
            </option>
          ))}
        </select>
      </Field>
      <button className="button w-fit">
        {task ? "Save task changes" : "Assign task"}
      </button>
    </ActionForm>
  );
}

function MeetingsWorkspace({
  meetings,
  decisions,
  activities,
  attendance,
  tasks,
  members: people,
  nameById,
}: {
  meetings: Row<"meetings">[];
  decisions: Row<"decisions">[];
  activities: Row<"activities">[];
  attendance: Row<"attendance">[];
  tasks: Row<"tasks">[];
  members: Person[];
  nameById: Map<string, string>;
}) {
  return (
    <div className="grid gap-8">
      <OpsCard
        title="Create a meeting record"
        subtitle="Link attendance, preserve the discussion, then turn decisions into accountable work."
      >
        <MeetingForm activities={activities} />
      </OpsCard>
      <section className="grid gap-6">
        {meetings.map((meeting) => {
          const meetingDecisions = decisions.filter(
            (decision) => decision.meetingId === meeting.id,
          );
          const meetingTasks = tasks.filter(
            (task) => task.meetingId === meeting.id,
          );
          const attendees = attendance.filter(
            (row) => row.activityId === meeting.activityId,
          );
          return (
            <details
              className="card p-6 open:border-[#fd7803]/45"
              key={meeting.id}
            >
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div>
                    <Status value={meeting.status} />
                    <h2 className="mt-3 text-2xl font-bold">{meeting.title}</h2>
                    <p className="mt-2 text-sm text-[#999]">
                      {meeting.heldAt.toLocaleString()} ·{" "}
                      {meeting.location || "Location not recorded"} ·{" "}
                      {attendees.length} linked attendees
                    </p>
                  </div>
                  <a
                    className="button secondary"
                    href={`/api/exports/meetings/${meeting.id}`}
                  >
                    Export .docx
                  </a>
                </div>
              </summary>
              <div className="mt-7 grid gap-8 border-t border-[#333] pt-7">
                <div className="grid gap-6 lg:grid-cols-3">
                  <MeetingText title="Summary" text={meeting.summary} />
                  <MeetingText title="Discussion" text={meeting.discussion} />
                  <MeetingText
                    title="Next meeting"
                    text={meeting.nextMeeting}
                  />
                </div>
                <div className="grid gap-6 xl:grid-cols-2">
                  <OpsCard
                    title="Decisions"
                    subtitle="Record what was decided, why, and what it changes."
                  >
                    <div className="grid gap-4">
                      {meetingDecisions.map((decision) => (
                        <div
                          className="rounded-xl border border-[#333] p-4"
                          key={decision.id}
                        >
                          <strong>{decision.decision}</strong>
                          {decision.rationale && (
                            <p className="mt-2 text-sm text-[#aaa]">
                              Why: {decision.rationale}
                            </p>
                          )}
                          {decision.impact && (
                            <p className="mt-1 text-sm text-[#aaa]">
                              Impact: {decision.impact}
                            </p>
                          )}
                          <ActionForm
                            action={deleteMeetingDecision}
                            successMessage="Decision removed."
                            className="mt-3"
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={decision.id}
                            />
                            <button className="text-xs text-red-300">
                              Remove
                            </button>
                          </ActionForm>
                        </div>
                      ))}
                      <ActionForm
                        action={saveMeetingDecision}
                        successMessage="Decision added."
                        className="grid gap-4 border-t border-[#333] pt-5"
                      >
                        <input
                          type="hidden"
                          name="meetingId"
                          value={meeting.id}
                        />
                        <Field label="Decision">
                          <textarea
                            className="input min-h-20"
                            name="decision"
                            required
                          />
                        </Field>
                        <Field label="Rationale">
                          <textarea
                            className="input min-h-20"
                            name="rationale"
                          />
                        </Field>
                        <Field label="Impact">
                          <input className="input" name="impact" />
                        </Field>
                        <button className="button w-fit">Add decision</button>
                      </ActionForm>
                    </div>
                  </OpsCard>
                  <OpsCard
                    title="Actions and deadlines"
                    subtitle={`${meetingTasks.length} task${meetingTasks.length === 1 ? "" : "s"} linked to this meeting.`}
                  >
                    <TaskForm
                      members={people}
                      meetings={[meeting]}
                      selectedMeetingId={meeting.id}
                    />
                  </OpsCard>
                </div>
                <OpsCard title="Edit meeting record">
                  <MeetingForm meeting={meeting} activities={activities} />
                  <ActionForm
                    action={deleteMeeting}
                    successMessage="Meeting deleted."
                    className="mt-6 border-t border-[#333] pt-5"
                  >
                    <input type="hidden" name="id" value={meeting.id} />
                    <button className="text-sm text-red-300">
                      Delete meeting record
                    </button>
                  </ActionForm>
                </OpsCard>
                <div>
                  <h3 className="font-bold">Attendance linked from activity</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {attendees.map((row) => (
                      <span className="tag" key={row.id}>
                        {nameById.get(row.memberId) ?? "Member"}
                      </span>
                    ))}
                    {!attendees.length && (
                      <span className="text-sm text-[#777]">
                        No attendance record linked.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </details>
          );
        })}
        {!meetings.length && (
          <EmptyState
            title="No meeting notes yet"
            body="Create a structured meeting record above."
          />
        )}
      </section>
    </div>
  );
}

function MeetingForm({
  meeting,
  activities,
}: {
  meeting?: Row<"meetings">;
  activities: Row<"activities">[];
}) {
  return (
    <ActionForm
      action={saveMeeting}
      successMessage={meeting ? "Meeting updated." : "Meeting created."}
      className="grid gap-5"
    >
      {meeting && <input type="hidden" name="id" value={meeting.id} />}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Title">
          <input
            className="input"
            name="title"
            defaultValue={meeting?.title}
            required
          />
        </Field>
        <Field label="Date and time">
          <CalendarInput
            name="heldAt"
            type="datetime-local"
            defaultValue={toLocalInput(meeting?.heldAt)}
            required
          />
        </Field>
        <Field label="Location">
          <input
            className="input"
            name="location"
            defaultValue={meeting?.location}
          />
        </Field>
        <Field label="Facilitator">
          <input
            className="input"
            name="facilitator"
            defaultValue={meeting?.facilitator}
          />
        </Field>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Attendance activity">
          <select
            className="input"
            name="activityId"
            defaultValue={meeting?.activityId ?? ""}
          >
            <option value="">No linked attendance</option>
            {activities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.title} · {activity.startsAt.toLocaleDateString()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Record status">
          <Select
            name="status"
            options={["DRAFT", "FINAL"]}
            value={meeting?.status}
          />
        </Field>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Field label="Agenda">
          <textarea
            className="input min-h-28"
            name="agenda"
            defaultValue={meeting?.agenda}
          />
        </Field>
        <Field label="Discussion notes">
          <textarea
            className="input min-h-28"
            name="discussion"
            defaultValue={meeting?.discussion}
          />
        </Field>
        <Field label="Executive summary">
          <textarea
            className="input min-h-28"
            name="summary"
            defaultValue={meeting?.summary}
          />
        </Field>
        <Field label="Next meeting / follow-up">
          <textarea
            className="input min-h-28"
            name="nextMeeting"
            defaultValue={meeting?.nextMeeting}
          />
        </Field>
      </div>
      <button className="button w-fit">
        {meeting ? "Save meeting changes" : "Create meeting record"}
      </button>
    </ActionForm>
  );
}

function FinanceWorkspace({
  plans,
  entries,
  sponsors,
  seasons,
  projects,
  donationCampaign,
  donationSummary,
  recentDonations,
  stripeBalance,
  members,
  uploaderId,
  donationPageContent,
}: {
  plans: Row<"plans">[];
  entries: Row<"entries">[];
  sponsors: Row<"sponsors">[];
  seasons: (typeof engineeringSeasons.$inferSelect)[];
  projects: (typeof engineeringProjects.$inferSelect)[];
  donationCampaign: Row<"donationCampaign"> | null;
  donationSummary: DonationSummary | null;
  recentDonations: Row<"donation">[];
  stripeBalance: StripeBalanceSnapshot | null;
  members: Person[];
  uploaderId: string;
  donationPageContent: Record<string, string> | null;
}) {
  const totals = summarizeBudget(entries, sponsors);
  return (
    <div className="grid gap-8">
      <div
        className="flex flex-wrap items-end justify-between gap-5"
        id="finance-overview"
      >
        <div>
          <p className="eyebrow">Finance command center</p>
          <h2 className="mt-3 text-3xl font-bold">
            Budget, giving, and sponsor funding
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#999]">
            Review cash position first, then manage Stripe giving, sponsor
            commitments, and itemized budget plans from one workspace.
          </p>
        </div>
        <a className="button" href="/api/exports/finance">
          Export branded Excel workbook
        </a>
      </div>
      <nav
        className="flex gap-2 overflow-x-auto border border-[#333] bg-[#0d0d0d] p-3"
        aria-label="Finance sections"
      >
        {[
          ["Overview", "#finance-overview"],
          ["Giving", "#finance-giving"],
          ["Sponsors", "#finance-sponsors"],
          ["Budget plans", "#finance-budgets"],
        ].map(([label, href]) => (
          <a
            className="shrink-0 border border-[#3a3a3a] px-4 py-2 text-sm font-semibold text-[#aaa] transition hover:border-[#fd7803] hover:text-white"
            href={href}
            key={href}
          >
            {label}
          </a>
        ))}
      </nav>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          value={centsToMoney(totals.expenses)}
          label="Recorded expenses"
        />
        <Metric value={centsToMoney(totals.planned)} label="Planned / BOM" />
        <Metric value={centsToMoney(totals.income)} label="Recorded income" />
        <Metric
          value={centsToMoney(totals.sponsorFunding)}
          label="Sponsor commitments"
        />
        <Metric
          value={centsToMoney(totals.availableCash)}
          label="Available cash"
        />
      </div>
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Financial planning and ledger</h2>
          <p className="mt-2 text-sm text-[#999]">
            Paid Stripe donations are automatically recorded as income.
            Ledger items may also be expenses, budgets, or purchasing BOM lines.
          </p>
        </div>
      </div>
      {donationCampaign && donationSummary && stripeBalance && (
        <DonationFinancePanel
          campaign={donationCampaign}
          summary={donationSummary}
          donations={recentDonations}
          stripeBalance={stripeBalance}
          members={members}
          uploaderId={uploaderId}
          teamImageUrl={
            donationPageContent?.teamImage ??
            "/media/gallery/siemens/siemens-1.jpg"
          }
        />
      )}
      <SponsorPortfolioPanel sponsors={sponsors} plans={plans} />
      <div className="grid gap-6" id="finance-budgets">
      <OpsCard
        title="Import finances"
        subtitle="Upload an Excel, CSV, or TSV expense sheet, budget, income list, or priced material list. Columns are detected automatically and exact duplicates are skipped."
      >
        <ImportActionForm
          action={importFinanceSpreadsheet}
          className="grid gap-4"
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Finance spreadsheet">
              <input
                className="input"
                name="file"
                type="file"
                accept=".xlsx,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values"
                required
              />
            </Field>
            <Field label="Destination budget">
              <select
                className="input"
                defaultValue={
                  plans.find((plan) => plan.status === "ACTIVE")?.id ??
                  plans[0]?.id ??
                  ""
                }
                name="planId"
              >
                <option value="">No plan (unassigned)</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Default type">
              <Select name="defaultKind" options={financeEntryKinds} />
            </Field>
            <Field label="Default status">
              <Select name="defaultStatus" options={financeEntryStatuses} />
            </Field>
          </div>
          <p className="text-xs leading-6 text-[#888]">
            Recommended columns: Item or Description, Amount or Unit Cost,
            Quantity, Type, Category, Vendor, Status, Date, and Notes. Income,
            expenses, BOM lines, and planned budget items are assigned to the
            selected destination automatically.
          </p>
          <button className="button w-fit">Import finance rows</button>
        </ImportActionForm>
      </OpsCard>
      <OpsCard
        title="Create a budget plan"
        subtitle="Create separate scenarios for conservative, target, competition, or alternative funding methods without changing another plan."
      >
        <FinancePlanForm seasons={seasons} projects={projects} />
      </OpsCard>
      {!!plans.length && (
        <nav
          className="flex gap-2 overflow-x-auto border border-[#333] bg-[#0d0d0d] p-3"
          aria-label="Budget plan tabs"
        >
          {plans.map((plan) => (
            <a
              className="shrink-0 border border-[#3a3a3a] px-4 py-3 text-sm font-semibold text-[#aaa] transition hover:border-[#fd7803] hover:text-white"
              href={`#budget-plan-${plan.id}`}
              key={plan.id}
            >
              {plan.name}
            </a>
          ))}
        </nav>
      )}
      <section className="grid gap-5">
        {plans.map((plan, planIndex) => {
          const planEntries = entries.filter(
            (entry) => entry.planId === plan.id,
          );
          const planSponsors = sponsors.filter(
            (sponsor) => sponsor.planId === plan.id,
          );
          const planTotals = summarizeBudget(planEntries, planSponsors);
          return (
            <details
              className="card p-6 open:border-[#fd7803]/45"
              key={plan.id}
              id={`budget-plan-${plan.id}`}
              open={plan.status === "ACTIVE" || planIndex === 0}
            >
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap justify-between gap-5">
                  <div>
                    <Status value={plan.status} />
                    <h3 className="mt-3 text-2xl font-bold">{plan.name}</h3>
                    <p className="mt-2 text-sm text-[#999]">
                      FY {plan.fiscalYear} · {plan.project} · Range{" "}
                      {centsToMoney(plan.minimumBudgetCents)}–
                      {centsToMoney(plan.maximumBudgetCents)}
                    </p>
                  </div>
                  <div className="text-right">
                    <strong className="text-2xl text-[#fd7803]">
                      {centsToMoney(planTotals.expenses)}
                    </strong>
                    <p className="mt-1 text-xs text-[#777]">recorded expense</p>
                  </div>
                </div>
              </summary>
              <div className="mt-7 grid gap-7 border-t border-[#333] pt-7">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                  <SmallMetric
                    value={centsToMoney(plan.minimumBudgetCents)}
                    label="Minimum"
                  />
                  <SmallMetric
                    value={centsToMoney(plan.maximumBudgetCents)}
                    label="Maximum"
                  />
                  <SmallMetric
                    value={centsToMoney(planTotals.planned)}
                    label="Planned"
                  />
                  <SmallMetric
                    value={centsToMoney(planTotals.expenses)}
                    label="Expenses"
                  />
                  <SmallMetric
                    value={centsToMoney(planTotals.totalFunding)}
                    label="Income + sponsors"
                  />
                  <SmallMetric
                    value={centsToMoney(planTotals.availableCash)}
                    label="Available cash"
                  />
                </div>
                <OpsCard
                  title="Budget range"
                  subtitle="Adjust the minimum and maximum without opening the full plan editor."
                >
                  <BudgetRangeForm plan={plan} />
                </OpsCard>
                <div className="grid gap-6 xl:grid-cols-2">
                  <OpsCard title="Add financial item">
                    <FinanceQuickEntryForm selectedPlanId={plan.id} />
                  </OpsCard>
                  <OpsCard title="Add sponsor funding">
                    <SponsorForm plans={plans} selectedPlanId={plan.id} />
                  </OpsCard>
                </div>
                <div className="grid gap-6">
                  <RecordPanel title="Ledger and budget items">
                    <FinanceEntriesTable entries={planEntries} />
                  </RecordPanel>
                  <RecordPanel title="Sponsor funding">
                    {planSponsors.map((sponsor) => (
                      <div
                        className="border-t border-[#333] py-4 first:border-0"
                        key={sponsor.id}
                      >
                        <div className="flex justify-between gap-3">
                          <div>
                            <Status value={sponsor.status} />
                            <strong className="mt-2 block">
                              {sponsor.sponsorName}
                            </strong>
                            <p className="mt-1 text-xs text-[#777]">
                              {sponsor.tier} ·{" "}
                              {sponsor.contactName || "No contact"}
                            </p>
                          </div>
                          <strong className="text-[#fd7803]">
                            {centsToMoney(sponsor.amountCents)}
                          </strong>
                        </div>
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs font-semibold text-[#aaa]">
                            Edit funding
                          </summary>
                          <div className="mt-4">
                            <SponsorForm sponsor={sponsor} plans={plans} />
                            <DeleteForm
                              action={deleteSponsorCommitment}
                              id={sponsor.id}
                              label="Delete sponsor funding"
                            />
                          </div>
                        </details>
                      </div>
                    ))}
                    {!planSponsors.length && (
                      <p className="py-6 text-sm text-[#777]">
                        No sponsor commitments in this plan.
                      </p>
                    )}
                  </RecordPanel>
                </div>
                <OpsCard title="Edit plan">
                  <FinancePlanForm plan={plan} seasons={seasons} projects={projects} />
                  <DeleteForm
                    action={deleteFinancePlan}
                    id={plan.id}
                    label="Delete plan and its ledger items"
                  />
                </OpsCard>
              </div>
            </details>
          );
        })}
        {!plans.length && (
          <EmptyState
            title="No budget plans"
            body="Create a plan above, then add expenses, budgets, BOM lines, and sponsor commitments."
          />
        )}
      </section>
      {plans.length === 0 && (
        <div className="grid gap-6 xl:grid-cols-2">
          <OpsCard title="Unassigned financial item">
            <FinanceEntryForm plans={plans} />
          </OpsCard>
          <OpsCard title="Unassigned sponsor funding">
            <SponsorForm plans={plans} />
          </OpsCard>
        </div>
      )}
      </div>
    </div>
  );
}

function SponsorPortfolioPanel({
  sponsors,
  plans,
}: {
  sponsors: Row<"sponsors">[];
  plans: Row<"plans">[];
}) {
  const received = sponsors
    .filter((sponsor) => sponsor.status === "RECEIVED")
    .reduce((sum, sponsor) => sum + sponsor.amountCents, 0);
  const committed = sponsors
    .filter((sponsor) => ["PLEDGED", "COMMITTED"].includes(sponsor.status))
    .reduce((sum, sponsor) => sum + sponsor.amountCents, 0);
  const planById = new Map(plans.map((plan) => [plan.id, plan.name]));
  return (
    <section
      className="grid gap-5 border border-[#333] bg-[#0d0d0d] p-5 sm:p-7"
      id="finance-sponsors"
    >
      <div>
        <p className="eyebrow">Sponsor funding</p>
        <h2 className="mt-3 text-2xl font-bold">Commitment portfolio</h2>
        <p className="mt-2 text-sm text-[#999]">
          A consolidated funding view across every budget plan.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <SmallMetric
          value={sponsors.length.toLocaleString()}
          label="Organizations"
        />
        <SmallMetric
          value={centsToMoney(committed)}
          label="Pledged / committed"
        />
        <SmallMetric value={centsToMoney(received)} label="Received" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[#333] text-xs uppercase tracking-wider text-[#777]">
            <tr>
              <th className="px-3 py-3">Sponsor</th>
              <th className="px-3 py-3">Plan</th>
              <th className="px-3 py-3">Contact</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sponsors.map((sponsor) => (
              <tr className="border-b border-[#252525]" key={sponsor.id}>
                <td className="px-3 py-4 font-semibold text-white">
                  {sponsor.sponsorName}
                </td>
                <td className="px-3 py-4 text-[#aaa]">
                  {sponsor.planId
                    ? planById.get(sponsor.planId) || "Unassigned"
                    : "Unassigned"}
                </td>
                <td className="px-3 py-4 text-[#aaa]">
                  {sponsor.contactName ||
                    sponsor.contactEmail ||
                    "No contact"}
                </td>
                <td className="px-3 py-4">
                  <Status value={sponsor.status} />
                </td>
                <td className="px-3 py-4 text-right font-bold text-[#fd7803]">
                  {centsToMoney(sponsor.amountCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!sponsors.length && (
          <p className="py-8 text-center text-sm text-[#777]">
            No sponsor funding has been recorded yet.
          </p>
        )}
      </div>
    </section>
  );
}

function DonationFinancePanel({
  campaign,
  summary,
  donations: donationRows,
  stripeBalance,
  members,
  uploaderId,
  teamImageUrl,
}: {
  campaign: Row<"donationCampaign">;
  summary: DonationSummary;
  donations: Row<"donation">[];
  stripeBalance: StripeBalanceSnapshot;
  members: Person[];
  uploaderId: string;
  teamImageUrl: string;
}) {
  const progress = donationProgress(summary.netRaisedCents, campaign.goalCents);
  const available = formatStripeBalance(stripeBalance.available);
  return (
    <section
      className="grid gap-6 border border-[#3a3a3a] bg-[#0d0d0d] p-5 sm:p-7"
      id="finance-giving"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Stripe donations</p>
          <h2 className="mt-3 text-2xl font-bold">Campaign and live account view</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#999]">
            Confirmed Stripe payments update the public goal automatically.
            Paid gifts also appear automatically as income in the active budget.
            The available account balance comes directly from Stripe.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="button" href="/donate" target="_blank">
            View donation page
          </Link>
          <a
            className="button secondary"
            href="https://dashboard.stripe.com/"
            rel="noreferrer"
            target="_blank"
          >
            Open Stripe
          </a>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SmallMetric value={centsToMoney(summary.netRaisedCents)} label="Net raised" />
        <SmallMetric value={summary.confirmedCount.toLocaleString()} label="Confirmed gifts" />
        <SmallMetric value={centsToMoney(summary.last30DaysCents)} label="Last 30 days" />
        <SmallMetric value={available} label="Stripe available" />
      </div>

      <div className="border border-[#333] bg-black p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <strong className="text-2xl text-white">
              {centsToMoney(summary.netRaisedCents)}
            </strong>
            <span className="ml-2 text-sm text-[#888]">
              of {centsToMoney(campaign.goalCents)}
            </span>
          </div>
          <strong className="text-[#fd7803]">{Math.round(progress)}%</strong>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden bg-[#282828]">
          <div
            className="h-full bg-[#fd7803]"
            style={{ width: `${progress}%` }}
          />
        </div>
        {summary.refundedCents > 0 && (
          <p className="mt-3 text-xs text-[#888]">
            Gross {centsToMoney(summary.grossRaisedCents)} · refunds {centsToMoney(summary.refundedCents)}
          </p>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <OpsCard
          title="Donation page settings"
          subtitle="Changes publish immediately. The page always includes $1 and $5, with $5 selected by default."
        >
          <ActionForm
            action={saveDonationCampaign}
            successMessage="Donation campaign updated."
            className="grid gap-4"
          >
            <Field label="Campaign headline">
              <input
                className="input"
                defaultValue={campaign.title}
                maxLength={120}
                name="title"
                required
              />
            </Field>
            <Field label="Campaign message">
              <textarea
                className="input min-h-28"
                defaultValue={campaign.description}
                maxLength={600}
                name="description"
                required
              />
            </Field>
            <Field label="Fundraiser team photo">
              <ImageUpload
                name="upload_teamImage"
                removeName="remove_teamImage"
                purpose="site-content"
                uploaderId={uploaderId}
                currentUrl={teamImageUrl}
                label="Upload fundraiser photo"
                presentation="landscape"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Goal (USD)">
                <input
                  className="input"
                  defaultValue={(campaign.goalCents / 100).toFixed(2)}
                  min="1"
                  name="goal"
                  required
                  step="0.01"
                  type="number"
                />
              </Field>
              <Field label="Suggested amounts (USD, comma-separated)">
                <input
                  className="input"
                  defaultValue={campaign.suggestedAmountsCents
                    .map((amount) => amount / 100)
                    .join(", ")}
                  name="suggestedAmounts"
                  placeholder="1, 5, 10, 25, 50, 100, 210, 500"
                  required
                />
              </Field>
            </div>
            <label className="flex items-center gap-3 border border-[#333] bg-black p-4 text-sm font-semibold text-[#ccc]">
              <input
                defaultChecked={campaign.isActive}
                name="isActive"
                type="checkbox"
              />
              Accept donations on the public page
            </label>
            <button className="button w-fit">Publish donation settings</button>
          </ActionForm>
        </OpsCard>

        <OpsCard
          title="Donation history and member credit"
          subtitle="Review up to 250 previous paid gifts. Assign or change the active member who brought in each donation; leaderboard totals update immediately."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-left text-sm">
              <thead className="border-b border-[#333] text-xs uppercase tracking-wider text-[#777]">
                <tr>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Donor</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Amount</th>
                  <th className="min-w-64 px-3 py-3">Member credit</th>
                </tr>
              </thead>
              <tbody>
                {donationRows.map((donation) => (
                  <tr className="border-b border-[#252525]" key={donation.id}>
                    <td className="px-3 py-4 text-xs text-[#999]">
                      {donation.createdAt.toLocaleDateString()}
                    </td>
                    <td className="px-3 py-4">
                      <strong className="block text-white">
                        {donation.donorName || "Anonymous donor"}
                      </strong>
                      <span className="mt-1 block text-xs text-[#777]">
                        {donation.donorEmail || "No email provided"}
                      </span>
                      {donation.club210ShirtSize && (
                        <span className="mt-1 block text-xs font-semibold text-[#fd7803]">
                          Club 210 · Shirt size {donation.club210ShirtSize}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4"><Status value={donation.status} /></td>
                    <td className="px-3 py-4 text-right font-bold text-[#fd7803]">
                      {centsToMoney(Math.max(0, donation.amountCents - donation.refundedCents))}
                    </td>
                    <td className="min-w-64 px-3 py-4">
                      <ActionForm
                        action={saveDonationAttribution}
                        className="grid min-w-0 gap-2"
                        successMessage="Member credit updated."
                      >
                        <input
                          name="donationId"
                          type="hidden"
                          value={donation.id}
                        />
                        <label className="grid min-w-0 gap-2">
                          <span className="font-mono text-[.62rem] uppercase tracking-wider text-[#fd7803]">
                            Credit this past donation to
                          </span>
                          <select
                            className="input min-w-0 !min-h-10 !py-2 text-xs"
                            defaultValue={donation.attributedMemberId || ""}
                            name="memberId"
                          >
                            <option value="">No member attribution</option>
                            {members.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button className="button secondary w-fit !min-h-9 !px-3 !text-xs">
                          Save member credit
                        </button>
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!donationRows.length && (
              <p className="py-10 text-center text-sm text-[#777]">
                No paid Stripe donations yet.
              </p>
            )}
          </div>
          {stripeBalance.error && (
            <p className="mt-4 border border-[#533] bg-[#1c1010] p-3 text-xs text-red-300">
              Stripe account balance is currently {stripeBalance.error.toLowerCase()}.
            </p>
          )}
        </OpsCard>
      </div>
      <OpsCard
        title="Fundraiser social toolkit"
        subtitle="Download ready-to-post square and story graphics in three campaign styles. The caption pack includes matching copy and hashtags."
      >
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              title: "Cinematic team",
              preview: "/media/fundraiser/cinematic-post.png",
              post: "/media/fundraiser/cinematic-post.png",
              story: "/media/fundraiser/cinematic-story.png",
            },
            {
              title: "Engineering blueprint",
              preview: "/media/fundraiser/blueprint-post.png",
              post: "/media/fundraiser/blueprint-post.png",
              story: "/media/fundraiser/blueprint-story.png",
            },
            {
              title: "Heartfelt opportunity",
              preview: "/media/fundraiser/heartfelt-post.png",
              post: "/media/fundraiser/heartfelt-post.png",
              story: "/media/fundraiser/heartfelt-story.png",
            },
          ].map((asset) => (
            <article
              className="min-w-0 overflow-hidden border border-[#333] bg-black"
              key={asset.title}
            >
              <div className="relative aspect-square overflow-hidden bg-[#111]">
                <Image
                  src={asset.preview}
                  alt={`${asset.title} fundraiser graphic preview`}
                  fill
                  sizes="(max-width: 767px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
              <div className="grid gap-3 p-4">
                <strong>{asset.title}</strong>
                <div className="grid grid-cols-2 gap-2">
                  <a className="button secondary !min-h-10 !px-3" href={asset.post} download>
                    Square post
                  </a>
                  <a className="button secondary !min-h-10 !px-3" href={asset.story} download>
                    Story
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
        <a
          className="button mt-5 w-fit"
          href="/media/fundraiser/captions.md"
          download
        >
          Download caption pack
        </a>
      </OpsCard>
    </section>
  );
}

function formatStripeBalance(
  amounts: Array<{ amount: number; currency: string }>,
) {
  if (!amounts.length) return "$0.00";
  return amounts
    .map(({ amount, currency }) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency.toUpperCase(),
      }).format(amount / 100),
    )
    .join(" · ");
}

function BudgetRangeForm({ plan }: { plan: Row<"plans"> }) {
  return (
    <ActionForm
      action={saveFinancePlan}
      successMessage="Budget range updated."
      className="grid gap-4"
    >
      <input type="hidden" name="id" value={plan.id} />
      <input type="hidden" name="name" value={plan.name} />
      <input type="hidden" name="fiscalYear" value={plan.fiscalYear} />
      <input type="hidden" name="project" value={plan.project} />
      <input type="hidden" name="status" value={plan.status} />
      <input type="hidden" name="notes" value={plan.notes} />
      <input type="hidden" name="seasonId" value={plan.seasonId ?? ""} />
      <input
        type="hidden"
        name="engineeringProjectId"
        value={plan.engineeringProjectId ?? ""}
      />
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Minimum budget">
          <input
            className="input"
            name="minimumBudget"
            type="number"
            min="0"
            step="0.01"
            defaultValue={plan.minimumBudgetCents / 100}
          />
        </Field>
        <Field label="Maximum budget">
          <input
            className="input"
            name="maximumBudget"
            type="number"
            min="0"
            step="0.01"
            defaultValue={plan.maximumBudgetCents / 100}
          />
        </Field>
        <button className="button h-[50px]">Update range</button>
      </div>
    </ActionForm>
  );
}

function FinanceQuickEntryForm({ selectedPlanId }: { selectedPlanId: string }) {
  return (
    <ActionForm
      action={saveFinanceEntry}
      successMessage="Budget line added."
      className="grid gap-4"
    >
      <input type="hidden" name="planId" value={selectedPlanId} />
      <input type="hidden" name="occurredAt" value={toLocalInput(new Date())} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type">
          <Select name="kind" options={financeEntryKinds} />
        </Field>
        <Field label="Item">
          <input
            className="input"
            name="description"
            placeholder="Registration, aluminum stock, sponsor income…"
            required
          />
        </Field>
        <Field label="Category">
          <FinanceCategorySelect />
        </Field>
        <Field label="Quantity">
          <QuantityStepper />
        </Field>
        <Field label="Unit amount">
          <input
            className="input"
            name="unitCost"
            type="number"
            min="0"
            step="0.01"
            defaultValue={0}
            required
          />
        </Field>
        <Field label="Status">
          <Select name="status" options={financeEntryStatuses} />
        </Field>
      </div>
      <button className="button w-fit">Add budget line</button>
    </ActionForm>
  );
}

function FinanceEntriesTable({ entries }: { entries: Row<"entries">[] }) {
  if (!entries.length)
    return (
      <p className="py-6 text-sm text-[#777]">
        No lines yet. Add the first budget item, expense, or income above.
      </p>
    );
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1040px]">
        <div className="grid grid-cols-[130px_minmax(220px,1.5fr)_140px_120px_125px_120px_140px_100px] gap-3 border-b border-[#444] pb-3 font-mono text-[.62rem] uppercase tracking-wider text-[#777]">
          <span>Type</span>
          <span>Item</span>
          <span>Category</span>
          <span>Quantity</span>
          <span>Unit</span>
          <span>Total</span>
          <span>Status</span>
          <span>Action</span>
        </div>
        {entries.map((entry) => (
          <div className="border-b border-[#2d2d2d] py-4" key={entry.id}>
            <ActionForm
              action={saveFinanceEntry}
              successMessage="Budget line updated."
              className="grid gap-3"
            >
              <input type="hidden" name="id" value={entry.id} />
              <input type="hidden" name="planId" value={entry.planId ?? ""} />
              <div className="grid grid-cols-[130px_minmax(220px,1.5fr)_140px_120px_125px_120px_140px_100px] items-center gap-3">
                <Select
                  name="kind"
                  options={financeEntryKinds}
                  value={entry.kind}
                  ariaLabel={`Type for ${entry.description}`}
                />
                <input
                  className="input py-3"
                  name="description"
                  aria-label="Budget item description"
                  defaultValue={entry.description}
                  required
                />
                <FinanceCategorySelect
                  value={entry.category}
                  ariaLabel={`Category for ${entry.description}`}
                />
                <QuantityStepper
                  defaultValue={entry.quantity}
                  ariaLabel={`Quantity for ${entry.description}`}
                />
                <input
                  className="input py-3"
                  name="unitCost"
                  aria-label={`Unit amount for ${entry.description}`}
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={entry.unitCostCents / 100}
                />
                <strong className="font-mono text-[#fd7803]">
                  {centsToMoney(entry.amountCents)}
                </strong>
                <Select
                  name="status"
                  options={financeEntryStatuses}
                  value={entry.status}
                  ariaLabel={`Status for ${entry.description}`}
                />
                <button className="button h-[46px] px-4">Save</button>
              </div>
              <details className="text-xs text-[#999]">
                <summary className="cursor-pointer font-semibold hover:text-white">
                  Vendor, date, receipt, and notes
                </summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Vendor / source">
                    <input
                      className="input"
                      name="vendor"
                      defaultValue={entry.vendor}
                    />
                  </Field>
                  <Field label="Date">
                    <CalendarInput
                      name="occurredAt"
                      type="datetime-local"
                      defaultValue={toLocalInput(entry.occurredAt)}
                      required
                    />
                  </Field>
                  <Field label="Receipt / evidence URL">
                    <input
                      className="input"
                      name="receiptUrl"
                      type="url"
                      defaultValue={entry.receiptUrl ?? ""}
                    />
                  </Field>
                  <Field label="Notes">
                    <textarea
                      className="input min-h-20"
                      name="notes"
                      defaultValue={entry.notes}
                    />
                  </Field>
                </div>
              </details>
            </ActionForm>
            <DeleteForm
              action={deleteFinanceEntry}
              id={entry.id}
              label="Delete line"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function FinancePlanForm({
  plan,
  seasons,
  projects,
}: {
  plan?: Row<"plans">;
  seasons: (typeof engineeringSeasons.$inferSelect)[];
  projects: (typeof engineeringProjects.$inferSelect)[];
}) {
  return (
    <ActionForm
      action={saveFinancePlan}
      successMessage={plan ? "Plan updated." : "Plan created."}
      className="grid gap-5"
    >
      {plan && <input type="hidden" name="id" value={plan.id} />}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Season">
          <select
            className="input"
            name="seasonId"
            defaultValue={
              plan?.seasonId ??
              seasons.find((season) => season.isDefault)?.id ??
              ""
            }
          >
            <option value="">Organization-wide</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Engineering project">
          <select
            className="input"
            name="engineeringProjectId"
            defaultValue={plan?.engineeringProjectId ?? ""}
          >
            <option value="">All / unassigned</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.code} · {project.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Plan name">
          <input
            className="input"
            name="name"
            defaultValue={plan?.name}
            required
          />
        </Field>
        <Field label="Fiscal year">
          <input
            className="input"
            name="fiscalYear"
            type="number"
            min="2000"
            max="2200"
            defaultValue={plan?.fiscalYear ?? new Date().getFullYear()}
            required
          />
        </Field>
        <Field label="Project">
          <input
            className="input"
            name="project"
            defaultValue={plan?.project ?? "Organization"}
            required
          />
        </Field>
        <Field label="Status">
          <Select
            name="status"
            options={["DRAFT", "ACTIVE", "ARCHIVED"]}
            value={plan?.status}
          />
        </Field>
        <Field label="Minimum budget">
          <input
            className="input"
            name="minimumBudget"
            type="number"
            min="0"
            step="0.01"
            defaultValue={plan ? plan.minimumBudgetCents / 100 : 0}
          />
        </Field>
        <Field label="Maximum budget">
          <input
            className="input"
            name="maximumBudget"
            type="number"
            min="0"
            step="0.01"
            defaultValue={plan ? plan.maximumBudgetCents / 100 : 0}
          />
        </Field>
      </div>
      <Field label="Budget assumptions and notes">
        <textarea
          className="input min-h-24"
          name="notes"
          defaultValue={plan?.notes}
        />
      </Field>
      <button className="button w-fit">
        {plan ? "Save plan" : "Create plan"}
      </button>
    </ActionForm>
  );
}
function FinanceEntryForm({
  entry,
  plans,
  selectedPlanId,
}: {
  entry?: Row<"entries">;
  plans: Row<"plans">[];
  selectedPlanId?: string;
}) {
  return (
    <ActionForm
      action={saveFinanceEntry}
      successMessage={entry ? "Item updated." : "Financial item added."}
      className="grid gap-4"
    >
      {entry && <input type="hidden" name="id" value={entry.id} />}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Budget plan">
          <select
            className="input"
            name="planId"
            defaultValue={entry?.planId ?? selectedPlanId ?? ""}
          >
            <option value="">Unassigned</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Record type">
          <Select name="kind" options={financeEntryKinds} value={entry?.kind} />
        </Field>
        <Field label="Description">
          <input
            className="input"
            name="description"
            defaultValue={entry?.description}
            required
          />
        </Field>
        <Field label="Category">
          <FinanceCategorySelect value={entry?.category} />
        </Field>
        <Field label="Vendor / supplier">
          <input className="input" name="vendor" defaultValue={entry?.vendor} />
        </Field>
        <Field label="Status">
          <Select
            name="status"
            options={financeEntryStatuses}
            value={entry?.status}
          />
        </Field>
        <Field label="Quantity">
          <QuantityStepper defaultValue={entry?.quantity ?? 1} />
        </Field>
        <Field label="Unit cost">
          <input
            className="input"
            name="unitCost"
            type="number"
            min="0"
            step="0.01"
            defaultValue={entry ? entry.unitCostCents / 100 : 0}
          />
        </Field>
        <Field label="Total override (optional)">
          <input
            className="input"
            name="amount"
            type="number"
            step="0.01"
            defaultValue={
              entry &&
              entry.amountCents !== entry.quantity * entry.unitCostCents
                ? entry.amountCents / 100
                : ""
            }
          />
        </Field>
        <Field label="Date">
          <CalendarInput
            name="occurredAt"
            type="datetime-local"
            defaultValue={
              toLocalInput(entry?.occurredAt) ?? toLocalInput(new Date())
            }
            required
          />
        </Field>
      </div>
      <Field label="Receipt / evidence URL">
        <input
          className="input"
          name="receiptUrl"
          type="url"
          defaultValue={entry?.receiptUrl ?? ""}
        />
      </Field>
      <Field label="Notes">
        <textarea
          className="input min-h-20"
          name="notes"
          defaultValue={entry?.notes}
        />
      </Field>
      <button className="button w-fit">
        {entry ? "Save item" : "Add item"}
      </button>
    </ActionForm>
  );
}
function SponsorForm({
  sponsor,
  plans,
  selectedPlanId,
}: {
  sponsor?: Row<"sponsors">;
  plans: Row<"plans">[];
  selectedPlanId?: string;
}) {
  return (
    <ActionForm
      action={saveSponsorCommitment}
      successMessage={
        sponsor ? "Sponsor funding updated." : "Sponsor funding added."
      }
      className="grid gap-4"
    >
      {sponsor && <input type="hidden" name="id" value={sponsor.id} />}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Budget plan">
          <select
            className="input"
            name="planId"
            defaultValue={sponsor?.planId ?? selectedPlanId ?? ""}
          >
            <option value="">Unassigned</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sponsor">
          <input
            className="input"
            name="sponsorName"
            defaultValue={sponsor?.sponsorName}
            required
          />
        </Field>
        <Field label="Amount">
          <input
            className="input"
            name="amount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={sponsor ? sponsor.amountCents / 100 : 0}
            required
          />
        </Field>
        <Field label="Status">
          <Select
            name="status"
            options={sponsorStatuses}
            value={sponsor?.status}
          />
        </Field>
        <Field label="Tier">
          <input
            className="input"
            name="tier"
            defaultValue={sponsor?.tier ?? "Partner"}
          />
        </Field>
        <Field label="Contact name">
          <input
            className="input"
            name="contactName"
            defaultValue={sponsor?.contactName}
          />
        </Field>
        <Field label="Contact email">
          <input
            className="input"
            name="contactEmail"
            type="email"
            defaultValue={sponsor?.contactEmail}
          />
        </Field>
        <Field label="Received date">
          <CalendarInput
            name="receivedAt"
            type="datetime-local"
            defaultValue={toLocalInput(sponsor?.receivedAt)}
          />
        </Field>
      </div>
      <Field label="Restrictions / designated use">
        <textarea
          className="input min-h-20"
          name="restrictions"
          defaultValue={sponsor?.restrictions}
        />
      </Field>
      <button className="button w-fit">
        {sponsor ? "Save sponsor funding" : "Add sponsor funding"}
      </button>
    </ActionForm>
  );
}

function EngineeringWorkspace({
  parts,
  steps,
  members: people,
  nameById,
  seasons,
  projects,
  subsystems,
}: {
  parts: Row<"parts">[];
  steps: Row<"steps">[];
  members: Person[];
  nameById: Map<string, string>;
  seasons: (typeof engineeringSeasons.$inferSelect)[];
  projects: (typeof engineeringProjects.$inferSelect)[];
  subsystems: (typeof engineeringSubsystems.$inferSelect)[];
}) {
  const total = parts.reduce(
    (sum, part) => sum + part.quantity * part.unitCostCents,
    0,
  );
  const totalPieces = parts.reduce((sum, part) => sum + part.quantity, 0);
  const review = parts.filter((part) =>
    [
      part.cadStatus,
      part.camStatus,
      part.drawingStatus,
      part.verificationStatus,
    ].some((status) =>
      ["IN_REVIEW", "READY_FOR_REVIEW", "PENDING"].includes(status),
    ),
  ).length;
  return (
    <div className="grid gap-8">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Metric value={String(totalPieces)} label="Total parts required" />
        <Metric
          value={String(
            parts
              .filter((part) => part.makeBuy === "MAKE")
              .reduce((sum, part) => sum + part.quantity, 0),
          )}
          label="Parts to make"
        />
        <Metric value={String(review)} label="Awaiting review" />
        <Metric value={centsToMoney(total)} label="Extended BOM cost" />
      </div>
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Engineering release control</h2>
          <p className="mt-2 text-sm text-[#999]">
            {parts.length} master part records with quantities, manufacturing
            routers, CAD/CAM/CAE status, and verification evidence.
          </p>
        </div>
        <a className="button" href="/api/exports/engineering">
          Export manufacturing workbook
        </a>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["1", "Add the part", "Enter a part number, name, quantity, and make-or-buy choice."],
          ["2", "Add build steps", "For made parts, add the manufacturing operations in order."],
          ["3", "Verify and release", "Attach the drawing or CAD link, inspect it, and mark it ready."],
        ].map(([number, title, copy]) => (
          <div className="border border-[#333] bg-[#101010] p-4" key={number}>
            <span className="grid h-8 w-8 place-items-center bg-[#fd7803] font-black text-black">
              {number}
            </span>
            <strong className="mt-3 block text-sm text-white">{title}</strong>
            <p className="mt-1 text-xs leading-5 text-[#777]">{copy}</p>
          </div>
        ))}
      </div>
      <OnshapeBomImporter
        seasons={seasons.map((season) => ({ id: season.id, label: season.name, isDefault: season.isDefault }))}
        projects={projects.map((project) => ({ id: project.id, label: `${project.code} · ${project.name}` }))}
        subsystems={subsystems.map((subsystem) => ({ id: subsystem.id, label: `${subsystem.code} · ${subsystem.name}` }))}
      />
      <OpsCard title="Add a master part">
        <EngineeringPartForm
          members={people}
          seasons={seasons}
          projects={projects}
          subsystems={subsystems}
        />
      </OpsCard>
      <section className="grid gap-5">
        {parts.map((part) => {
          const routers = steps.filter((step) => step.partId === part.id);
          return (
            <details
              className="card p-6 open:border-[#fd7803]/45"
              key={part.id}
            >
              <summary className="cursor-pointer list-none">
                <div className="grid gap-5 md:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="tag border-[#fd7803]/50 text-[#fd7803]">
                        Qty {part.quantity}
                      </span>
                      <Status value={part.makeBuy} />
                      <Status value={part.lifecycleStatus} />
                      <Status value={part.verificationStatus} />
                    </div>
                    <h3 className="mt-3 text-2xl font-bold">
                      <span className="font-mono text-[#fd7803]">
                        {part.partNumber}
                      </span>{" "}
                      · {part.name}
                    </h3>
                    <p className="mt-2 text-sm text-[#999]">
                      {part.project} / {part.subsystem} · Rev {part.revision} ·
                      Qty {part.quantity} · {part.material || "Material TBD"}
                    </p>
                  </div>
                  <div className="text-right">
                    <strong className="text-xl text-[#fd7803]">
                      {centsToMoney(part.quantity * part.unitCostCents)}
                    </strong>
                    <p className="mt-1 text-xs text-[#777]">extended cost</p>
                  </div>
                </div>
              </summary>
              <div className="mt-7 grid gap-7 border-t border-[#333] pt-7">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <SmallMetric
                    label="CAD"
                    value={displayStatus(part.cadStatus)}
                  />
                  <SmallMetric
                    label="CAM"
                    value={displayStatus(part.camStatus)}
                  />
                  <SmallMetric
                    label="CAE"
                    value={displayStatus(part.caeStatus)}
                  />
                  <SmallMetric
                    label="Drawing"
                    value={displayStatus(part.drawingStatus)}
                  />
                  <SmallMetric
                    label="Verification"
                    value={displayStatus(part.verificationStatus)}
                  />
                </div>
                <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
                  <OpsCard
                    title="Manufacturing router"
                    subtitle={`${routers.length} operation${routers.length === 1 ? "" : "s"} · ${nameById.get(part.assignedToMemberId ?? "") ?? "Unassigned owner"}`}
                  >
                    <div className="grid gap-4">
                      {routers.map((step) => (
                        <div
                          className="rounded-xl border border-[#333] p-4"
                          key={step.id}
                        >
                          <div className="flex flex-wrap justify-between gap-3">
                            <strong>
                              {step.sequence}. {step.process}
                            </strong>
                            <Status value={step.status} />
                          </div>
                          <p className="mt-2 text-sm text-[#aaa]">
                            {step.machine || "Machine TBD"}
                            {step.setup ? ` · Setup: ${step.setup}` : ""}
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-[#888]">
                            {step.instructions || "No instructions yet."}
                          </p>
                          {step.inspectionCriteria && (
                            <p className="mt-2 text-sm text-[#fd7803]">
                              Inspect: {step.inspectionCriteria}
                            </p>
                          )}
                          <details className="mt-3">
                            <summary className="cursor-pointer text-xs font-semibold text-[#aaa]">
                              Edit operation
                            </summary>
                            <div className="mt-4">
                              <ManufacturingForm
                                step={step}
                                parts={parts}
                                members={people}
                              />
                              <DeleteForm
                                action={deleteManufacturingStep}
                                id={step.id}
                                label="Delete operation"
                              />
                            </div>
                          </details>
                        </div>
                      ))}
                      <div className="border-t border-[#333] pt-5">
                        <ManufacturingForm
                          selectedPartId={part.id}
                          parts={parts}
                          members={people}
                          defaultSequence={
                            routers.length
                              ? Math.max(...routers.map((step) => step.sequence)) + 10
                              : 10
                          }
                        />
                      </div>
                    </div>
                  </OpsCard>
                  <OpsCard title="Edit part record">
                    <EngineeringPartForm
                      part={part}
                      members={people}
                      seasons={seasons}
                      projects={projects}
                      subsystems={subsystems}
                    />
                    <DeleteForm
                      action={deleteEngineeringPart}
                      id={part.id}
                      label="Delete part and manufacturing router"
                    />
                  </OpsCard>
                </div>
              </div>
            </details>
          );
        })}
        {!parts.length && (
          <EmptyState
            title="No parts yet"
            body="Create the first part master record to begin the robot BOM."
          />
        )}
      </section>
    </div>
  );
}

function EngineeringPartForm({
  part,
  members: people,
  seasons,
  projects,
  subsystems,
}: {
  part?: Row<"parts">;
  members: Person[];
  seasons: (typeof engineeringSeasons.$inferSelect)[];
  projects: (typeof engineeringProjects.$inferSelect)[];
  subsystems: (typeof engineeringSubsystems.$inferSelect)[];
}) {
  const work = [
    "NOT_STARTED",
    "IN_PROGRESS",
    "READY_FOR_REVIEW",
    "APPROVED",
    "BLOCKED",
    "NOT_REQUIRED",
  ];
  return (
    <ActionForm
      action={saveEngineeringPart}
      successMessage={part ? "Part updated." : "Part added."}
      className="grid gap-5"
    >
      {part && <input type="hidden" name="id" value={part.id} />}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Season">
          <select
            className="input"
            name="seasonId"
            defaultValue={
              part?.seasonId ??
              seasons.find((season) => season.isDefault)?.id ??
              ""
            }
          >
            <option value="">Unassigned</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Shared project">
          <select
            className="input"
            name="engineeringProjectId"
            defaultValue={part?.engineeringProjectId ?? ""}
          >
            <option value="">Unassigned</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.code} · {project.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Shared subsystem">
          <select
            className="input"
            name="subsystemId"
            defaultValue={part?.subsystemId ?? ""}
          >
            <option value="">Unassigned</option>
            {subsystems.map((subsystem) => (
              <option key={subsystem.id} value={subsystem.id}>
                {subsystem.code} · {subsystem.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Project">
          <input
            className="input"
            name="project"
            defaultValue={part?.project ?? "VEX U"}
            required
          />
        </Field>
        <Field label="Part number">
          <input
            className="input"
            name="partNumber"
            defaultValue={part?.partNumber}
            required
          />
        </Field>
        <Field label="Part name">
          <input
            className="input"
            name="name"
            defaultValue={part?.name}
            required
          />
        </Field>
        <Field label="Subsystem">
          <input
            className="input"
            name="subsystem"
            defaultValue={part?.subsystem ?? "General"}
          />
        </Field>
        <Field label="Revision">
          <input
            className="input"
            name="revision"
            defaultValue={part?.revision ?? "A"}
          />
        </Field>
        <Field label="Quantity">
          <QuantityStepper defaultValue={part?.quantity ?? 1} />
        </Field>
        <Field label="Make / buy">
          <Select
            name="makeBuy"
            options={["MAKE", "BUY"]}
            value={part?.makeBuy}
          />
        </Field>
      </div>
      <details
        className="rounded-sm border border-[#333] bg-black/20 p-5 open:border-[#fd7803]/35"
        open={Boolean(part)}
      >
        <summary className="cursor-pointer font-semibold text-[#ddd]">
          {part
            ? "Engineering details, links, and release status"
            : "Optional details — material, owner, cost, and verification"}
        </summary>
        <p className="mt-2 text-xs leading-5 text-[#777]">
          The defaults are ready to use. Add these fields only when the part
          reaches that stage of the workflow.
        </p>
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Lifecycle">
            <Select
              name="lifecycleStatus"
              options={[
                "DESIGN",
                "RELEASED",
                "IN_MANUFACTURING",
                "READY",
                "OBSOLETE",
              ]}
              value={part?.lifecycleStatus}
            />
          </Field>
          <Field label="Material">
            <input
              className="input"
              name="material"
              defaultValue={part?.material}
            />
          </Field>
          <Field label="Stock size">
            <input
              className="input"
              name="stockSize"
              defaultValue={part?.stockSize}
            />
          </Field>
          <Field label="Manufacturing method">
            <input
              className="input"
              name="manufacturingMethod"
              placeholder="3-axis mill, lathe, print…"
              defaultValue={part?.manufacturingMethod}
            />
          </Field>
          <Field label="Supplier">
            <input
              className="input"
              name="supplier"
              defaultValue={part?.supplier}
            />
          </Field>
          <Field label="Unit cost">
            <input
              className="input"
              name="unitCost"
              type="number"
              min="0"
              step="0.01"
              defaultValue={part ? part.unitCostCents / 100 : 0}
            />
          </Field>
          <Field label="Lead time (days)">
            <input
              className="input"
              name="leadTimeDays"
              type="number"
              min="0"
              defaultValue={part?.leadTimeDays ?? 0}
            />
          </Field>
          <Field label="Owner">
            <select
              className="input"
              name="assignedToMemberId"
              defaultValue={part?.assignedToMemberId ?? ""}
            >
              <option value="">Unassigned</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due">
            <CalendarInput
              name="dueAt"
              type="datetime-local"
              defaultValue={toLocalInput(part?.dueAt)}
            />
          </Field>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          <Field label="CAD">
            <Select name="cadStatus" options={work} value={part?.cadStatus} />
          </Field>
          <Field label="CAM">
            <Select name="camStatus" options={work} value={part?.camStatus} />
          </Field>
          <Field label="CAE">
            <Select
              name="caeStatus"
              options={work}
              value={part?.caeStatus ?? "NOT_REQUIRED"}
            />
          </Field>
          <Field label="Drawing">
            <Select
              name="drawingStatus"
              options={work}
              value={part?.drawingStatus}
            />
          </Field>
          <Field label="Verification">
            <Select
              name="verificationStatus"
              options={verificationStatuses}
              value={part?.verificationStatus}
            />
          </Field>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <Field label="CAD URL">
            <input
              className="input"
              name="cadUrl"
              type="url"
              defaultValue={part?.cadUrl ?? ""}
            />
          </Field>
          <Field label="Drawing URL">
            <input
              className="input"
              name="drawingUrl"
              type="url"
              defaultValue={part?.drawingUrl ?? ""}
            />
          </Field>
          <Field label="Source / vendor URL">
            <input
              className="input"
              name="sourceUrl"
              type="url"
              defaultValue={part?.sourceUrl ?? ""}
            />
          </Field>
        </div>
        <Field label="Description">
          <textarea
            className="input min-h-20"
            name="description"
            defaultValue={part?.description}
          />
        </Field>
        <Field label="Verification notes / change record">
          <textarea
            className="input min-h-24"
            name="notes"
            defaultValue={part?.notes}
          />
        </Field>
      </details>
      <button className="button w-fit">
        {part ? "Save part" : "Add part"}
      </button>
    </ActionForm>
  );
}
function ManufacturingForm({
  step,
  parts,
  members: people,
  selectedPartId,
  defaultSequence = 10,
}: {
  step?: Row<"steps">;
  parts: Row<"parts">[];
  members: Person[];
  selectedPartId?: string;
  defaultSequence?: number;
}) {
  return (
    <ActionForm
      action={saveManufacturingStep}
      successMessage={
        step ? "Operation updated." : "Manufacturing operation added."
      }
      className="grid gap-4"
    >
      {step && <input type="hidden" name="id" value={step.id} />}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Part">
          <select
            className="input"
            name="partId"
            defaultValue={step?.partId ?? selectedPartId}
            required
          >
            {parts.map((part) => (
              <option key={part.id} value={part.id}>
                {part.partNumber} · {part.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sequence">
          <input
            className="input"
            name="sequence"
            type="number"
            min="1"
            step="10"
            defaultValue={step?.sequence ?? defaultSequence}
          />
        </Field>
        <Field label="Process">
          <input
            className="input"
            name="process"
            placeholder="Mill profile, deburr, inspect…"
            defaultValue={step?.process}
            required
          />
        </Field>
        <Field label="Machine / workcenter">
          <input
            className="input"
            name="machine"
            defaultValue={step?.machine}
          />
        </Field>
        <Field label="Status">
          <Select name="status" options={workStatuses} value={step?.status} />
        </Field>
        <Field label="Assigned member">
          <select
            className="input"
            name="assignedToMemberId"
            defaultValue={step?.assignedToMemberId ?? ""}
          >
            <option value="">Unassigned</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Setup">
        <textarea
          className="input min-h-20"
          name="setup"
          defaultValue={step?.setup}
        />
      </Field>
      <Field label="Instructions">
        <textarea
          className="input min-h-24"
          name="instructions"
          defaultValue={step?.instructions}
        />
      </Field>
      <Field label="Inspection criteria">
        <textarea
          className="input min-h-20"
          name="inspectionCriteria"
          defaultValue={step?.inspectionCriteria}
        />
      </Field>
      <button className="button w-fit">
        {step ? "Save operation" : "Add operation"}
      </button>
    </ActionForm>
  );
}

function GlossaryWorkspace({ terms }: { terms: Row<"glossary">[] }) {
  const categories = [...new Set(terms.map((term) => term.category))];
  return (
    <div className="grid gap-8">
      <div className="grid gap-5 sm:grid-cols-3">
        <Metric value={String(terms.length)} label="Total terms" />
        <Metric
          value={String(terms.filter((term) => term.published).length)}
          label="Published"
        />
        <Metric value={String(categories.length)} label="Categories" />
      </div>
      <OpsCard
        title="Add an organization term"
        subtitle="Define acronyms, roles, systems, processes, and common metrics in plain language."
      >
        <GlossaryForm />
      </OpsCard>
      <section className="grid gap-5 md:grid-cols-2">
        {terms.map((term) => (
          <details className="card p-6 open:border-[#fd7803]/45" key={term.id}>
            <summary className="cursor-pointer list-none">
              <div className="flex justify-between gap-4">
                <div>
                  <div className="flex gap-2">
                    <span className="tag">{term.category}</span>
                    <Status value={term.published ? "PUBLISHED" : "DRAFT"} />
                  </div>
                  <h2 className="mt-3 text-xl font-bold">
                    {term.acronym ? `${term.acronym} — ` : ""}
                    {term.term}
                  </h2>
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-[#aaa]">
                {term.definition}
              </p>
            </summary>
            <div className="mt-6 border-t border-[#333] pt-6">
              <GlossaryForm term={term} />
              <DeleteForm
                action={deleteGlossaryTerm}
                id={term.id}
                label="Delete term"
              />
            </div>
          </details>
        ))}
        {!terms.length && (
          <EmptyState
            title="No glossary terms"
            body="Add the first shared definition above."
          />
        )}
      </section>
    </div>
  );
}
function GlossaryForm({ term }: { term?: Row<"glossary"> }) {
  return (
    <ActionForm
      action={saveGlossaryTerm}
      successMessage={term ? "Term updated." : "Term added."}
      className="grid gap-5"
    >
      {term && <input type="hidden" name="id" value={term.id} />}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Term">
          <input
            className="input"
            name="term"
            defaultValue={term?.term}
            required
          />
        </Field>
        <Field label="Acronym">
          <input
            className="input"
            name="acronym"
            defaultValue={term?.acronym}
          />
        </Field>
        <Field label="Category">
          <input
            className="input"
            name="category"
            defaultValue={term?.category ?? "General"}
          />
        </Field>
        <Field label="Owning role">
          <input
            className="input"
            name="ownerRole"
            defaultValue={term?.ownerRole}
          />
        </Field>
      </div>
      <Field label="Definition">
        <textarea
          className="input min-h-24"
          name="definition"
          defaultValue={term?.definition}
          required
        />
      </Field>
      <Field label="How the team uses it">
        <textarea
          className="input min-h-20"
          name="usage"
          defaultValue={term?.usage}
        />
      </Field>
      <Field label="Related terms (comma separated)">
        <input
          className="input"
          name="relatedTerms"
          defaultValue={term?.relatedTerms.join(", ")}
        />
      </Field>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="published"
          defaultChecked={term?.published ?? true}
        />{" "}
        Publish in the member hub
      </label>
      <button className="button w-fit">
        {term ? "Save term" : "Add term"}
      </button>
    </ActionForm>
  );
}

function OpsCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-6 md:p-8">
      <h2 className="text-xl font-bold">{title}</h2>
      {subtitle && (
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[#999]">
          {subtitle}
        </p>
      )}
      <div className="mt-6">{children}</div>
    </section>
  );
}
function RecordPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-6">
      <h3 className="text-lg font-bold">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}
function ProcessStep({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <span className="font-mono text-sm font-bold text-[#fd7803]">
        {number}
      </span>
      <h3 className="mt-3 font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#999]">{body}</p>
    </div>
  );
}
function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="card min-h-32 p-6">
      <strong className="text-2xl text-[#fd7803]">{value}</strong>
      <p className="mt-3 font-mono text-[.65rem] uppercase tracking-wider text-[#888]">
        {label}
      </p>
    </div>
  );
}
function SmallMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-[#333] p-4">
      <p className="text-xs uppercase tracking-wider text-[#777]">{label}</p>
      <strong className="mt-2 block text-sm text-[#ddd]">{value}</strong>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Select({
  name,
  options,
  value,
  ariaLabel,
}: {
  name: string;
  options: readonly string[];
  value?: string;
  ariaLabel?: string;
}) {
  return (
    <select
      className="input"
      name={name}
      defaultValue={value ?? options[0]}
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <option value={option} key={option}>
          {displayStatus(option)}
        </option>
      ))}
    </select>
  );
}
function FinanceCategorySelect({
  value,
  ariaLabel,
}: {
  value?: string;
  ariaLabel?: string;
}) {
  const options =
    value && !(financeCategories as readonly string[]).includes(value)
      ? [value, ...financeCategories]
      : financeCategories;
  return (
    <select
      className="input"
      name="category"
      defaultValue={value ?? "Robot parts"}
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <option value={option} key={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
function Status({ value }: { value: string }) {
  return <span className="tag">{displayStatus(value)}</span>;
}
function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-10 text-center">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-3 text-sm text-[#888]">{body}</p>
    </div>
  );
}
function MeetingText({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-[#777]">{title}</p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#bbb]">
        {text || "Not recorded."}
      </p>
    </div>
  );
}
function DeleteForm({
  action,
  id,
  label,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  label: string;
}) {
  return (
    <ActionForm
      action={action}
      successMessage="Record deleted."
      className="mt-5 border-t border-[#333] pt-4"
    >
      <input type="hidden" name="id" value={id} />
      <button className="text-sm text-red-300 hover:text-red-200">
        {label}
      </button>
    </ActionForm>
  );
}
function toLocalInput(date?: Date | null) {
  if (!date) return undefined;
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

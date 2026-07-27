import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { asc, desc, eq, isNull } from "drizzle-orm";
import {
  AlertTriangle,
  BellRing,
  Boxes,
  Gauge,
  LayoutTemplate,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getDb } from "@/db";
import {
  contributions,
  designChanges,
  engineeringNotebookEntries,
  engineeringParts,
  engineeringProjects,
  engineeringSeasons,
  engineeringSubsystems,
  financeEntries,
  financePlans,
  internalDocuments,
  inquiries,
  inventoryItems,
  manufacturingSteps,
  members,
  memberTasks,
  operationsHubRecords,
  publicFormResponses,
} from "@/db/schema";
import { requireAdminAccess } from "@/lib/auth";
import { hasPermission, type PermissionKey } from "@/lib/permissions";
import { findDuplicateGroups } from "@/lib/control-center";
import { DashboardNavigation } from "@/components/dashboard-navigation";
import { ActionForm } from "@/components/action-form";
import { CalendarInput } from "@/components/calendar-input";
import {
  DecisionMatrixEditor,
  type DecisionMatrixInitial,
} from "@/components/decision-matrix-editor";
import { ImportActionForm } from "@/components/import-action-form";
import { PrintButton } from "@/components/print-button";
import { SponsorWorkspace } from "@/components/sponsor-workspace";
import { TeamOsWorkspace } from "@/components/team-os-workspace";
import { getGitHubRepoAnalytics } from "@/lib/github-analytics";
import {
  archiveHubRecord,
  importDecisionMatrix,
  runOperationsAutomation,
  saveHubRecord,
} from "./actions";

export const metadata: Metadata = {
  title: "Leadership control center",
  robots: { index: false, follow: false },
};

const tabs = [
  "dashboard",
  "people",
  "decisions",
  "shop",
  "responsibility",
  "automation",
  "templates",
  "sponsors",
  "team-os",
] as const;
type Tab = (typeof tabs)[number];
type HubRecord = typeof operationsHubRecords.$inferSelect;
type Person = { id: string; name: string; role: string };
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://210robotics.com";

export default async function ControlCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; member?: string; view?: string }>;
}) {
  const actor = await requireAdminAccess();
  const params = await searchParams;
  const can = (permission: PermissionKey) =>
    hasPermission(actor.accessRole, permission, actor.permissionOverrides);
  const leadership = [
    "LEAD",
    "DIRECTOR",
    "OFFICER",
    "FULL_ADMIN",
    "SUPER_ADMIN",
  ].includes(actor.accessRole);
  const allowedTabs = tabs.filter((candidate) => {
    if (candidate === "dashboard") return leadership;
    if (candidate === "people")
      return can("members.edit") || can("tasks.manage");
    if (candidate === "decisions" || candidate === "shop")
      return can("engineering.manage");
    if (candidate === "responsibility" || candidate === "automation")
      return can("tasks.manage") || can("seasons.manage");
    if (candidate === "templates")
      return can("tasks.manage") || can("content.manage");
    if (candidate === "sponsors")
      return can("sponsors.manage") || can("finance.manage");
    if (candidate === "team-os")
      return (
        leadership ||
        can("tasks.manage") ||
        can("engineering.manage") ||
        can("members.edit") ||
        can("notebook.manage") ||
        can("seasons.manage") ||
        can("content.manage")
      );
    return false;
  });
  if (!allowedTabs.length) redirect("/admin");
  const tab: Tab = allowedTabs.includes(params.tab as Tab)
    ? (params.tab as Tab)
    : (allowedTabs[0] ?? "dashboard");
  const db = getDb();
  const [
    people,
    records,
    parts,
    steps,
    tasks,
    inventory,
    plans,
    entries,
    projects,
    seasons,
    subsystems,
    notebook,
    work,
    changes,
    documents,
    contacts,
    formResponses,
  ] = await Promise.all([
    db
      .select({
        id: members.id,
        name: members.displayName,
        role: members.organizationRole,
      })
      .from(members)
      .where(eq(members.status, "ACTIVE"))
      .orderBy(asc(members.displayName)),
    db
      .select()
      .from(operationsHubRecords)
      .where(isNull(operationsHubRecords.archivedAt))
      .orderBy(desc(operationsHubRecords.updatedAt)),
    db
      .select()
      .from(engineeringParts)
      .orderBy(asc(engineeringParts.project), asc(engineeringParts.partNumber)),
    db
      .select()
      .from(manufacturingSteps)
      .orderBy(asc(manufacturingSteps.sequence)),
    db
      .select()
      .from(memberTasks)
      .where(isNull(memberTasks.archivedAt))
      .orderBy(memberTasks.dueAt, desc(memberTasks.createdAt)),
    db.select().from(inventoryItems).orderBy(asc(inventoryItems.name)),
    db.select().from(financePlans).orderBy(desc(financePlans.updatedAt)),
    db.select().from(financeEntries).orderBy(desc(financeEntries.occurredAt)),
    db
      .select()
      .from(engineeringProjects)
      .orderBy(asc(engineeringProjects.code)),
    db
      .select()
      .from(engineeringSeasons)
      .orderBy(
        desc(engineeringSeasons.isDefault),
        desc(engineeringSeasons.startsAt),
      ),
    db
      .select()
      .from(engineeringSubsystems)
      .orderBy(asc(engineeringSubsystems.code)),
    db
      .select()
      .from(engineeringNotebookEntries)
      .orderBy(desc(engineeringNotebookEntries.updatedAt)),
    db
      .select()
      .from(contributions)
      .where(isNull(contributions.deletedAt))
      .orderBy(desc(contributions.contributionDate)),
    db.select().from(designChanges).orderBy(desc(designChanges.updatedAt)),
    db
      .select()
      .from(internalDocuments)
      .where(isNull(internalDocuments.archivedAt))
      .orderBy(desc(internalDocuments.updatedAt)),
    db
      .select({ id: inquiries.id, email: inquiries.email })
      .from(inquiries)
      .orderBy(desc(inquiries.createdAt)),
    db
      .select({
        id: publicFormResponses.id,
        email: publicFormResponses.respondentEmail,
      })
      .from(publicFormResponses)
      .orderBy(desc(publicFormResponses.updatedAt)),
  ]);
  const names = new Map(people.map((person) => [person.id, person.name]));
  const now = new Date();
  const overdue = tasks.filter(
    (task) => task.status !== "DONE" && task.dueAt && task.dueAt < now,
  );
  const blocked = tasks.filter((task) => task.status === "BLOCKED");
  const lowStock = inventory.filter(
    (item) =>
      item.status === "ACTIVE" && item.quantityOnHand <= item.reorderPoint,
  );
  const openIssues = records.filter(
    (item) =>
      item.kind === "ISSUE" && !["RESOLVED", "CLOSED"].includes(item.status),
  );
  const notifications = records.filter((item) => item.kind === "NOTIFICATION");
  const suggestions = records.filter(
    (item) => item.kind === "NOTEBOOK_SUGGESTION",
  );
  const sponsorRecords = records.filter((item) =>
    item.kind.startsWith("SPONSOR_"),
  );
  const defaultSeason =
    seasons.find((season) => season.isDefault) ?? seasons[0];
  const duplicates = findDuplicateGroups([
    ...parts.map((item) => ({
      type: "Part",
      id: item.id,
      label: `${item.partNumber} ${item.name}`,
    })),
    ...tasks.map((item) => ({ type: "Task", id: item.id, label: item.title })),
    ...documents.map((item) => ({
      type: "File",
      id: item.id,
      label: item.title || item.originalFilename,
    })),
    ...contacts
      .filter((item) => item.email)
      .map((item) => ({
        type: "Contact",
        id: item.id,
        label: item.email.toLowerCase(),
      })),
    ...formResponses
      .filter((item) => item.email)
      .map((item) => ({
        type: "Form response",
        id: item.id,
        label: item.email.toLowerCase(),
      })),
  ]);
  const planHealth = plans.map((plan) => {
    const planEntries = entries.filter(
      (item) => item.planId === plan.id && item.status !== "CANCELED",
    );
    const income = planEntries
      .filter((item) => item.kind === "INCOME")
      .reduce((sum, item) => sum + item.amountCents, 0);
    const expense = planEntries
      .filter((item) => item.kind !== "INCOME")
      .reduce((sum, item) => sum + item.amountCents, 0);
    return { ...plan, balance: income - expense, expense };
  });
  const teamOsRecords = records.filter((item) =>
    [
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
    ].includes(item.kind),
  );
  const github = await getGitHubRepoAnalytics(
    teamOsRecords
      .filter((item) => item.kind === "GITHUB_REPO")
      .map((item) => String(item.data.repoUrl || item.sourceUrl || ""))
      .filter(Boolean),
  );
  return (
    <main className="min-h-screen bg-[#090909] grid-bg">
      <div className="shell admin-workspace py-8 md:py-12">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow">Leadership and operations</p>
            <h1 className="mt-3 text-4xl font-bold tracking-[-.04em] md:text-5xl">
              210 Control Center
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[#aaa]">
              One view for team health, engineering decisions, recognition,
              manufacturing, responsibility, sponsors, templates, and proactive
              follow-up.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="button secondary" href="/admin/operations">
              Operations
            </Link>
            <Link className="button secondary" href="/portal">
              Member portal
            </Link>
          </div>
        </header>
        <DashboardNavigation
          current={tab}
          label="Control center sections"
          items={allowedTabs.map((value) => ({
            value,
            label: tabLabel(value),
            href: `/admin/control-center?tab=${value}`,
          }))}
        />
        {tab === "dashboard" && (
          <LeadershipDashboard
            {...{
              overdue,
              blocked,
              lowStock,
              openIssues,
              notifications,
              duplicates,
              planHealth,
              projects,
              notebook,
              tasks,
              parts,
              inventory,
              names,
              defaultSeason,
            }}
          />
        )}
        {tab === "people" && (
          <PeopleWorkspace
            people={people}
            records={records}
            tasks={tasks}
            notebook={notebook}
            work={work}
            changes={changes}
            selectedId={params.member}
            names={names}
          />
        )}
        {tab === "decisions" && (
          <DecisionWorkspace
            people={people}
            records={records}
            seasons={seasons}
            projects={projects}
            subsystems={subsystems}
            parts={parts}
            names={names}
          />
        )}
        {tab === "shop" && (
          <ShopWorkspace
            parts={parts}
            steps={steps}
            inventory={inventory}
            names={names}
          />
        )}
        {tab === "responsibility" && (
          <ResponsibilityWorkspace
            records={records}
            seasons={seasons}
            projects={projects}
            subsystems={subsystems}
            names={names}
          />
        )}
        {tab === "automation" && (
          <AutomationWorkspace
            records={records}
            notifications={notifications}
            suggestions={suggestions}
          />
        )}
        {tab === "templates" && <TemplateWorkspace records={records} />}
        {tab === "sponsors" && (
          <SponsorWorkspace records={sponsorRecords} view={params.view} />
        )}
        {tab === "team-os" && (
          <TeamOsWorkspace
            view={params.view}
            records={teamOsRecords}
            people={people}
            seasons={seasons}
            projects={projects}
            subsystems={subsystems}
            tasks={tasks}
            notebook={notebook}
            changes={changes}
            names={names}
            github={github}
            uploaderId={actor.id}
          />
        )}
      </div>
    </main>
  );
}

function LeadershipDashboard(props: {
  overdue: (typeof memberTasks.$inferSelect)[];
  blocked: (typeof memberTasks.$inferSelect)[];
  lowStock: (typeof inventoryItems.$inferSelect)[];
  openIssues: HubRecord[];
  notifications: HubRecord[];
  duplicates: { type: string; label: string; count: number }[];
  planHealth: (typeof financePlans.$inferSelect & {
    balance: number;
    expense: number;
  })[];
  projects: (typeof engineeringProjects.$inferSelect)[];
  notebook: (typeof engineeringNotebookEntries.$inferSelect)[];
  tasks: (typeof memberTasks.$inferSelect)[];
  parts: (typeof engineeringParts.$inferSelect)[];
  inventory: (typeof inventoryItems.$inferSelect)[];
  names: Map<string, string>;
  defaultSeason?: typeof engineeringSeasons.$inferSelect;
}) {
  const projectHealth = props.projects.map((project) => {
    const tasks = props.tasks.filter(
      (item) => item.engineeringProjectId === project.id,
    );
    const entries = props.notebook.filter(
      (item) => item.projectId === project.id,
    );
    const parts = props.parts.filter(
      (item) => item.engineeringProjectId === project.id,
    );
    const done = tasks.filter((item) => item.status === "DONE").length;
    const completeness = Math.min(
      100,
      Math.round(
        ((entries.length * 12 +
          done * 4 +
          parts.filter((item) => item.verificationStatus === "VERIFIED")
            .length *
            3) /
          Math.max(1, parts.length + tasks.length)) *
          10,
      ),
    );
    return { project, tasks, entries, parts, completeness };
  });
  return (
    <div className="grid gap-7">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric
          icon={<AlertTriangle />}
          value={props.overdue.length}
          label="Missed deadlines"
          tone="danger"
        />
        <Metric
          icon={<ShieldCheck />}
          value={props.blocked.length}
          label="Blocked work"
          tone="warning"
        />
        <Metric
          icon={<Boxes />}
          value={props.lowStock.length}
          label="Low-stock items"
          tone="warning"
        />
        <Metric
          icon={<Gauge />}
          value={props.openIssues.length}
          label="Open failures / issues"
          tone="danger"
        />
        <Metric
          icon={<BellRing />}
          value={
            props.notifications.filter((item) => item.status === "UNREAD")
              .length
          }
          label="Active reminders"
        />
        <Metric
          icon={<Search />}
          value={props.duplicates.length}
          label="Duplicate groups"
        />
      </div>
      <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <Panel
          title="Leadership attention"
          subtitle="The work most likely to affect delivery, budget, or staffing."
        >
          <div className="divide-y divide-[#2e2e2e]">
            {[
              ...props.overdue.map((item) => ({
                title: item.title,
                detail: `Overdue · ${props.names.get(item.assignedToMemberId) ?? "Unassigned"}`,
                href: "/admin/operations?tool=tasks",
              })),
              ...props.openIssues.map((item) => ({
                title: item.title,
                detail: `${item.priority} · ${item.status}`,
                href: "/admin/control-center?tab=decisions",
              })),
              ...props.lowStock.map((item) => ({
                title: item.name,
                detail: `${item.quantityOnHand} on hand · reorder at ${item.reorderPoint}`,
                href: "/admin/operations?tool=inventory",
              })),
            ]
              .slice(0, 14)
              .map((item, index) => (
                <Link
                  href={item.href}
                  key={`${item.title}-${index}`}
                  className="flex items-center justify-between gap-4 py-4 hover:text-[#fd7803]"
                >
                  <div>
                    <strong>{item.title}</strong>
                    <p className="mt-1 text-xs text-[#777]">{item.detail}</p>
                  </div>
                  <span aria-hidden>→</span>
                </Link>
              ))}
            {!props.overdue.length &&
              !props.openIssues.length &&
              !props.lowStock.length && (
                <Empty text="Nothing critical needs attention." />
              )}
          </div>
        </Panel>
        <Panel
          title="Budget watch"
          subtitle="Live totals from active budget plans."
        >
          <div className="grid gap-3">
            {props.planHealth.slice(0, 6).map((plan) => {
              const over =
                plan.maximumBudgetCents > 0 &&
                plan.expense > plan.maximumBudgetCents;
              return (
                <div
                  className="border border-[#333] bg-[#111] p-4"
                  key={plan.id}
                >
                  <div className="flex justify-between gap-3">
                    <strong>{plan.name}</strong>
                    <span
                      className={over ? "text-red-400" : "text-emerald-400"}
                    >
                      {money(plan.balance)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[#777]">
                    Spent {money(plan.expense)} of{" "}
                    {plan.maximumBudgetCents
                      ? money(plan.maximumBudgetCents)
                      : "no maximum"}
                  </p>
                </div>
              );
            })}
            <Link
              className="button secondary mt-2"
              href="/admin/operations?tool=finance"
            >
              Open finance
            </Link>
          </div>
        </Panel>
      </section>
      <Panel
        title="Project health and notebook completeness"
        subtitle={`Current season: ${props.defaultSeason?.name ?? "Not selected"}. Scores combine notebook pages, completed work, and verified parts.`}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projectHealth.map(
            ({ project, tasks, entries, parts, completeness }) => (
              <article
                className="border border-[#333] bg-[#111] p-5"
                key={project.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="tag">{project.code}</span>
                    <h3 className="mt-3 font-bold">{project.name}</h3>
                  </div>
                  <strong className="text-2xl text-[#fd7803]">
                    {completeness}%
                  </strong>
                </div>
                <div className="mt-4 h-2 bg-[#272727]">
                  <div
                    className="h-full bg-[#fd7803]"
                    style={{ width: `${completeness}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-[#777]">
                  {entries.length} notebook pages ·{" "}
                  {tasks.filter((item) => item.status === "DONE").length}/
                  {tasks.length} tasks · {parts.length} parts
                </p>
              </article>
            ),
          )}
        </div>
      </Panel>
      {props.duplicates.length > 0 && (
        <Panel
          title="Possible duplicates"
          subtitle="Review these repeated names before creating more records."
        >
          <div className="flex flex-wrap gap-2">
            {props.duplicates.map((item) => (
              <span className="tag" key={`${item.type}-${item.label}`}>
                {item.type}: {item.label} × {item.count}
              </span>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function PeopleWorkspace({
  people,
  records,
  tasks,
  notebook,
  work,
  changes,
  selectedId,
  names,
}: {
  people: Person[];
  records: HubRecord[];
  tasks: (typeof memberTasks.$inferSelect)[];
  notebook: (typeof engineeringNotebookEntries.$inferSelect)[];
  work: (typeof contributions.$inferSelect)[];
  changes: (typeof designChanges.$inferSelect)[];
  selectedId?: string;
  names: Map<string, string>;
}) {
  const selected =
    people.find((person) => person.id === selectedId) ?? people[0];
  const recognition = records.filter((item) => item.kind === "RECOGNITION");
  const portfolio = selected
    ? [
        ...tasks
          .filter(
            (item) =>
              item.assignedToMemberId === selected.id && item.status === "DONE",
          )
          .map((item) => ({
            type: "Completed task",
            title: item.title,
            date: item.completedAt ?? item.updatedAt,
            detail: item.description,
          })),
        ...notebook
          .filter(
            (item) =>
              item.createdByMemberId === selected.id ||
              item.updatedByMemberId === selected.id,
          )
          .map((item) => ({
            type: "Notebook",
            title: item.title,
            date: item.updatedAt,
            detail: item.objective || item.results,
          })),
        ...changes
          .filter((item) => item.requestedByMemberId === selected.id)
          .map((item) => ({
            type: "Design",
            title: item.title,
            date: item.updatedAt,
            detail: item.description,
          })),
        ...work
          .filter((item) => item.memberId === selected.id)
          .map((item) => ({
            type: item.category,
            title: item.title,
            date: item.contributionDate,
            detail: item.description,
          })),
      ].sort((a, b) => b.date.getTime() - a.date.getTime())
    : [];
  return (
    <div className="grid gap-7">
      <div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
        <Panel
          title="Member contribution portfolio"
          subtitle="Generated automatically from approved tasks, notebook work, designs, code, outreach, and recorded contributions."
        >
          <div className="grid gap-3">
            <label className="field">
              <span>Member</span>
              <select
                className="input"
                defaultValue={selected?.id}
                onChange={undefined}
              >
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} · {person.role}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              {people.map((person) => (
                <Link
                  className={
                    person.id === selected?.id ? "button" : "button secondary"
                  }
                  href={`/admin/control-center?tab=people&member=${person.id}`}
                  key={person.id}
                >
                  {person.name}
                </Link>
              ))}
            </div>
          </div>
        </Panel>
        <Panel
          title={selected ? `${selected.name}'s portfolio` : "Portfolio"}
          subtitle={`${portfolio.length} verified contribution records.`}
        >
          <div className="max-h-[540px] divide-y divide-[#2d2d2d] overflow-y-auto">
            {portfolio.map((item, index) => (
              <article
                className="py-4"
                key={`${item.type}-${item.title}-${index}`}
              >
                <div className="flex flex-wrap gap-2">
                  <span className="tag">{item.type}</span>
                  <span className="text-xs text-[#777]">
                    {item.date.toLocaleDateString()}
                  </span>
                </div>
                <h3 className="mt-2 font-bold">{item.title}</h3>
                {item.detail && (
                  <p className="mt-2 text-sm leading-6 text-[#999]">
                    {item.detail}
                  </p>
                )}
              </article>
            ))}
            {!portfolio.length && (
              <Empty text="No approved portfolio work is recorded yet." />
            )}
          </div>
        </Panel>
      </div>
      <div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
        <Panel
          title="Add recognition"
          subtitle="Milestones, certifications, contributions, and leadership recognition become part of the member portfolio."
        >
          <RecordForm kind="RECOGNITION">
            <Field label="Recognition title">
              <input className="input" name="title" required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Member">
                <PersonSelect people={people} name="subjectMemberId" required />
              </Field>
              <Field label="Type">
                <select className="input" name="category">
                  <option>MILESTONE</option>
                  <option>CERTIFICATION</option>
                  <option>CONTRIBUTION</option>
                  <option>LEADERSHIP</option>
                  <option>SAFETY</option>
                </select>
              </Field>
            </div>
            <OptionalFields>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Awarded on">
                  <CalendarInput name="occurredAt" />
                </Field>
                <Field label="Expires">
                  <CalendarInput name="dueAt" />
                </Field>
              </div>
              <Field label="Notes">
                <textarea className="input min-h-24" name="description" />
              </Field>
              <Field label="Evidence or certificate URL">
                <input className="input" type="url" name="sourceUrl" />
              </Field>
            </OptionalFields>
          </RecordForm>
        </Panel>
        <Panel
          title="Recognition board"
          subtitle="Current team accomplishments and credentials."
        >
          <RecordList records={recognition} names={names} />
        </Panel>
      </div>
    </div>
  );
}

function DecisionWorkspace({
  people,
  records,
  seasons,
  projects,
  subsystems,
  parts,
  names,
}: {
  people: Person[];
  records: HubRecord[];
  seasons: (typeof engineeringSeasons.$inferSelect)[];
  projects: (typeof engineeringProjects.$inferSelect)[];
  subsystems: (typeof engineeringSubsystems.$inferSelect)[];
  parts: (typeof engineeringParts.$inferSelect)[];
  names: Map<string, string>;
}) {
  const matrices = records.filter((item) => item.kind === "DECISION_MATRIX");
  const issues = records.filter((item) => item.kind === "ISSUE");
  const seasonChoices = seasons.map((item) => ({
    id: item.id,
    label: item.name,
  }));
  const projectChoices = projects.map((item) => ({
    id: item.id,
    label: `${item.code} · ${item.name}`,
  }));
  const subsystemChoices = subsystems.map((item) => ({
    id: item.id,
    label: `${item.code} · ${item.name}`,
  }));
  return (
    <div className="grid gap-7">
      <Panel
        title="Concept comparison matrix"
        subtitle="Add design rows and decision criteria, choose how each variable should be evaluated, and let the weighted decider rank the concepts live."
      >
        <DecisionMatrixEditor
          seasons={seasonChoices}
          projects={projectChoices}
          subsystems={subsystemChoices}
        />
      </Panel>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title="Import a decision matrix"
          subtitle="Upload an Excel, CSV, or TSV matrix. Use Design or Concept in the first column, criteria across the top, and optional Weight and Goal rows."
        >
          <ImportActionForm
            action={importDecisionMatrix}
            className="grid gap-4"
          >
            <Field label="Decision matrix file">
              <input
                className="input"
                name="file"
                type="file"
                accept=".xlsx,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values"
                required
              />
            </Field>
            <Field label="Decision title (optional)">
              <input
                className="input"
                name="title"
                placeholder="Uses the file name when blank"
              />
            </Field>
            <ScopeFields {...{ seasons, projects, subsystems }} />
            <button className="button w-fit">Import and rank designs</button>
          </ImportActionForm>
        </Panel>
        <Panel
          title="Engineering issue / failure tracker"
          subtitle="Capture tests that fail, build issues, root cause, corrective action, and verification."
        >
          <RecordForm kind="ISSUE">
            <Field label="Issue / failed test">
              <input className="input" name="title" required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Severity">
                <select className="input" name="priority">
                  <option>CRITICAL</option>
                  <option>HIGH</option>
                  <option>NORMAL</option>
                  <option>LOW</option>
                </select>
              </Field>
              <Field label="Status">
                <select className="input" name="status">
                  <option>OPEN</option>
                  <option>FAILED</option>
                  <option>INVESTIGATING</option>
                  <option>FIX_IN_PROGRESS</option>
                  <option>VERIFYING</option>
                  <option>RESOLVED</option>
                </select>
              </Field>
              <Field label="Owner">
                <PersonSelect people={people} name="ownerMemberId" />
              </Field>
              <Field label="Due">
                <CalendarInput type="datetime-local" name="dueAt" />
              </Field>
            </div>
            <OptionalFields>
              <ScopeFields {...{ seasons, projects, subsystems }} />
            <Field label="Related part">
              <select className="input" name="partId">
                <option value="">None</option>
                {parts.map((part) => (
                  <option key={part.id} value={part.id}>
                    {part.partNumber} · {part.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Observed behavior">
              <textarea className="input min-h-24" name="description" />
            </Field>
            <Field label="Root cause / hypothesis">
              <textarea className="input min-h-20" name="rootCause" />
            </Field>
            <Field label="Resolution / verification">
              <textarea className="input min-h-20" name="resolution" />
            </Field>
            </OptionalFields>
          </RecordForm>
        </Panel>
      </div>
      <Panel
        title="Decision history"
        subtitle="Open any saved comparison to change criteria, add designs, update weights, and recalculate the recommended concept."
      >
        <div className="grid gap-4">
          {matrices.map((record) => {
            const initial = {
              id: record.id,
              title: record.title,
              criteria: String(record.data.criteria ?? ""),
              options: String(record.data.options ?? ""),
              recommendation: String(record.data.recommendation ?? ""),
              seasonId: record.seasonId,
              projectId: record.projectId,
              subsystemId: record.subsystemId,
            } satisfies DecisionMatrixInitial;
            return (
              <details
                className="border border-[#333] bg-[#0d0d0d] p-4 open:border-[#fd7803]/45 sm:p-5"
                key={record.id}
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{record.title}</h3>
                      <p className="mt-1 text-xs text-[#888]">
                        Recommended:{" "}
                        <strong className="text-[#fd7803]">
                          {String(record.data.winner || "Not calculated")}
                        </strong>
                      </p>
                    </div>
                    <span className="tag">{record.status}</span>
                  </div>
                </summary>
                <div className="mt-5 grid gap-4 border-t border-[#333] pt-5">
                  <DecisionMatrixEditor
                    initial={initial}
                    seasons={seasonChoices}
                    projects={projectChoices}
                    subsystems={subsystemChoices}
                  />
                  <ActionForm
                    action={archiveHubRecord}
                    successMessage="Decision matrix archived."
                    className="border-t border-[#333] pt-4"
                  >
                    <input type="hidden" name="id" value={record.id} />
                    <button className="text-xs font-semibold text-red-300">
                      Archive decision matrix
                    </button>
                  </ActionForm>
                </div>
              </details>
            );
          })}
          {!matrices.length && <Empty text="No decision matrices yet." />}
        </div>
      </Panel>
      <div className="grid gap-5">
        <Panel
          title="Issue queue"
          subtitle="Open and resolved engineering learning."
        >
          <RecordList records={issues} names={names} />
        </Panel>
      </div>
    </div>
  );
}

async function ShopWorkspace({
  parts,
  steps,
  inventory,
  names,
}: {
  parts: (typeof engineeringParts.$inferSelect)[];
  steps: (typeof manufacturingSteps.$inferSelect)[];
  inventory: (typeof inventoryItems.$inferSelect)[];
  names: Map<string, string>;
}) {
  const queued = parts.filter(
    (part) => !["COMPLETE", "RETIRED"].includes(part.lifecycleStatus),
  );
  const labelParts = parts.slice(0, 24);
  const codes = await Promise.all(
    labelParts.map((part) =>
      QRCode.toDataURL(`${baseUrl}/parts/${part.id}`, {
        width: 220,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      }),
    ),
  );
  return (
    <div className="grid gap-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Shop floor</p>
          <h2 className="mt-2 text-3xl font-bold">
            Manufacturing queue and labels
          </h2>
        </div>
        <div className="flex gap-3">
          <Link className="button" href="/shop">
            <Gauge className="h-4 w-4" /> Open monitor display
          </Link>
          <PrintButton label="Print labels" />
        </div>
      </div>
      <Panel
        title="Manufacturing queue"
        subtitle="Parts ordered by due date with every process and verification gate visible."
      >
        <div className="grid gap-4">
          {queued.map((part) => {
            const partSteps = steps.filter((step) => step.partId === part.id);
            return (
              <article
                className="border border-[#333] bg-[#111] p-5"
                key={part.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="tag">
                      {part.partNumber} · Rev {part.revision}
                    </span>
                    <h3 className="mt-3 text-lg font-bold">
                      {part.name} × {part.quantity}
                    </h3>
                    <p className="mt-2 text-xs text-[#777]">
                      {part.project} · {part.subsystem} ·{" "}
                      {part.manufacturingMethod || part.makeBuy} · Owner{" "}
                      {part.assignedToMemberId
                        ? names.get(part.assignedToMemberId)
                        : "Unassigned"}
                    </p>
                  </div>
                  <span className="tag">{part.lifecycleStatus}</span>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {partSteps.map((step) => (
                    <div className="border border-[#2c2c2c] p-3" key={step.id}>
                      <strong className="text-sm">
                        {step.sequence}. {step.process}
                      </strong>
                      <p className="mt-1 text-xs text-[#777]">
                        {step.machine || "General shop"} · {step.status}
                      </p>
                    </div>
                  ))}
                  {!partSteps.length && (
                    <p className="text-sm text-[#777]">
                      No manufacturing steps added.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
          {!queued.length && <Empty text="The manufacturing queue is clear." />}
        </div>
      </Panel>
      <Panel
        title="QR / SKU part labels"
        subtitle="Print labels and scan them to open the current drawing, revision, manufacturing instructions, and inventory status."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {labelParts.map((part, index) => {
            const stock = inventory.find((item) => item.partId === part.id);
            return (
              <article className="bg-white p-4 text-black" key={part.id}>
                <div className="flex gap-3">
                  <Image
                    src={codes[index]}
                    alt={`QR code for ${part.partNumber}`}
                    width={92}
                    height={92}
                    unoptimized
                  />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#e05e00]">
                      210 Robotics
                    </p>
                    <h3 className="mt-1 text-lg font-black leading-tight">
                      {part.partNumber}
                    </h3>
                    <p className="text-xs font-semibold">{part.name}</p>
                    <p className="mt-1 text-[10px]">
                      REV {part.revision} · QTY {part.quantity}
                    </p>
                    <p className="text-[10px]">
                      SKU {stock?.sku ?? part.partNumber}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function ResponsibilityWorkspace({
  records,
  seasons,
  projects,
  subsystems,
  names,
}: {
  records: HubRecord[];
  seasons: (typeof engineeringSeasons.$inferSelect)[];
  projects: (typeof engineeringProjects.$inferSelect)[];
  subsystems: (typeof engineeringSubsystems.$inferSelect)[];
  names: Map<string, string>;
}) {
  const raci = records.filter((item) => item.kind === "RACI");
  return (
    <div className="grid gap-7 xl:grid-cols-[.75fr_1.25fr]">
      <Panel
        title="Assign responsibility"
        subtitle="Define who is responsible, accountable, consulted, and informed for any team area."
      >
        <RecordForm kind="RACI">
          <Field label="Area / deliverable">
            <input className="input" name="title" required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Responsible">
              <input
                className="input"
                name="responsible"
                placeholder="Names or roles"
              />
            </Field>
            <Field label="Accountable / approves">
              <input
                className="input"
                name="accountable"
                placeholder="One owner"
              />
            </Field>
          </div>
          <OptionalFields>
            <ScopeFields {...{ seasons, projects, subsystems }} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Consulted / supports">
                <input className="input" name="consulted" />
              </Field>
              <Field label="Informed">
                <input className="input" name="informed" />
              </Field>
            </div>
            <Field label="Notes">
              <textarea className="input min-h-24" name="description" />
            </Field>
          </OptionalFields>
        </RecordForm>
      </Panel>
      <Panel
        title="Responsibility matrix"
        subtitle="RACI ownership across the organization."
      >
        <RecordList records={raci} names={names} />
      </Panel>
    </div>
  );
}

function AutomationWorkspace({
  records,
  notifications,
  suggestions,
}: {
  records: HubRecord[];
  notifications: HubRecord[];
  suggestions: HubRecord[];
}) {
  const rules = records.filter((item) => item.kind === "AUTOMATION");
  return (
    <div className="grid gap-7">
      <div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
        <Panel
          title="Run operations automation"
          subtitle="Creates deduplicated reminders for low inventory, overdue work, stale documents, and notebook-worthy activity."
        >
          <ActionForm
            action={runOperationsAutomation}
            successMessage="Operations scan complete."
            className="grid gap-4"
          >
            <div className="border border-[#333] bg-[#111] p-4 text-sm leading-7 text-[#aaa]">
              The scan never creates the same reminder twice. It also prepares
              notebook suggestions from completed tasks, meetings, design
              changes, failed tests, and uploaded media.
            </div>
            <button className="button w-fit">
              <Sparkles className="h-4 w-4" /> Run now
            </button>
          </ActionForm>
        </Panel>
        <Panel
          title="Notification digest"
          subtitle="Missing approvals, overdue deliverables, inventory alerts, and review reminders."
        >
          <RecordList records={notifications.slice(0, 30)} names={new Map()} />
        </Panel>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title="Automation rule library"
          subtitle="Document triggers and actions the team wants enabled."
        >
          <RecordForm kind="AUTOMATION">
            <Field label="Rule name">
              <input className="input" name="title" required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Trigger">
                <select className="input" name="trigger">
                  <option>TEST_FAILED</option>
                  <option>INVENTORY_LOW</option>
                  <option>DOCUMENT_REVIEW_DUE</option>
                  <option>FORM_MISSING</option>
                  <option>POLL_MISSING</option>
                  <option>APPROVAL_WAITING</option>
                  <option>DELIVERABLE_OVERDUE</option>
                </select>
              </Field>
              <Field label="Action">
                <select className="input" name="action">
                  <option>CREATE_TASK</option>
                  <option>NOTIFY_OWNER</option>
                  <option>ADD_TO_DIGEST</option>
                  <option>SUGGEST_NOTEBOOK_ENTRY</option>
                </select>
              </Field>
            </div>
            <OptionalFields>
              <Field label="Rule notes">
                <textarea className="input min-h-20" name="description" />
              </Field>
            </OptionalFields>
          </RecordForm>
          <div className="mt-6">
            <RecordList records={rules} names={new Map()} />
          </div>
        </Panel>
        <Panel
          title="Notebook suggestions"
          subtitle="Review these prompts, then convert the useful ones into polished notebook pages."
        >
          <RecordList records={suggestions.slice(0, 40)} names={new Map()} />
          <Link className="button mt-5" href="/admin/operations?tool=notebook">
            Open notebook studio
          </Link>
        </Panel>
      </div>
    </div>
  );
}

function TemplateWorkspace({ records }: { records: HubRecord[] }) {
  const templates = records.filter((item) => item.kind === "TEMPLATE");
  const defaults = [
    "Project kickoff",
    "Event plan",
    "Meeting agenda",
    "Notebook design entry",
    "Test plan",
    "Safety checklist",
    "Member onboarding form",
  ];
  return (
    <div className="grid gap-7 xl:grid-cols-[.75fr_1.25fr]">
      <Panel
        title="Create a reusable template"
        subtitle="Templates appear in the member quick-add library and standardize repeatable work."
      >
        <RecordForm kind="TEMPLATE">
          <Field label="Template name">
            <input className="input" name="title" required />
          </Field>
          <Field label="Template type">
            <select className="input" name="templateKind">
              <option>PROJECT</option>
              <option>EVENT</option>
              <option>FORM</option>
              <option>MEETING</option>
              <option>NOTEBOOK</option>
              <option>TEST</option>
              <option>CHECKLIST</option>
            </select>
          </Field>
          <OptionalFields>
          <Field label="Purpose">
            <textarea className="input min-h-20" name="description" />
          </Field>
          </OptionalFields>
          <Field label="Template content">
            <textarea
              className="input min-h-56 font-mono text-sm"
              name="templateBody"
              placeholder="Headings, prompts, checklist items, required fields…"
            />
          </Field>
        </RecordForm>
      </Panel>
      <Panel
        title="Template library"
        subtitle="Start quickly with team-approved structures."
      >
        <div className="mb-5 flex flex-wrap gap-2">
          {defaults.map((item) => (
            <span className="tag" key={item}>
              <LayoutTemplate className="mr-1 inline h-3 w-3" />
              {item}
            </span>
          ))}
        </div>
        <RecordList records={templates} names={new Map()} />
      </Panel>
    </div>
  );
}

function RecordForm({
  kind,
  children,
}: {
  kind: string;
  children: React.ReactNode;
}) {
  return (
    <ActionForm
      action={saveHubRecord}
      successMessage="Saved to the control center."
      className="grid gap-4"
    >
      <input type="hidden" name="kind" value={kind} />
      {children}
      <button className="button w-fit">Save</button>
    </ActionForm>
  );
}
function OptionalFields({ children }: { children: React.ReactNode }) {
  return (
    <details className="border border-[#2f2f2f] bg-[#101010] p-4">
      <summary className="cursor-pointer text-sm font-semibold text-[#aaa]">
        Add optional details
      </summary>
      <div className="mt-4 grid gap-4">{children}</div>
    </details>
  );
}
function RecordList({
  records,
  names,
}: {
  records: HubRecord[];
  names: Map<string, string>;
}) {
  return (
    <div className="divide-y divide-[#2d2d2d]">
      {records.map((record) => (
        <article className="py-4" key={record.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="tag">{record.status}</span>
                <span className="tag">{record.priority}</span>
                {record.ownerMemberId && (
                  <span className="tag">
                    {names.get(record.ownerMemberId) ?? "Owner"}
                  </span>
                )}
              </div>
              <h3 className="mt-3 font-bold">{record.title}</h3>
              {record.description && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#999]">
                  {record.description}
                </p>
              )}
              {Object.keys(record.data).length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-[#fd7803]">
                    View structured details
                  </summary>
                  <dl className="mt-3 grid gap-2 text-xs text-[#888]">
                    {Object.entries(record.data)
                      .filter(([, item]) => item !== "")
                      .map(([key, item]) => (
                        <div key={key}>
                          <dt className="inline font-bold capitalize text-[#aaa]">
                            {key.replaceAll(/([A-Z])/g, " $1")}:{" "}
                          </dt>
                          <dd className="inline whitespace-pre-wrap">
                            {String(item)}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </details>
              )}
            </div>
            <ActionForm
              action={archiveHubRecord}
              successMessage="Archived."
              className="shrink-0"
            >
              <input type="hidden" name="id" value={record.id} />
              <button className="text-xs text-red-300">Archive</button>
            </ActionForm>
          </div>
        </article>
      ))}
      {!records.length && <Empty text="No records yet." />}
    </div>
  );
}
function ScopeFields({
  seasons,
  projects,
  subsystems,
}: {
  seasons: (typeof engineeringSeasons.$inferSelect)[];
  projects: (typeof engineeringProjects.$inferSelect)[];
  subsystems: (typeof engineeringSubsystems.$inferSelect)[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Season">
        <select className="input" name="seasonId">
          <option value="">Organization-wide</option>
          {seasons.map((item) => (
            <option value={item.id} key={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Project">
        <select className="input" name="projectId">
          <option value="">All projects</option>
          {projects.map((item) => (
            <option value={item.id} key={item.id}>
              {item.code} · {item.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Subsystem">
        <select className="input" name="subsystemId">
          <option value="">All subsystems</option>
          {subsystems.map((item) => (
            <option value={item.id} key={item.id}>
              {item.code} · {item.name}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
function PersonSelect({
  people,
  name,
  required = false,
}: {
  people: Person[];
  name: string;
  required?: boolean;
}) {
  return (
    <select className="input" name={name} required={required}>
      <option value="">Unassigned</option>
      {people.map((person) => (
        <option value={person.id} key={person.id}>
          {person.name} · {person.role}
        </option>
      ))}
    </select>
  );
}
function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5 md:p-7">
      <h2 className="text-xl font-bold">{title}</h2>
      {subtitle && (
        <p className="mt-2 text-sm leading-6 text-[#888]">{subtitle}</p>
      )}
      <div className="mt-5">{children}</div>
    </section>
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
function Metric({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  tone?: "danger" | "warning";
}) {
  return (
    <div className="card p-5">
      <div
        className={
          tone === "danger"
            ? "text-red-400"
            : tone === "warning"
              ? "text-amber-400"
              : "text-[#fd7803]"
        }
      >
        {icon}
      </div>
      <strong className="mt-4 block text-3xl">{value}</strong>
      <p className="mt-1 text-xs text-[#777]">{label}</p>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="py-7 text-center text-sm text-[#777]">{text}</p>;
}
function tabLabel(tab: Tab) {
  return (
    {
      dashboard: "Leadership",
      people: "People & recognition",
      decisions: "Decisions & issues",
      shop: "Shop queue",
      responsibility: "Responsibility",
      automation: "Automation",
      templates: "Templates",
      sponsors: "Sponsors",
      "team-os": "Team OS",
    } satisfies Record<Tab, string>
  )[tab];
}
function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

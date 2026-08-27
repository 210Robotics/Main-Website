import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { getDb, hasDatabase } from "@/db";
import {
  contributions,
  activityAttendance,
  hourEntries,
  mediaAssets,
  members as memberTable,
  timeSessions,
  teamActivities,
  publicFormResponses,
  publicForms,
  availabilityPollResponses,
  availabilityPolls,
  memberTasks,
  taskComments,
  glossaryTerms,
  engineeringSeasons,
  engineeringProjects,
  engineeringNotebookEntries,
  engineeringParts,
  manufacturingSteps,
  membershipDues,
  membershipDuesPayments,
  membershipSettings,
  designChanges,
  operationsHubRecords,
  scoutingMatches,
} from "@/db/schema";
import {
  addContribution,
  addHour,
  deleteContribution,
  deleteHour,
} from "@/app/portal/actions";
import { hasClerk, requireMemberEntitlement } from "@/lib/auth";
import { formatHours } from "@/lib/utils";
import { teamAiIsConfigured } from "@/lib/team-ai";
import { TimeClock } from "@/components/time-clock";
import { CalendarInput } from "@/components/calendar-input";
import { canAccessAdmin, hasPermission } from "@/lib/permissions";
import { ProfileEditor } from "@/components/profile-editor";
import { AttendanceScanner } from "@/components/attendance-scanner";
import { activityTypeLabels } from "@/lib/attendance";
import { formatCentralDateTime } from "@/lib/dates";
import { DashboardNavigation } from "@/components/dashboard-navigation";
import { formatPollDate, formatPollTime } from "@/lib/availability";
import { MemberTaskHub } from "@/components/member-task-hub";
import { TaskAlert } from "@/components/task-alert";
import { ScoutingPortal } from "@/components/scouting-portal";
import { PortalSearch } from "@/components/portal-search";
import { MemberEngineeringHub } from "@/components/member-engineering-hub";
import { AccountConnections } from "@/components/account-connections";
import { MembershipDuesCheckout } from "@/components/membership-dues-checkout";
import { currentMembershipPeriod } from "@/lib/membership-dues";
import {
  normalizePortalTab,
  portalLoadPlan,
} from "@/lib/workspace-loading";

export const metadata: Metadata = {
  title: "Member Portal",
  robots: { index: false, follow: false },
};

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: requestedTab } = await searchParams;
  const tab = normalizePortalTab(requestedTab);
  const load = portalLoadPlan(tab);
  if (!hasClerk() || !hasDatabase()) return <SetupNotice />;
  const member = await requireMemberEntitlement();
  const canNotebookView = hasPermission(
    member.accessRole,
    "notebook.view",
    member.permissionOverrides,
  );
  const canNotebookEdit = hasPermission(
    member.accessRole,
    "notebook.manage",
    member.permissionOverrides,
  );
  const canEngineeringEdit = hasPermission(
    member.accessRole,
    "engineering.manage",
    member.permissionOverrides,
  );
  const canDesignChangeEdit = hasPermission(
    member.accessRole,
    "design_changes.manage",
    member.permissionOverrides,
  );
  const [profileMedia] = load.profile && member.photoMediaId
    ? await getDb()
        .select({ blobUrl: mediaAssets.blobUrl })
        .from(mediaAssets)
        .where(eq(mediaAssets.id, member.photoMediaId))
        .limit(1)
    : [];
  const [
    hours,
    work,
    activeSession,
    teamMembers,
    teamHours,
    attendanceHistory,
    availableActivities,
    completedForms,
    completedPollRows,
    assignedTasks,
    assignedTaskComments,
    publishedGlossary,
    engineeringSeasonRows,
    scoutingRows,
    hubRecords,
    engineeringProjectRows,
    notebookPortfolioRows,
    designPortfolioRows,
    memberNotebookRows,
    memberPartRows,
    memberManufacturingRows,
    memberDesignChangeRows,
  ] = await Promise.all([
    load.hours
      ? getDb()
      .select()
      .from(hourEntries)
      .where(
        and(eq(hourEntries.memberId, member.id), isNull(hourEntries.deletedAt)),
      )
      .orderBy(desc(hourEntries.workDate))
      : Promise.resolve([]),
    load.contributions
      ? getDb()
      .select()
      .from(contributions)
      .where(
        and(
          eq(contributions.memberId, member.id),
          isNull(contributions.deletedAt),
        ),
      )
      .orderBy(desc(contributions.contributionDate))
      : Promise.resolve([]),
    load.activeTimer
      ? getDb()
      .select()
      .from(timeSessions)
      .where(
        and(
          eq(timeSessions.memberId, member.id),
          isNull(timeSessions.clockOut),
        ),
      )
      .orderBy(desc(timeSessions.clockIn))
      .limit(1)
      : Promise.resolve([]),
    load.members
      ? getDb()
      .select({
        id: memberTable.id,
        name: memberTable.displayName,
        role: memberTable.organizationRole,
      })
      .from(memberTable)
      .where(
        and(
          eq(memberTable.status, "ACTIVE"),
          ne(memberTable.accessRole, "MENTOR"),
        ),
      )
      : Promise.resolve([]),
    load.teamHours
      ? getDb()
      .select({
        memberId: hourEntries.memberId,
        minutes: hourEntries.minutes,
      })
      .from(hourEntries)
      .innerJoin(memberTable, eq(memberTable.id, hourEntries.memberId))
      .where(
        and(
          isNull(hourEntries.deletedAt),
          ne(memberTable.accessRole, "MENTOR"),
        ),
      )
      : Promise.resolve([]),
    load.attendance
      ? getDb()
      .select({ attendance: activityAttendance, activity: teamActivities })
      .from(activityAttendance)
      .innerJoin(
        teamActivities,
        eq(teamActivities.id, activityAttendance.activityId),
      )
      .where(
        and(
          eq(activityAttendance.memberId, member.id),
          eq(activityAttendance.status, "PRESENT"),
        ),
      )
      .orderBy(desc(activityAttendance.checkedInAt))
      : Promise.resolve([]),
    load.activities
      ? getDb()
      .select()
      .from(teamActivities)
      .where(
        and(
          isNull(teamActivities.archivedAt),
          ne(teamActivities.status, "CANCELED"),
        ),
      )
      .orderBy(teamActivities.startsAt)
      : Promise.resolve([]),
    load.forms
      ? getDb()
      .select({ response: publicFormResponses, form: publicForms })
      .from(publicFormResponses)
      .innerJoin(publicForms, eq(publicForms.id, publicFormResponses.formId))
      .where(eq(publicFormResponses.submittedByMemberId, member.id))
      .orderBy(desc(publicFormResponses.updatedAt))
      : Promise.resolve([]),
    load.polls
      ? getDb()
      .select({ response: availabilityPollResponses, poll: availabilityPolls })
      .from(availabilityPollResponses)
      .innerJoin(
        availabilityPolls,
        eq(availabilityPolls.id, availabilityPollResponses.pollId),
      )
      .where(
        or(
          eq(availabilityPollResponses.submittedByMemberId, member.id),
          and(
            isNull(availabilityPollResponses.submittedByMemberId),
            sql`lower(${availabilityPollResponses.email}) = ${member.email.toLowerCase()}`,
          ),
        ),
      )
      .orderBy(desc(availabilityPollResponses.updatedAt))
      : Promise.resolve([]),
    load.tasks
      ? getDb()
      .select()
      .from(memberTasks)
      .where(
        and(
          eq(memberTasks.assignedToMemberId, member.id),
          isNull(memberTasks.archivedAt),
        ),
      )
      .orderBy(memberTasks.dueAt, desc(memberTasks.createdAt))
      : Promise.resolve([]),
    load.taskComments
      ? getDb()
      .select({ comment: taskComments })
      .from(taskComments)
      .innerJoin(memberTasks, eq(memberTasks.id, taskComments.taskId))
      .where(
        and(
          eq(memberTasks.assignedToMemberId, member.id),
          isNull(memberTasks.archivedAt),
        ),
      )
      .orderBy(taskComments.createdAt)
      : Promise.resolve([]),
    load.glossary
      ? getDb()
      .select()
      .from(glossaryTerms)
      .where(eq(glossaryTerms.published, true))
      .orderBy(glossaryTerms.term)
      : Promise.resolve([]),
    load.seasons
      ? getDb()
      .select()
      .from(engineeringSeasons)
      .orderBy(
        desc(engineeringSeasons.isDefault),
        desc(engineeringSeasons.startsAt),
      )
      : Promise.resolve([]),
    load.scouting
      ? getDb()
      .select()
      .from(scoutingMatches)
      .orderBy(desc(scoutingMatches.createdAt))
      : Promise.resolve([]),
    load.hub
      ? getDb()
      .select()
      .from(operationsHubRecords)
      .where(
        and(
          isNull(operationsHubRecords.archivedAt),
          or(
            eq(operationsHubRecords.subjectMemberId, member.id),
            eq(operationsHubRecords.ownerMemberId, member.id),
            eq(operationsHubRecords.kind, "TEMPLATE"),
          ),
        ),
      )
      .orderBy(desc(operationsHubRecords.updatedAt))
      : Promise.resolve([]),
    load.projects
      ? getDb()
      .select()
      .from(engineeringProjects)
      .orderBy(engineeringProjects.code)
      : Promise.resolve([]),
    load.portfolioNotebook
      ? getDb()
      .select()
      .from(engineeringNotebookEntries)
      .where(
        or(
          eq(engineeringNotebookEntries.createdByMemberId, member.id),
          eq(engineeringNotebookEntries.updatedByMemberId, member.id),
        ),
      )
      .orderBy(desc(engineeringNotebookEntries.updatedAt))
      : Promise.resolve([]),
    load.portfolioDesign
      ? getDb()
      .select()
      .from(designChanges)
      .where(eq(designChanges.requestedByMemberId, member.id))
      .orderBy(desc(designChanges.updatedAt))
      : Promise.resolve([]),
    load.engineering
      ? getDb()
      .select()
      .from(engineeringNotebookEntries)
      .where(
        canNotebookView || canNotebookEdit
          ? undefined
          : inArray(engineeringNotebookEntries.status, [
              "APPROVED",
              "PUBLISHED",
            ]),
      )
      .orderBy(
        asc(engineeringNotebookEntries.sortOrder),
        asc(engineeringNotebookEntries.entryDate),
      )
      : Promise.resolve([]),
    load.engineering
      ? getDb()
      .select()
      .from(engineeringParts)
      .where(ne(engineeringParts.lifecycleStatus, "OBSOLETE"))
      .orderBy(asc(engineeringParts.project), asc(engineeringParts.partNumber))
      : Promise.resolve([]),
    load.engineering
      ? getDb()
      .select()
      .from(manufacturingSteps)
      .orderBy(asc(manufacturingSteps.sequence))
      : Promise.resolve([]),
    load.engineering
      ? getDb()
      .select()
      .from(designChanges)
      .where(
        canDesignChangeEdit
          ? undefined
          : inArray(designChanges.status, ["APPROVED", "IMPLEMENTED"]),
      )
      .orderBy(desc(designChanges.updatedAt))
      : Promise.resolve([]),
  ]);
  const [currentDues] = load.dues
    ? await getDb()
        .select()
        .from(membershipDues)
        .where(
          and(
            eq(membershipDues.memberId, member.id),
            eq(membershipDues.period, currentMembershipPeriod()),
          ),
        )
        .limit(1)
    : [];
  const duesPayments = load.dues
    ? await getDb()
        .select()
        .from(membershipDuesPayments)
        .where(eq(membershipDuesPayments.memberId, member.id))
        .orderBy(desc(membershipDuesPayments.paymentDate), desc(membershipDuesPayments.createdAt))
        .limit(50)
    : [];
  const [duesSettings] = load.dues
    ? await getDb()
        .select({
          stripeDuesPaymentsEnabled:
            membershipSettings.stripeDuesPaymentsEnabled,
        })
        .from(membershipSettings)
        .where(eq(membershipSettings.id, "membership"))
        .limit(1)
    : [];
  const completedPolls = completedPollRows.filter(
    ({ poll }, index, rows) =>
      rows.findIndex((candidate) => candidate.poll.id === poll.id) === index,
  );
  const openAssignedTasks = assignedTasks.filter(
    (task) => task.status !== "DONE",
  );
  const memberNotifications = hubRecords.filter(
    (item) => item.kind === "NOTIFICATION" && item.status === "UNREAD",
  );
  const memberRecognition = hubRecords.filter(
    (item) => item.kind === "RECOGNITION",
  );
  const memberTemplates = hubRecords.filter((item) => item.kind === "TEMPLATE");
  const portfolioItems = [
    ...assignedTasks
      .filter((item) => item.status === "DONE")
      .map((item) => ({
        type: "Completed task",
        title: item.title,
        description: item.description,
        date: item.completedAt ?? item.updatedAt,
      })),
    ...notebookPortfolioRows.map((item) => ({
      type: "Notebook",
      title: item.title,
      description: item.objective || item.results,
      date: item.updatedAt,
    })),
    ...designPortfolioRows.map((item) => ({
      type: "Design",
      title: item.title,
      description: item.description,
      date: item.updatedAt,
    })),
    ...work.map((item) => ({
      type: item.category,
      title: item.title,
      description: item.description,
      date: item.contributionDate,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());
  const commentAuthorNames = Object.fromEntries(
    teamMembers.map((person) => [person.id, person.name]),
  );
  const total = hours.reduce((sum, item) => sum + item.minutes, 0);
  const totalsByMember = new Map<string, number>();
  for (const entry of teamHours)
    totalsByMember.set(
      entry.memberId,
      (totalsByMember.get(entry.memberId) ?? 0) + entry.minutes,
    );
  const leaderboard = teamMembers
    .map((item) => ({ ...item, minutes: totalsByMember.get(item.id) ?? 0 }))
    .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));
  const attendanceCounts = Object.fromEntries(
    Object.keys(activityTypeLabels).map((key) => [key, 0]),
  ) as Record<keyof typeof activityTypeLabels, number>;
  for (const row of attendanceHistory) attendanceCounts[row.activity.type] += 1;
  const now = new Date();
  const visibleActivities = availableActivities
    .filter(
      (activity) =>
        Boolean(
          activity.attendanceOpenedAt &&
          (!activity.attendanceClosesAt || activity.attendanceClosesAt >= now),
        ) || activity.endsAt >= new Date(now.getTime() - 86400000),
    )
    .slice(0, 12);
  return (
    <section className="min-h-screen bg-[#090909] grid-bg">
      <div className="shell py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Member portal</p>
            <h1 className="mt-3 text-4xl font-bold tracking-[-.04em]">
              Welcome back, {member.displayName}.
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AttendanceScanner />
            {canAccessAdmin(member.accessRole, member.permissionOverrides) && (
              <Link className="button secondary" href="/admin" prefetch={false}>
                Open admin
              </Link>
            )}
            <SignOutButton redirectUrl="https://210robotics.com">
              <button className="button secondary" type="button">
                Sign out
              </button>
            </SignOutButton>
          </div>
        </div>
        <PortalSearch
          canAdmin={canAccessAdmin(
            member.accessRole,
            member.permissionOverrides,
          )}
        />
        <DashboardNavigation
          current={tab}
          label="Member portal sections"
          items={[
            { value: "dashboard", label: "Dashboard", href: "/portal" },
            {
              value: "attendance",
              label: "Attendance",
              href: "/portal?tab=attendance",
            },
            { value: "hours", label: "Hours", href: "/portal?tab=hours" },
            {
              value: "forms",
              label: "Completed forms",
              href: "/portal?tab=forms",
            },
            {
              value: "polls",
              label: "Scheduling polls",
              href: "/portal?tab=polls",
            },
            { value: "tasks", label: "Tasks", href: "/portal?tab=tasks" },
            {
              value: "portfolio",
              label: "My portfolio",
              href: "/portal?tab=portfolio",
            },
            {
              value: "templates",
              label: "Templates",
              href: "/portal?tab=templates",
            },
            {
              value: "scouting",
              label: "Scouting",
              href: "/portal?tab=scouting",
            },
            {
              value: "engineering",
              label: "Engineering",
              href: "/portal?tab=engineering",
            },
            {
              value: "dues",
              label: "Membership dues",
              href: "/portal?tab=dues",
            },
            {
              value: "glossary",
              label: "Glossary",
              href: "/portal?tab=glossary",
            },
            {
              value: "connections",
              label: "Connected accounts",
              href: "/portal?tab=connections",
            },
            {
              value: "docs",
              label: "Documentation",
              href: "https://docs.210robotics.com",
              external: true,
            },
          ]}
        />
        {tab === "dues" &&
          (currentDues ? (
            <MembershipDuesCheckout
              duesId={currentDues.id}
              period={currentDues.period}
              amountDueCents={currentDues.amountDueCents}
              amountPaidCents={currentDues.amountPaidCents}
              status={currentDues.status}
              dueAt={currentDues.dueAt?.toISOString() ?? null}
              fundraisingRaisedCents={currentDues.fundraisingRaisedCents}
              fundraisingThresholdCents={currentDues.fundraisingThresholdCents}
              payments={duesPayments.map((payment) => ({
                id: payment.id,
                amountCents: payment.amountCents - payment.refundedCents,
                paymentDate: (payment.paymentDate || payment.paidAt || payment.createdAt).toISOString(),
                paymentMethod: payment.paymentMethod,
                coveragePeriod: payment.coveragePeriod,
                status: payment.status,
                receiptNumber: payment.receiptNumber,
              }))}
              publishableKey={process.env.STRIPE_PUBLISHABLE_KEY ?? ""}
              stripePaymentsEnabled={
                duesSettings?.stripeDuesPaymentsEnabled ?? false
              }
            />
          ) : (
            <section className="card p-6 sm:p-8">
              <p className="eyebrow">Membership dues</p>
              <h2 className="mt-3 text-2xl font-bold">No balance assigned</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#999]">
                No dues record has been created for your account for the current
                membership period. Contact an officer if you expected a balance.
              </p>
            </section>
          ))}
        {tab === "engineering" && (
          <MemberEngineeringHub
            notebook={memberNotebookRows}
            parts={memberPartRows}
            steps={memberManufacturingRows}
            changes={memberDesignChangeRows}
            projects={engineeringProjectRows}
            memberNames={Object.fromEntries(
              teamMembers.map((person) => [person.id, person.name]),
            )}
            canEditNotebook={canNotebookEdit}
            canEditEngineering={canEngineeringEdit}
            canEditChanges={canDesignChangeEdit}
          />
        )}
        {tab === "connections" && (
          <AccountConnections
            teamAiAvailable={teamAiIsConfigured()}
          />
        )}
        {tab === "tasks" && (
          <MemberTaskHub
            tasks={assignedTasks}
            comments={assignedTaskComments.map(({ comment }) => comment)}
            names={commentAuthorNames}
          />
        )}
        {tab === "portfolio" && (
          <div className="grid gap-6">
            <div>
              <p className="eyebrow">Your impact</p>
              <h2 className="mt-2 text-3xl font-bold">
                Contribution portfolio
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#999]">
                Generated from completed tasks, notebook work, designs, code,
                outreach, and verified contributions.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link className="button" href="/api/exports/member-portfolio?format=portfolio">Export branded portfolio</Link>
                <Link className="button secondary" href="/api/exports/member-portfolio?format=resume">Export résumé</Link>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric
                value={String(portfolioItems.length)}
                label="Portfolio items"
              />
              <Metric
                value={String(memberRecognition.length)}
                label="Recognitions"
              />
              <Metric
                value={String(
                  assignedTasks.filter((item) => item.status === "DONE").length,
                )}
                label="Completed tasks"
              />
            </div>
            {memberRecognition.length > 0 && (
              <EntryCard title="Recognition and certifications">
                <div className="grid gap-3 sm:grid-cols-2">
                  {memberRecognition.map((item) => (
                    <article
                      className="border border-[#333] bg-[#111] p-4"
                      key={item.id}
                    >
                      <span className="tag">
                        {String(item.data.category || "Recognition")}
                      </span>
                      <h3 className="mt-3 font-bold">{item.title}</h3>
                      <p className="mt-2 text-sm text-[#888]">
                        {item.description}
                      </p>
                    </article>
                  ))}
                </div>
              </EntryCard>
            )}
            <EntryCard title="Verified work">
              <div className="divide-y divide-[#333]">
                {portfolioItems.map((item, index) => (
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
                    {item.description && (
                      <p className="mt-2 text-sm leading-6 text-[#999]">
                        {item.description}
                      </p>
                    )}
                  </article>
                ))}
                {!portfolioItems.length && (
                  <p className="py-8 text-center text-sm text-[#777]">
                    Complete tasks or record contributions to build your
                    portfolio.
                  </p>
                )}
              </div>
            </EntryCard>
          </div>
        )}
        {tab === "templates" && (
          <div className="grid gap-6">
            <div>
              <p className="eyebrow">Start with structure</p>
              <h2 className="mt-2 text-3xl font-bold">Team template library</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#999]">
                Reusable project, event, form, meeting, notebook, test, and
                checklist templates.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {memberTemplates.map((item) => (
                <article className="card p-5" key={item.id}>
                  <span className="tag">
                    {String(item.data.templateKind || "Template")}
                  </span>
                  <h3 className="mt-3 text-lg font-bold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#888]">
                    {item.description}
                  </p>
                  {item.data.templateBody ? (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm font-semibold text-[#fd7803]">
                        Preview template
                      </summary>
                      <pre className="mt-3 whitespace-pre-wrap border border-[#333] bg-[#0b0b0b] p-4 text-xs leading-6 text-[#aaa]">
                        {String(item.data.templateBody)}
                      </pre>
                    </details>
                  ) : null}
                </article>
              ))}
              {!memberTemplates.length && (
                <div className="card p-8 text-center text-sm text-[#777] md:col-span-2 xl:col-span-3">
                  No team templates have been published yet.
                </div>
              )}
            </div>
          </div>
        )}
        {tab === "scouting" && (
          <ScoutingPortal
            seasons={engineeringSeasonRows}
            records={scoutingRows}
            memberId={member.id}
          />
        )}
        {tab === "glossary" && (
          <div className="grid gap-6">
            <div>
              <p className="eyebrow">Shared language</p>
              <h2 className="mt-2 text-3xl font-bold">Organization glossary</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#999]">
                Acronyms, roles, systems, processes, and metrics used across 210
                Robotics.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {publishedGlossary.map((term) => (
                <article className="card p-6" key={term.id}>
                  <div className="flex flex-wrap gap-2">
                    <span className="tag">{term.category}</span>
                    {term.ownerRole && (
                      <span className="tag">Owner: {term.ownerRole}</span>
                    )}
                  </div>
                  <h3 className="mt-4 text-xl font-bold">
                    {term.acronym ? `${term.acronym} — ` : ""}
                    {term.term}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[#bbb]">
                    {term.definition}
                  </p>
                  {term.usage && (
                    <p className="mt-4 border-t border-[#333] pt-4 text-sm leading-6 text-[#888]">
                      <strong className="text-[#aaa]">Used here:</strong>{" "}
                      {term.usage}
                    </p>
                  )}
                  {term.relatedTerms.length > 0 && (
                    <p className="mt-3 text-xs text-[#777]">
                      Related: {term.relatedTerms.join(", ")}
                    </p>
                  )}
                </article>
              ))}
              {!publishedGlossary.length && (
                <div className="card p-10 text-center text-sm text-[#777] md:col-span-2">
                  No glossary terms have been published yet.
                </div>
              )}
            </div>
          </div>
        )}
        {tab === "polls" && (
          <div className="grid gap-6">
            <div>
              <p className="eyebrow">Your availability</p>
              <h2 className="mt-2 text-3xl font-bold">Scheduling polls</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#999]">
                Polls submitted while signed in—or matched to your registered
                account email—appear here. Open polls can be edited at any time.
              </p>
            </div>
            <div className="grid gap-4">
              {completedPolls.map(({ response, poll }) => (
                <article className="card p-5 md:p-6" key={poll.id}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <span className="tag">{poll.status}</span>
                      <h3 className="mt-3 text-xl font-bold">{poll.title}</h3>
                      <p className="mt-2 text-xs text-[#777]">
                        Submitted {formatCentralDateTime(response.submittedAt)}{" "}
                        · Updated {formatCentralDateTime(response.updatedAt)} ·{" "}
                        {poll.timezone.replaceAll("_", " ")}
                      </p>
                    </div>
                    {poll.status === "OPEN" ? (
                      <Link
                        className="button secondary"
                        href={`/p/${poll.accessKey}`}
                      >
                        Edit availability
                      </Link>
                    ) : (
                      <span className="text-xs text-[#777]">
                        Editing closed
                      </span>
                    )}
                  </div>
                  <details className="mt-5 border-t border-[#333] pt-4">
                    <summary className="cursor-pointer text-sm font-semibold text-[#fd7803]">
                      View {response.availableSlots.length} selected time{" "}
                      {response.availableSlots.length === 1
                        ? "block"
                        : "blocks"}
                    </summary>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {response.availableSlots.map((slot) => {
                        const [date, time] = slot.split("|");
                        return (
                          <span className="tag" key={slot}>
                            {formatPollDate(date)} · {formatPollTime(time)}
                          </span>
                        );
                      })}
                      {!response.availableSlots.length && (
                        <p className="text-sm text-[#777]">
                          No available times were selected.
                        </p>
                      )}
                    </div>
                  </details>
                </article>
              ))}
              {!completedPolls.length && (
                <div className="card p-8 text-center text-sm text-[#777]">
                  No scheduling poll responses are linked to your account yet.
                </div>
              )}
            </div>
          </div>
        )}
        {tab === "forms" && (
          <div className="grid gap-6">
            <div>
              <p className="eyebrow">Your responses</p>
              <h2 className="mt-2 text-3xl font-bold">Completed forms</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#999]">
                Forms submitted while signed in—or matched to your active
                account email—appear here.
              </p>
            </div>
            <div className="grid gap-4">
              {completedForms.map(({ response, form }) => (
                <article className="card p-5 md:p-6" key={response.id}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <span className="tag">{form.status}</span>
                      <h3 className="mt-3 text-xl font-bold">{form.title}</h3>
                      <p className="mt-2 text-xs text-[#777]">
                        Submitted {formatCentralDateTime(response.submittedAt)}{" "}
                        · Updated {formatCentralDateTime(response.updatedAt)}
                      </p>
                    </div>
                    {form.status === "OPEN" ? (
                      <Link
                        className="button secondary"
                        href={`/f/${form.accessKey}?response=${response.id}`}
                      >
                        Edit response
                      </Link>
                    ) : (
                      <span className="text-xs text-[#777]">
                        Editing closed
                      </span>
                    )}
                  </div>
                  <details className="mt-5 border-t border-[#333] pt-4">
                    <summary className="cursor-pointer text-sm font-semibold text-[#fd7803]">
                      View submitted answers
                    </summary>
                    <div className="mt-4 grid gap-4">
                      {response.answers.map((answer) => (
                        <div key={answer.fieldId}>
                          <p className="text-xs uppercase tracking-wider text-[#777]">
                            {answer.label}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-[#ddd]">
                            {Array.isArray(answer.value)
                              ? answer.value
                                  .map((item) =>
                                    typeof item === "string"
                                      ? item
                                      : item.filename,
                                  )
                                  .join(", ")
                              : answer.value || "No answer"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                </article>
              ))}
              {!completedForms.length && (
                <div className="card p-8 text-center text-sm text-[#777]">
                  No completed forms are linked to your account yet.
                </div>
              )}
            </div>
          </div>
        )}
        {tab === "attendance" && (
          <div className="grid gap-6">
            <EntryCard
              title="Attendance check-in"
              className="attendance-scan-card"
            >
              <p className="max-w-2xl text-sm leading-7 text-[#aaa]">
                Use the Scan attendance QR button at the top of your portal from
                any section. Your phone’s normal camera works too and will
                return you here after sign-in.
              </p>
            </EntryCard>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {Object.entries(activityTypeLabels).map(([key, label]) => (
                <Metric
                  key={key}
                  value={String(
                    attendanceCounts[key as keyof typeof activityTypeLabels],
                  )}
                  label={`${label} attendance`}
                />
              ))}
            </div>
            <EntryCard title="Attendance logs">
              <div className="divide-y divide-[#333]">
                {visibleActivities.map((activity) => (
                  <div
                    className="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center"
                    key={activity.id}
                  >
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="tag">
                          {activityTypeLabels[activity.type]}
                        </span>
                        {activity.topic && (
                          <span className="tag">{activity.topic}</span>
                        )}
                      </div>
                      <h3 className="mt-3 text-lg font-bold">
                        {activity.title}
                      </h3>
                      <p className="mt-1 text-xs text-[#777]">
                        Use the QR code displayed by a team leader to check in.
                      </p>
                    </div>
                    {activity.attendanceOpenedAt &&
                    (!activity.attendanceClosesAt ||
                      activity.attendanceClosesAt >= now) ? (
                      <span className="text-sm font-semibold text-emerald-400">
                        Check-in open
                      </span>
                    ) : (
                      <span className="text-xs text-[#777]">
                        Check-in closed
                      </span>
                    )}
                  </div>
                ))}
                {!visibleActivities.length && (
                  <p className="py-6 text-sm text-[#777]">
                    No attendance logs yet.
                  </p>
                )}
              </div>
            </EntryCard>
            <EntryCard title="Your attendance history">
              <div className="divide-y divide-[#333]">
                {attendanceHistory.map(({ attendance, activity }) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-4 py-4"
                    key={attendance.id}
                  >
                    <div>
                      <strong>{activity.title}</strong>
                      <p className="mt-1 text-xs text-[#777]">
                        {activityTypeLabels[activity.type]}
                        {activity.topic ? ` · ${activity.topic}` : ""} ·{" "}
                        {formatCentralDateTime(activity.startsAt)}
                      </p>
                    </div>
                    <span className="text-xs text-[#999]">
                      Checked in {formatCentralDateTime(attendance.checkedInAt)}
                    </span>
                  </div>
                ))}
                {!attendanceHistory.length && (
                  <p className="py-6 text-sm text-[#777]">
                    You have not checked in to an activity yet.
                  </p>
                )}
              </div>
            </EntryCard>
          </div>
        )}
        {tab === "dashboard" && (
          <div className="grid gap-7">
            <TaskAlert
              count={openAssignedTasks.length}
              urgentTitle={openAssignedTasks[0]?.title}
            />
            <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
              <EntryCard title="Current season and robot showcase">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <span className="tag">
                      {engineeringSeasonRows[0]?.competition ?? "210 Robotics"}
                    </span>
                    <h3 className="mt-3 text-2xl font-bold">
                      {engineeringSeasonRows[0]?.name ?? "Current season"}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-[#999]">
                      {engineeringSeasonRows[0]?.gameName
                        ? `${engineeringSeasonRows[0].gameName} · `
                        : ""}
                      {engineeringProjectRows.length} active engineering project
                      {engineeringProjectRows.length === 1 ? "" : "s"} connected
                      to the shared team model.
                    </p>
                  </div>
                  <Link className="button secondary" href="/projects/roborowdy">
                    Robot showcase
                  </Link>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {engineeringProjectRows.slice(0, 8).map((project) => (
                    <span className="tag" key={project.id}>
                      {project.code} · {project.name}
                    </span>
                  ))}
                </div>
              </EntryCard>
              <EntryCard title="Your notification digest">
                <div className="divide-y divide-[#333]">
                  {memberNotifications.slice(0, 6).map((item) => (
                    <Link
                      className="block py-3 hover:text-[#fd7803]"
                      href={item.sourceUrl || "/portal"}
                      key={item.id}
                    >
                      <strong className="text-sm">{item.title}</strong>
                      <p className="mt-1 text-xs text-[#777]">
                        {item.description}
                      </p>
                    </Link>
                  ))}
                  {!memberNotifications.length && (
                    <p className="py-6 text-sm text-[#777]">
                      You are all caught up.
                    </p>
                  )}
                </div>
              </EntryCard>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric value={formatHours(total)} label="Hours logged" />
              <Metric value={String(work.length)} label="Contributions" />
              <Metric
                value={member.organizationRole}
                label="Organization role"
              />
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <EntryCard title="Record a contribution">
                <form action={addContribution} className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Date">
                      <CalendarInput name="date" type="date" required />
                    </Field>
                    <Field label="Title">
                      <input className="input" name="title" required />
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Project">
                      <input className="input" name="project" required />
                    </Field>
                    <Field label="Category">
                      <input className="input" name="category" required />
                    </Field>
                  </div>
                  <Field label="Description">
                    <textarea
                      className="input min-h-28"
                      name="description"
                      required
                    />
                  </Field>
                  <Field label="Evidence link (optional)">
                    <input className="input" name="link" type="url" />
                  </Field>
                  <button className="button w-fit">Save contribution</button>
                </form>
              </EntryCard>
              <EntryCard title="Public member profile">
                <ProfileEditor
                  member={{
                    id: member.id,
                    displayName: member.displayName,
                    organizationRole: member.organizationRole,
                    bio: member.bio,
                    photoUrl: profileMedia?.blobUrl ?? member.photoUrl,
                  }}
                />
              </EntryCard>
            </div>
            <RecordList
              title="Contribution history"
              empty="No contributions recorded yet."
            >
              {work.map((item) => (
                <div
                  className="flex items-start justify-between gap-5 py-4"
                  key={item.id}
                >
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-[#999]">
                      {item.description}
                    </p>
                    <p className="mt-1 text-xs text-[#777]">
                      {item.contributionDate.toLocaleDateString()} ·{" "}
                      {item.project} · {item.category}
                    </p>
                  </div>
                  <form action={deleteContribution.bind(null, item.id)}>
                    <button className="text-xs text-[#888] hover:text-white">
                      Remove
                    </button>
                  </form>
                </div>
              ))}
            </RecordList>
          </div>
        )}
        {tab === "hours" && (
          <div className="grid gap-7">
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric value={formatHours(total)} label="Total hours" />
              <Metric value={String(hours.length)} label="Hour entries" />
              <Metric
                value={activeSession[0] ? "Active" : "Stopped"}
                label="Current timer"
              />
            </div>
            <EntryCard title="Sign in / sign out" className="clock-card">
              <TimeClock
                active={
                  activeSession[0]
                    ? {
                        clockIn: activeSession[0].clockIn.toISOString(),
                        project: activeSession[0].project,
                        category: activeSession[0].category,
                        description: activeSession[0].description,
                      }
                    : null
                }
              />
            </EntryCard>
            <EntryCard title="Team hours leaderboard">
              <div className="divide-y divide-[#333]">
                {leaderboard.map((item, index) => (
                  <div
                    className="grid grid-cols-[44px_1fr_auto] items-center gap-4 py-4"
                    key={item.id}
                  >
                    <span className="font-mono text-sm text-[#fd7803]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <strong>{item.name}</strong>
                      <p className="mt-1 text-xs text-[#777]">{item.role}</p>
                    </div>
                    <strong className="text-right text-[#fd7803]">
                      {formatHours(item.minutes)}
                    </strong>
                  </div>
                ))}
              </div>
            </EntryCard>
            <div className="grid gap-6 xl:grid-cols-2">
              <EntryCard title="Manual hour entry">
                <form action={addHour} className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Date">
                      <CalendarInput name="date" type="date" required />
                    </Field>
                    <Field label="Hours">
                      <input
                        className="input"
                        name="hours"
                        type="number"
                        min="0.25"
                        max="24"
                        step="0.25"
                        required
                      />
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Project">
                      <input
                        className="input"
                        name="project"
                        placeholder="RoboRowdy, VEX U, Outreach…"
                        required
                      />
                    </Field>
                    <Field label="Category">
                      <input
                        className="input"
                        name="category"
                        placeholder="Design, Build, Programming…"
                        required
                      />
                    </Field>
                  </div>
                  <Field label="Description">
                    <textarea
                      className="input min-h-28"
                      name="description"
                      required
                    />
                  </Field>
                  <button className="button w-fit">Save hours</button>
                </form>
              </EntryCard>
              <RecordList title="Hour history" empty="No hours recorded yet.">
                {hours.map((item) => (
                  <div
                    className="flex items-start justify-between gap-5 py-4"
                    key={item.id}
                  >
                    <div>
                      <p className="font-semibold">{item.description}</p>
                      <p className="mt-1 text-xs text-[#777]">
                        {item.workDate.toLocaleDateString()} · {item.project} ·{" "}
                        {item.category}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <strong className="text-[#fd7803]">
                        {formatHours(item.minutes)}
                      </strong>
                      <form action={deleteHour.bind(null, item.id)}>
                        <button className="text-xs text-[#888] hover:text-white">
                          Remove
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </RecordList>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function SetupNotice() {
  return (
    <section className="grid-bg min-h-[680px] py-24">
      <div className="shell">
        <div className="card mx-auto max-w-2xl p-10">
          <p className="eyebrow">Secure portal</p>
          <h1 className="headline">Production access is being connected.</h1>
          <p className="lede mt-6">
            No demo account or browser-only records are available. Return after
            the identity and member database services are active.
          </p>
          <Link className="button secondary mt-8" href="/">
            Return home
          </Link>
        </div>
      </div>
    </section>
  );
}
function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="card p-6">
      <strong className="text-2xl text-[#fd7803]">{value}</strong>
      <p className="mt-2 font-mono text-[.65rem] uppercase tracking-wider text-[#888]">
        {label}
      </p>
    </div>
  );
}
function EntryCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`card p-6 ${className}`}>
      <h2 className="mb-5 text-xl font-bold">{title}</h2>
      {children}
    </div>
  );
}
function RecordList({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const any = Array.isArray(children) && children.length > 0;
  return (
    <div className="card p-6">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-4 divide-y divide-[#333]">
        {any ? children : <p className="py-6 text-sm text-[#777]">{empty}</p>}
      </div>
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

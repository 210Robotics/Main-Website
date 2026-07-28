import type { Metadata } from "next";
import Link from "next/link";
import { DriveSyncForm } from "@/components/drive-sync-form";
import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import { getDb, hasDatabase } from "@/db";
import {
  contributions,
  docCategories,
  docPages,
  galleryEvents,
  activityAttendance,
  attendanceTokens,
  calendarSnapshots,
  inquiries,
  hourEntries,
  internalDocumentRevisions,
  internalDocuments,
  mediaAssets,
  memberProjects,
  members,
  posts,
  projects,
  publicProfileCards,
  publicFormResponses,
  publicForms,
  availabilityPolls,
  availabilityPollResponses,
  publicSettings,
  sponsors,
  teamActivities,
} from "@/db/schema";
import {
  approveMember,
  assertAdmin,
  createPost,
  deleteInquiry,
  deletePost,
  suspendMember,
  updatePost,
  updatePublicMemberCount,
  updateInquiry,
} from "@/app/admin/actions";
import { BlogEditor } from "@/components/blog-editor";
import { hasClerk } from "@/lib/auth";
import {
  accessRoleLabels,
  assignableAccessRoles,
  hasPermission,
  type PermissionKey,
} from "@/lib/permissions";
import { AccountEditor } from "@/components/account-editor";
import { RosterManager } from "@/components/roster-manager";
import { ImageUpload } from "@/components/image-upload";
import { ActionForm } from "@/components/action-form";
import { ActivityLog } from "@/components/activity-log";
import type { ActivityLogRecord } from "@/lib/activity-log";
import { DeleteAccountButton } from "@/components/delete-account-button";
import { RestoreAccountButton } from "@/components/restore-account-button";
import { SponsorManager } from "@/components/sponsor-manager";
import { ActivityManager } from "@/components/activity-manager";
import {
  attendanceIsOpen,
  attendanceUrl,
  buildAttendanceToken,
} from "@/lib/attendance";
import { DocsManager } from "@/components/docs-manager";
import { GalleryManager } from "@/components/gallery-manager";
import { isGalleryMediaSource } from "@/lib/media-policy";
import { CalendarRefreshForm } from "@/components/calendar-refresh-form";
import { FormManager } from "@/components/form-manager";
import { PollManager } from "@/components/poll-manager";
import { DashboardNavigation } from "@/components/dashboard-navigation";
import { WebsiteContentEditor } from "@/components/website-content-editor";
import { InternalDocumentsManager } from "@/components/internal-documents-manager";
import { ConstitutionManager } from "@/components/constitution-manager";
import { AssistantWorkspace } from "@/components/team-os-workspace";
import { DiscordAdminPanel } from "@/components/discord-admin-panel";
import { MembershipDuesPanel } from "@/components/membership-dues-panel";
import { adminLoadPlan, normalizeAdminTab } from "@/lib/workspace-loading";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    period?: string;
    discordQuery?: string;
    recordingTitle?: string;
    voiceChannelId?: string;
  }>;
}) {
  const {
    tab: requestedTab,
    page: websitePage = "home",
    period: duesPeriod,
    discordQuery,
    recordingTitle,
    voiceChannelId,
  } = await searchParams;
  const tab = normalizeAdminTab(requestedTab);
  const load = adminLoadPlan(tab);
  if (!hasClerk() || !hasDatabase()) return <SetupNotice />;
  const actor = await assertAdmin();
  const canMembers = hasPermission(
    actor.accessRole,
    "members.approve",
    actor.permissionOverrides,
  );
  const canContent = hasPermission(
    actor.accessRole,
    "content.manage",
    actor.permissionOverrides,
  );
  const canForms = hasPermission(
    actor.accessRole,
    "forms.manage",
    actor.permissionOverrides,
  );
  const canDocuments = hasPermission(
    actor.accessRole,
    "documents.manage",
    actor.permissionOverrides,
  );
  const canEditMembers = hasPermission(
    actor.accessRole,
    "members.edit",
    actor.permissionOverrides,
  );
  const canDirectory = hasPermission(
    actor.accessRole,
    "directory.manage",
    actor.permissionOverrides,
  );
  const canViewHours = hasPermission(
    actor.accessRole,
    "activity.view_all",
    actor.permissionOverrides,
  );
  const canInquiries = hasPermission(
    actor.accessRole,
    "inquiries.manage",
    actor.permissionOverrides,
  );
  const canMedia = hasPermission(
    actor.accessRole,
    "media.manage",
    actor.permissionOverrides,
  );
  const canSponsors = hasPermission(
    actor.accessRole,
    "sponsors.manage",
    actor.permissionOverrides,
  );
  const canEvents = hasPermission(
    actor.accessRole,
    "events.manage",
    actor.permissionOverrides,
  );
  const canExport = hasPermission(
    actor.accessRole,
    "reports.export",
    actor.permissionOverrides,
  );
  const canAccess = hasPermission(
    actor.accessRole,
    "access.manage",
    actor.permissionOverrides,
  );
  const canDiscord = hasPermission(
    actor.accessRole,
    "integrations.manage",
    actor.permissionOverrides,
  );
  const canDues = hasPermission(
    actor.accessRole,
    "dues.manage",
    actor.permissionOverrides,
  );
  const canEditHours = hasPermission(
    actor.accessRole,
    "activity.edit_all",
    actor.permissionOverrides,
  );
  const canOperations = [
    "tasks.manage",
    "meetings.manage",
    "finance.manage",
    "engineering.manage",
    "glossary.manage",
    "integrations.manage",
    "dues.manage",
  ].some((permission) =>
    hasPermission(
      actor.accessRole,
      permission as PermissionKey,
      actor.permissionOverrides,
    ),
  );
  const canReadMembers =
    canMembers || canEditMembers || canAccess || canViewHours || canEvents;
  const [
    memberRows,
    inquiryRows,
    postRows,
    mediaRows,
    galleryAssetRows,
    galleryEventRows,
    galleryCountRows,
    projectRows,
    assignmentRows,
    hourRows,
    contributionRows,
    settingsRows,
    rosterRows,
    sponsorRows,
    activityRows,
    attendanceRows,
    attendanceTokenRows,
    docCategoryRows,
    docPageRows,
    calendarSnapshotRows,
    formRows,
    formResponseRows,
    pollRows,
    pollResponseRows,
    internalDocumentRows,
    internalDocumentRevisionRows,
  ] = await Promise.all([
    load.members && (canReadMembers || canEvents)
      ? getDb().select().from(members).orderBy(desc(members.createdAt))
      : Promise.resolve([]),
    load.inquiries && canInquiries
      ? getDb()
          .select()
          .from(inquiries)
          .orderBy(desc(inquiries.createdAt))
          .limit(100)
      : Promise.resolve([]),
    load.posts && canContent
      ? getDb().select().from(posts).orderBy(desc(posts.updatedAt))
      : Promise.resolve([]),
    load.media && (canMedia || canContent || canDirectory || canEditMembers || canSponsors)
      ? getDb()
          .select()
          .from(mediaAssets)
          .orderBy(desc(mediaAssets.createdAt))
          .limit(200)
      : Promise.resolve([]),
    load.galleryAssets && canMedia
      ? getDb()
          .select()
          .from(mediaAssets)
          .where(
            and(
              eq(mediaAssets.source, "drive"),
              isNull(mediaAssets.archivedAt),
            ),
          )
          .orderBy(desc(mediaAssets.createdAt))
          .limit(2000)
      : Promise.resolve([]),
    load.galleries && (canMedia || canContent)
      ? getDb()
          .select()
          .from(galleryEvents)
          .where(isNull(galleryEvents.archivedAt))
          .orderBy(asc(galleryEvents.sortOrder), desc(galleryEvents.eventDate))
      : Promise.resolve([]),
    tab === "overview" && canMedia
      ? getDb()
          .select({ value: count() })
          .from(mediaAssets)
          .where(
            and(
              eq(mediaAssets.source, "drive"),
              eq(mediaAssets.published, true),
              isNull(mediaAssets.archivedAt),
            ),
          )
      : Promise.resolve([]),
    load.projects && (canMembers || canEditMembers)
      ? getDb().select().from(projects)
      : Promise.resolve([]),
    load.assignments && canEditMembers
      ? getDb().select().from(memberProjects)
      : Promise.resolve([]),
    load.activity && canViewHours
      ? getDb()
          .select({
            hour: hourEntries,
            memberName: members.displayName,
            memberRole: members.organizationRole,
          })
          .from(hourEntries)
          .innerJoin(members, eq(hourEntries.memberId, members.id))
          .where(isNull(hourEntries.deletedAt))
          .orderBy(desc(hourEntries.workDate))
          .limit(250)
      : Promise.resolve([]),
    load.activity && canViewHours
      ? getDb()
          .select({
            contribution: contributions,
            memberName: members.displayName,
            memberRole: members.organizationRole,
          })
          .from(contributions)
          .innerJoin(members, eq(contributions.memberId, members.id))
          .where(isNull(contributions.deletedAt))
          .orderBy(desc(contributions.contributionDate))
          .limit(250)
      : Promise.resolve([]),
    load.settings &&
    (actor.accessRole === "SUPER_ADMIN" ||
      canContent ||
      (tab === "constitution" && canDocuments))
      ? getDb().select().from(publicSettings).limit(1)
      : Promise.resolve([]),
    load.roster && canDirectory
      ? getDb()
          .select({ card: publicProfileCards, blobUrl: mediaAssets.blobUrl })
          .from(publicProfileCards)
          .leftJoin(
            mediaAssets,
            eq(mediaAssets.id, publicProfileCards.photoMediaId),
          )
          .orderBy(
            publicProfileCards.page,
            publicProfileCards.section,
            publicProfileCards.sortOrder,
          )
      : Promise.resolve([]),
    load.sponsors && canSponsors
      ? getDb()
          .select({ sponsor: sponsors, blobUrl: mediaAssets.blobUrl })
          .from(sponsors)
          .leftJoin(mediaAssets, eq(mediaAssets.id, sponsors.logoMediaId))
          .orderBy(asc(sponsors.sortOrder), asc(sponsors.name))
      : Promise.resolve([]),
    load.events && (canEvents || canViewHours)
      ? getDb()
          .select()
          .from(teamActivities)
          .orderBy(desc(teamActivities.startsAt))
      : Promise.resolve([]),
    load.attendance && (canEvents || canViewHours)
      ? getDb()
          .select({
            attendance: activityAttendance,
            memberName: members.displayName,
            memberRole: members.organizationRole,
          })
          .from(activityAttendance)
          .innerJoin(members, eq(members.id, activityAttendance.memberId))
          .orderBy(desc(activityAttendance.checkedInAt))
      : Promise.resolve([]),
    load.attendanceTokens && canEvents
      ? getDb()
          .select()
          .from(attendanceTokens)
          .where(isNull(attendanceTokens.revokedAt))
          .orderBy(desc(attendanceTokens.createdAt))
      : Promise.resolve([]),
    load.docs && canContent
      ? getDb()
          .select()
          .from(docCategories)
          .where(isNull(docCategories.archivedAt))
          .orderBy(asc(docCategories.sortOrder), asc(docCategories.title))
      : Promise.resolve([]),
    load.docs && canContent
      ? getDb()
          .select()
          .from(docPages)
          .orderBy(asc(docPages.sortOrder), asc(docPages.title))
      : Promise.resolve([]),
    load.calendar && canEvents
      ? getDb()
          .select()
          .from(calendarSnapshots)
          .where(eq(calendarSnapshots.id, "shared"))
          .limit(1)
      : Promise.resolve([]),
    load.forms && canForms
      ? getDb().select().from(publicForms).orderBy(desc(publicForms.updatedAt))
      : Promise.resolve([]),
    load.formResponses && canForms
      ? getDb()
          .select({
            response: publicFormResponses,
            memberName: members.displayName,
          })
          .from(publicFormResponses)
          .leftJoin(
            members,
            eq(members.id, publicFormResponses.submittedByMemberId),
          )
          .orderBy(desc(publicFormResponses.submittedAt))
      : Promise.resolve([]),
    load.polls && canForms
      ? getDb()
          .select()
          .from(availabilityPolls)
          .orderBy(desc(availabilityPolls.updatedAt))
      : Promise.resolve([]),
    load.pollResponses && canForms
      ? getDb()
          .select({
            response: availabilityPollResponses,
            memberName: members.displayName,
          })
          .from(availabilityPollResponses)
          .leftJoin(
            members,
            eq(members.id, availabilityPollResponses.submittedByMemberId),
          )
          .orderBy(desc(availabilityPollResponses.updatedAt))
      : Promise.resolve([]),
    load.documents && canDocuments
      ? getDb()
          .select({
            document: internalDocuments,
            updatedBy: members.displayName,
          })
          .from(internalDocuments)
          .leftJoin(
            members,
            eq(members.id, internalDocuments.updatedByMemberId),
          )
          .where(isNull(internalDocuments.archivedAt))
          .orderBy(desc(internalDocuments.updatedAt))
      : Promise.resolve([]),
    load.documents && canDocuments
      ? getDb()
          .select({
            revision: internalDocumentRevisions,
            editorName: members.displayName,
          })
          .from(internalDocumentRevisions)
          .leftJoin(
            members,
            eq(members.id, internalDocumentRevisions.editorMemberId),
          )
          .orderBy(
            desc(internalDocumentRevisions.createdAt),
            desc(internalDocumentRevisions.versionNumber),
          )
      : Promise.resolve([]),
  ]);
  const siteSettings = settingsRows[0];
  const pending = memberRows.filter((member) => member.status === "PENDING");
  const activityManagerRows = activityRows.map((activity) => {
    const token = attendanceTokenRows.find(
      (candidate) => candidate.activityId === activity.id,
    );
    const tokenOpen =
      token &&
      attendanceIsOpen({
        openedAt: activity.attendanceOpenedAt,
        closesAt: activity.attendanceClosesAt,
        tokenExpiresAt: token.expiresAt,
        tokenRevokedAt: token.revokedAt,
      });
    return {
      ...activity,
      startsAt: activity.startsAt.toISOString(),
      endsAt: activity.endsAt.toISOString(),
      archivedAt: activity.archivedAt?.toISOString() ?? null,
      attendanceOpenedAt: activity.attendanceOpenedAt?.toISOString() ?? null,
      attendanceClosesAt: activity.attendanceClosesAt?.toISOString() ?? null,
      checkInUrl:
        tokenOpen && token
          ? attendanceUrl(buildAttendanceToken(token.id).token)
          : null,
      attendees: attendanceRows
        .filter((row) => row.attendance.activityId === activity.id)
        .map((row) => ({
          id: row.attendance.id,
          memberId: row.attendance.memberId,
          name: row.memberName,
          role: row.memberRole,
          checkedInAt: row.attendance.checkedInAt.toISOString(),
          method: row.attendance.method,
          status: row.attendance.status,
        })),
    };
  });
  const activityRecords: ActivityLogRecord[] = [
    ...hourRows.map(({ hour, memberName, memberRole }) => ({
      id: hour.id,
      type: "hour" as const,
      memberId: hour.memberId,
      memberName,
      memberRole,
      date: hour.workDate.toISOString().slice(0, 10),
      project: hour.project,
      category: hour.category,
      description: hour.description,
      createdAt: hour.createdAt.toISOString(),
      minutes: hour.minutes,
    })),
    ...contributionRows.map(({ contribution, memberName, memberRole }) => ({
      id: contribution.id,
      type: "contribution" as const,
      memberId: contribution.memberId,
      memberName,
      memberRole,
      date: contribution.contributionDate.toISOString().slice(0, 10),
      project: contribution.project,
      category: contribution.category,
      description: contribution.description,
      createdAt: contribution.createdAt.toISOString(),
      title: contribution.title,
      evidenceUrl: contribution.evidenceUrl,
    })),
  ].sort(
    (a, b) =>
      b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );
  const galleryRows = (canMedia ? galleryAssetRows : mediaRows).filter(
    (asset) =>
      isGalleryMediaSource(asset.source) &&
      asset.published &&
      !asset.archivedAt,
  );
  return (
    <section className="min-h-screen bg-[#090909] grid-bg">
      <div
        className={`shell admin-workspace py-8 sm:py-10 ${tab === "website" ? "admin-website-shell" : ""}`}
      >
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Administration</p>
            <h1 className="mt-3 text-4xl font-bold tracking-[-.04em]">
              Team control center.
            </h1>
            <p className="mt-3 text-sm text-[#888]">
              Signed in as {actor.displayName} ·{" "}
              {actor.accessRole.replaceAll("_", " ")}
            </p>
          </div>
          <Link className="button secondary" href="/portal">
            Member portal
          </Link>
        </div>
        {tab === "overview" && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {canReadMembers && (
            <Metric
              value={String(
                memberRows.filter((m) => m.status === "ACTIVE").length,
              )}
              label="Active members"
            />
          )}
          {canMembers && (
            <Metric value={String(pending.length)} label="Pending approval" />
          )}
          {canInquiries && (
            <Metric
              value={String(
                inquiryRows.filter((i) => i.status === "NEW").length,
              )}
              label="New inquiries"
            />
          )}
          {canContent && (
            <Metric
              value={String(
                postRows.filter((p) => p.status === "PUBLISHED").length,
              )}
              label="Published stories"
            />
          )}
          {canForms && (
            <Metric
              value={String(
                formRows.filter((form) => form.status === "OPEN").length,
              )}
              label="Open forms"
            />
          )}
        </div>}
        <DashboardNavigation
          current={tab}
          label="Admin dashboard sections"
          items={[
            { value: "overview", label: "Overview", href: "/admin" },
            ...(canEvents
              ? [
                  {
                    value: "events",
                    label: "Events & attendance",
                    href: "/admin?tab=events",
                  },
                ]
              : []),
            ...(canOperations
              ? [
                  {
                    value: "operations",
                    label: "Operations",
                    href: "/admin/operations",
                  },
                  {
                    value: "control",
                    label: "Control center",
                    href: "/admin/control-center",
                  },
                  {
                    value: "assistant",
                    label: "AI assistant",
                    href: "/admin?tab=assistant",
                  },
                ]
              : []),
            ...(canViewHours
              ? [
                  {
                    value: "activity",
                    label: "Activity records",
                    href: "/admin?tab=activity",
                  },
                ]
              : []),
            ...(canReadMembers || canDirectory
              ? [
                  {
                    value: "members",
                    label: "Members & roster",
                    href: "/admin?tab=members",
                  },
                ]
              : []),
            ...(canDiscord
              ? [
                  {
                    value: "discord",
                    label: "Discord",
                    href: "/admin?tab=discord",
                  },
                ]
              : []),
            ...(canDues
              ? [
                  {
                    value: "dues",
                    label: "Membership dues",
                    href: "/admin?tab=dues",
                  },
                ]
              : []),
            ...(canForms
              ? [
                  { value: "forms", label: "Forms", href: "/admin?tab=forms" },
                  {
                    value: "polls",
                    label: "Scheduling polls",
                    href: "/admin?tab=polls",
                  },
                ]
              : []),
            ...(canContent
              ? [
                  {
                    value: "website",
                    label: "Website pages",
                    href: "/admin?tab=website",
                  },
                  {
                    value: "content",
                    label: "News",
                    href: "/admin?tab=content",
                  },
                  {
                    value: "docs",
                    label: "Documentation",
                    href: "/admin?tab=docs",
                  },
                ]
              : []),
            ...(canDocuments
              ? [
                  {
                    value: "constitution",
                    label: "Constitution",
                    href: "/admin?tab=constitution",
                  },
                  {
                    value: "documents",
                    label: "Internal documents",
                    href: "/admin?tab=documents",
                  },
                ]
              : []),
            ...(canSponsors
              ? [
                  {
                    value: "sponsors",
                    label: "Sponsors",
                    href: "/admin?tab=sponsors",
                  },
                ]
              : []),
            ...(canMedia
              ? [
                  {
                    value: "media",
                    label: "Media gallery",
                    href: "/admin?tab=media",
                  },
                ]
              : []),
            ...(canInquiries
              ? [
                  {
                    value: "inquiries",
                    label: "Inbox",
                    href: "/admin?tab=inquiries",
                  },
                ]
              : []),
          ]}
        />
        {canDiscord && tab === "discord" && (
          <DiscordAdminPanel
            searchQuery={discordQuery}
            recordingTitle={recordingTitle}
            voiceChannelId={voiceChannelId}
          />
        )}
        {canDues && tab === "dues" && (
          <MembershipDuesPanel period={duesPeriod} />
        )}
        {canContent && tab === "website" && (
          <Panel
            id="website-content-editor"
            title="Website pages"
            eyebrow="Live text and photography without a redeploy"
          >
            <WebsiteContentEditor
              pageId={websitePage}
              overrides={siteSettings?.pageContent ?? {}}
              customPages={siteSettings?.customPages ?? []}
              uploaderId={actor.id}
            />
          </Panel>
        )}
        {tab === "overview" && (
          <Panel
            id="admin-overview"
            title="Overview"
            eyebrow="What needs attention across 210 Robotics"
          >
            <p className="max-w-3xl text-sm leading-7 text-[#999]">
              Review current work, jump into the areas you manage, and keep the
              public website, team records, and documentation moving forward.
            </p>
            <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {canMembers && (
                <OverviewCard
                  value={String(pending.length)}
                  title="Pending member approvals"
                  detail={
                    pending.length
                      ? "Accounts are waiting for review."
                      : "No accounts are waiting."
                  }
                  href="/admin?tab=members"
                />
              )}
              {canInquiries && (
                <OverviewCard
                  value={String(
                    inquiryRows.filter((inquiry) => inquiry.status === "NEW")
                      .length,
                  )}
                  title="New inbox messages"
                  detail="Review requests from prospective members and partners."
                  href="/admin?tab=inquiries"
                />
              )}
              {canContent && (
                <OverviewCard
                  value={String(
                    docPageRows.filter((page) => page.status === "DRAFT")
                      .length,
                  )}
                  title="Documentation drafts"
                  detail={`${docPageRows.filter((page) => page.status === "PUBLISHED").length} pages are currently published.`}
                  href="/admin?tab=docs"
                />
              )}
              {canEvents && (
                <OverviewCard
                  value={String(
                    activityRows.filter(
                      (activity) =>
                        activity.status === "SCHEDULED" &&
                        !activity.archivedAt &&
                        activity.startsAt >= new Date(),
                    ).length,
                  )}
                  title="Upcoming activities"
                  detail="Manage meetings, workshops, outreach, and attendance."
                  href="/admin?tab=events"
                />
              )}
              {canForms && (
                <OverviewCard
                  value={String(formResponseRows.length)}
                  title="Form responses"
                  detail={`${formRows.filter((form) => form.status === "OPEN").length} forms are open now.`}
                  href="/admin?tab=forms"
                />
              )}
              {canMedia && (
                <OverviewCard
                  value={String(galleryCountRows[0]?.value ?? 0)}
                  title="Published gallery assets"
                  detail="Review and organize the public media gallery."
                  href="/admin?tab=media"
                />
              )}
              {canOperations && (
                <OverviewCard
                  value="LIVE"
                  title="Leadership control center"
                  detail="Risks, project health, recognition, decisions, shop queue, automations, templates, and sponsors."
                  href="/admin/control-center"
                />
              )}
            </div>
            <div className="mt-8 border-t border-[#333] pt-6">
              <h3 className="text-lg font-bold">Quick links</h3>
              <div className="mt-4 flex flex-wrap gap-3">
                {canContent && (
                  <Link className="button" href="/admin?tab=docs">
                    Edit documentation
                  </Link>
                )}
                {canContent && (
                  <Link className="button secondary" href="/admin?tab=content">
                    Manage news
                  </Link>
                )}
                {canEvents && (
                  <Link className="button secondary" href="/admin?tab=events">
                    Manage events
                  </Link>
                )}
                {canOperations && (
                  <Link className="button" href="/admin/control-center">
                    Open control center
                  </Link>
                )}
                <Link className="button secondary" href="/docs">
                  View public docs
                </Link>
                <Link className="button secondary" href="/doxygen/index.html">
                  Open Doxygen
                </Link>
              </div>
            </div>
          </Panel>
        )}
        {canOperations && tab === "assistant" && <AssistantWorkspace uploaderId={actor.id} />}
        {canEvents && tab === "events" && (
          <Panel
            id="events-attendance"
            title="Events & attendance"
            eyebrow="Meetings, workshops, outreach, and training"
          >
            <CalendarRefreshForm
              lastSyncedAt={
                calendarSnapshotRows[0]?.syncedAt.toISOString() ?? null
              }
            />
            <ActivityManager
              activities={activityManagerRows}
              members={memberRows
                .filter((member) => member.status === "ACTIVE")
                .map((member) => ({
                  id: member.id,
                  name: member.displayName,
                  role: member.organizationRole,
                }))}
              canExport={canExport}
            />
          </Panel>
        )}
        {canContent && tab === "docs" && (
          <Panel
            id="documentation-editor"
            title="Team documentation"
            eyebrow="Engineering notebook, code, and team wiki"
          >
            <DocsManager
              key={`${docCategoryRows.map((category) => `${category.id}:${category.sortOrder}`).join("|")}-${docPageRows.map((page) => `${page.id}:${page.categoryId}:${page.sortOrder}`).join("|")}`}
              uploaderId={actor.id}
              categories={docCategoryRows.map((category) => ({
                id: category.id,
                parentId: category.parentId,
                slug: category.slug,
                title: category.title,
                sortOrder: category.sortOrder,
              }))}
              pages={docPageRows.map((page) => ({
                id: page.id,
                categoryId: page.categoryId,
                title: page.title,
                path: page.path,
                summary: page.summary,
                bodyHtml: page.bodyHtml,
                bodyJson: page.bodyJson,
                visibility: page.visibility,
                status: page.status,
                sortOrder: page.sortOrder,
                updatedAt: page.updatedAt.toISOString(),
              }))}
            />
          </Panel>
        )}
        {canDocuments && tab === "documents" && (
          <Panel
            id="internal-document-archive"
            title="Documents"
            eyebrow="Private DOCX and PDF archive"
          >
            <InternalDocumentsManager
              uploaderId={actor.id}
              documents={internalDocumentRows.map(
                ({ document, updatedBy }) => ({
                  id: document.id,
                  title: document.title,
                  description: document.description,
                  category: document.category,
                  originalFilename: document.originalFilename,
                  mimeType: document.mimeType,
                  bytes: document.bytes,
                  contentHtml: document.contentHtml,
                  editable: document.editable,
                  driveWebViewLink: document.driveWebViewLink,
                  driveSyncStatus: document.driveSyncStatus,
                  currentVersion: document.currentVersion,
                  updatedAt: document.updatedAt.toISOString(),
                  updatedBy: updatedBy || "Former member",
                }),
              )}
              revisions={internalDocumentRevisionRows.map(
                ({ revision, editorName }) => ({
                  id: revision.id,
                  documentId: revision.documentId,
                  versionNumber: revision.versionNumber,
                  reason: revision.reason,
                  createdAt: revision.createdAt.toISOString(),
                  editorName: editorName || "Former member",
                }),
              )}
            />
          </Panel>
        )}
        {canDocuments && tab === "constitution" && (
          <Panel
            id="constitution-manager"
            title="Organization constitution"
            eyebrow="Upload, archive, and publish the current approved version"
          >
            <ConstitutionManager
              uploaderId={actor.id}
              documents={internalDocumentRows
                .filter(
                  ({ document }) =>
                    document.category.trim().toLowerCase() === "constitution",
                )
                .map(({ document }) => ({
                  id: document.id,
                  title: document.title,
                  originalFilename: document.originalFilename,
                  mimeType: document.mimeType,
                  bytes: document.bytes,
                  currentVersion: document.currentVersion,
                  updatedAt: document.updatedAt.toISOString(),
                }))}
              publishedDocumentId={
                siteSettings?.constitutionDocumentId ?? null
              }
              publishedVersion={siteSettings?.constitutionVersion ?? null}
              effectiveDate={
                siteSettings?.constitutionEffectiveDate?.toISOString() ?? null
              }
              publishedAt={
                siteSettings?.constitutionPublishedAt?.toISOString() ?? null
              }
            />
          </Panel>
        )}
        {canForms && tab === "forms" && (
          <Panel
            id="form-manager"
            title="Forms"
            eyebrow="Private links, QR sharing, responses, and analytics"
          >
            <p className="mb-6 max-w-3xl text-sm leading-7 text-[#999]">
              Build branded forms that stay unlisted from the public website.
              Anyone with the exact link or QR code can respond without creating
              an account.
            </p>
            <FormManager
              uploaderId={actor.id}
              forms={formRows.map((form) => ({
                id: form.id,
                accessKey: form.accessKey,
                title: form.title,
                descriptionHtml: form.descriptionHtml,
                confirmationMessage: form.confirmationMessage,
                fields: form.fields,
                status: form.status,
                responseCount: form.responseCount,
                updatedAt: form.updatedAt.toISOString(),
              }))}
              responses={formResponseRows.map(({ response, memberName }) => ({
                id: response.id,
                formId: response.formId,
                answers: response.answers,
                submittedAt: response.submittedAt.toISOString(),
                updatedAt: response.updatedAt.toISOString(),
                respondentName: response.respondentName,
                respondentEmail: response.respondentEmail,
                memberName,
              }))}
            />
          </Panel>
        )}
        {canForms && tab === "polls" && (
          <Panel
            id="poll-manager"
            title="Scheduling polls"
            eyebrow="Private links, QR sharing, availability, and best overlap"
          >
            <p className="mb-6 max-w-3xl text-sm leading-7 text-[#999]">
              Offer possible dates and time blocks, then send one private link.
              Guests can respond without an account and the strongest overlaps
              rise to the top automatically.
            </p>
            <PollManager
              polls={pollRows.map((poll) => ({
                id: poll.id,
                accessKey: poll.accessKey,
                title: poll.title,
                description: poll.description,
                timezone: poll.timezone,
                dates: poll.dates,
                startTime: poll.startTime,
                endTime: poll.endTime,
                slotMinutes: poll.slotMinutes,
                status: poll.status,
                responseCount: poll.responseCount,
                updatedAt: poll.updatedAt.toISOString(),
              }))}
              responses={pollResponseRows.map(({ response, memberName }) => ({
                id: response.id,
                pollId: response.pollId,
                name: response.name,
                email: response.email,
                availableSlots: response.availableSlots,
                submittedAt: response.submittedAt.toISOString(),
                updatedAt: response.updatedAt.toISOString(),
                memberName,
              }))}
            />
          </Panel>
        )}
        {actor.accessRole === "SUPER_ADMIN" && tab === "members" && (
          <Panel title="Public member count" eyebrow="Homepage statistic">
            <form
              action={updatePublicMemberCount}
              className="grid gap-5 md:grid-cols-[1fr_220px_auto] md:items-end"
            >
              <label className="flex items-center gap-3 text-sm text-[#bbb]">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={siteSettings?.memberCountOverrideEnabled}
                />
                Use a manual count instead of the approved-account total
              </label>
              <Field label="Manual member count">
                <input
                  className="input"
                  name="memberCount"
                  type="number"
                  min="0"
                  max="9999"
                  defaultValue={
                    siteSettings?.memberCountOverride ??
                    Math.max(
                      12,
                      memberRows.filter((member) => member.status === "ACTIVE")
                        .length,
                    )
                  }
                />
              </Field>
              <button className="button">Save homepage count</button>
            </form>
          </Panel>
        )}
        {canMembers && tab === "members" && (
          <Panel title="Pending accounts" eyebrow="Members">
            <div className="space-y-4">
              {pending.length ? (
                pending.map((member) => (
                  <form
                    action={approveMember}
                    className="grid gap-4 border-t border-[#333] pt-5"
                    key={member.id}
                  >
                    <input type="hidden" name="memberId" value={member.id} />
                    <div>
                      <strong>{member.displayName}</strong>
                      <p className="mt-1 text-xs text-[#777]">{member.email}</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Public display name">
                        <input
                          className="input"
                          name="displayName"
                          defaultValue={member.displayName}
                          required
                        />
                      </Field>
                      <Field label="Organization title">
                        <input
                          className="input"
                          name="organizationRole"
                          defaultValue="Member"
                          required
                        />
                      </Field>
                      <Field label="Portal access">
                        <select
                          className="input"
                          name="accessRole"
                          defaultValue="MEMBER"
                        >
                          {assignableAccessRoles
                            .filter(
                              (role) =>
                                actor.accessRole === "SUPER_ADMIN" ||
                                role !== "FULL_ADMIN",
                            )
                            .map((role) => (
                              <option key={role} value={role}>
                                {accessRoleLabels[role]}
                              </option>
                            ))}
                        </select>
                      </Field>
                    </div>
                    <ProjectChecks projects={projectRows} />
                    <button className="button w-fit">Approve</button>
                  </form>
                ))
              ) : (
                <Empty>No accounts are waiting.</Empty>
              )}
            </div>
          </Panel>
        )}
        {canReadMembers && tab === "members" && (
          <Panel title="Member directory" eyebrow="Active and suspended">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="font-mono text-[.65rem] uppercase tracking-wider text-[#777]">
                  <tr>
                    <th className="pb-4">Member</th>
                    <th>Organization title</th>
                    <th>Access</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#333]">
                  {memberRows.map((member) => (
                    <tr key={member.id}>
                      <td className="py-4">
                        {canEditMembers ||
                        canAccess ||
                        canViewHours ||
                        canEvents ? (
                          <AccountEditor
                            account={{
                              id: member.id,
                              displayName: member.displayName,
                              email: member.email,
                              organizationRole: member.organizationRole,
                              bio: member.bio,
                              accessRole: member.accessRole,
                              permissionOverrides: member.permissionOverrides,
                              isPublic: member.isPublic,
                              photoUrl:
                                mediaRows.find(
                                  (asset) => asset.id === member.photoMediaId,
                                )?.blobUrl ?? member.photoUrl,
                            }}
                            uploaderId={actor.id}
                            projects={projectRows}
                            selectedProjects={assignmentRows
                              .filter((row) => row.memberId === member.id)
                              .map((row) => row.projectId)}
                            canEditProfile={canEditMembers}
                            canEditAccess={canAccess}
                            isSuperAdmin={actor.accessRole === "SUPER_ADMIN"}
                            isSelf={actor.id === member.id}
                            triggerLabel={member.displayName}
                            triggerClassName="text-left font-bold text-white transition-colors hover:text-[#fd7803] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#fd7803]"
                            activity={
                              canViewHours || canEvents
                                ? {
                                    hours: hourRows
                                      .filter(
                                        (row) =>
                                          row.hour.memberId === member.id,
                                      )
                                      .map((row) => ({
                                        id: row.hour.id,
                                        date: row.hour.workDate.toLocaleDateString(
                                          "en-US",
                                          { timeZone: "America/Chicago" },
                                        ),
                                        minutes: row.hour.minutes,
                                        project: row.hour.project,
                                        category: row.hour.category,
                                        description: row.hour.description,
                                      })),
                                    contributions: contributionRows
                                      .filter(
                                        (row) =>
                                          row.contribution.memberId ===
                                          member.id,
                                      )
                                      .map((row) => ({
                                        id: row.contribution.id,
                                        date: row.contribution.contributionDate.toLocaleDateString(
                                          "en-US",
                                          { timeZone: "America/Chicago" },
                                        ),
                                        title: row.contribution.title,
                                        project: row.contribution.project,
                                        category: row.contribution.category,
                                        description:
                                          row.contribution.description,
                                      })),
                                    attendance: attendanceRows
                                      .filter(
                                        (row) =>
                                          row.attendance.memberId ===
                                            member.id &&
                                          row.attendance.status === "PRESENT",
                                      )
                                      .map((row) => {
                                        const activity = activityRows.find(
                                          (item) =>
                                            item.id ===
                                            row.attendance.activityId,
                                        );
                                        return {
                                          id: row.attendance.id,
                                          date: row.attendance.checkedInAt.toLocaleDateString(
                                            "en-US",
                                            { timeZone: "America/Chicago" },
                                          ),
                                          title:
                                            activity?.title ?? "Team activity",
                                          type: activity?.type ?? "EVENT",
                                          topic: activity?.topic ?? null,
                                          location: activity?.location ?? null,
                                        };
                                      }),
                                  }
                                : undefined
                            }
                          />
                        ) : (
                          <strong>{member.displayName}</strong>
                        )}
                        <p className="mt-1 text-xs text-[#777]">
                          {member.email}
                        </p>
                      </td>
                      <td>{member.organizationRole}</td>
                      <td>{member.accessRole.replaceAll("_", " ")}</td>
                      <td
                        className={
                          member.status === "ACTIVE"
                            ? "text-emerald-400"
                            : "text-[#aaa]"
                        }
                      >
                        {member.status}
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          {canMembers &&
                            member.status === "ACTIVE" &&
                            member.accessRole !== "SUPER_ADMIN" && (
                              <form action={suspendMember}>
                                <input
                                  type="hidden"
                                  name="memberId"
                                  value={member.id}
                                />
                                <button className="text-xs text-[#999] hover:text-white">
                                  Suspend
                                </button>
                              </form>
                            )}
                          {canMembers && member.status === "SUSPENDED" && (
                            <RestoreAccountButton
                              memberId={member.id}
                              memberName={member.displayName}
                            />
                          )}
                          {actor.accessRole === "SUPER_ADMIN" &&
                            member.id !== actor.id && (
                              <DeleteAccountButton
                                memberId={member.id}
                                memberName={member.displayName}
                              />
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
        {canViewHours && tab === "activity" && (
          <Panel title="Team activity log" eyebrow="Hours and contributions">
            <ActivityLog records={activityRecords} canEdit={canEditHours} />
          </Panel>
        )}
        {canContent && tab === "content" && (
          <Panel title="Write a news post" eyebrow="Blog editor">
            <ActionForm
              action={createPost}
              successMessage="Story saved."
              className="grid gap-5"
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Title">
                  <input className="input" name="title" required />
                </Field>
                <Field label="URL slug">
                  <input
                    className="input"
                    name="slug"
                    pattern="[a-z0-9-]+"
                    placeholder="shop-update"
                    required
                  />
                </Field>
              </div>
              <Field label="Excerpt">
                <textarea className="input min-h-24" name="excerpt" required />
              </Field>
              <Field label="Cover image">
                <ImageUpload
                  name="coverMediaId"
                  removeName="removeCover"
                  purpose="post-cover"
                  uploaderId={actor.id}
                  label="Choose cover image"
                />
              </Field>
              <GalleryAttachmentFields events={galleryEventRows} />
              <Field label="Article and social media embeds">
                <textarea
                  className="input min-h-28"
                  name="embedUrls"
                  placeholder={
                    "One HTTPS link per line\nhttps://www.youtube.com/watch?v=…\nhttps://www.instagram.com/p/…"
                  }
                />
                <span className="text-xs leading-5 text-[#777]">
                  Add articles, YouTube, Vimeo, Instagram, TikTok, Facebook,
                  LinkedIn, or X links. Safe previews appear below the story.
                </span>
              </Field>
              <Field label="Story">
                <BlogEditor />
              </Field>
              <div className="flex flex-wrap gap-3">
                <select className="input !w-auto" name="status">
                  <option value="DRAFT">Save draft</option>
                  <option value="PUBLISHED">Publish now</option>
                </select>
                <button className="button">Save story</button>
              </div>
            </ActionForm>
            <div className="mt-8 divide-y divide-[#333] border-t border-[#333]">
              {postRows.map((post) => (
                <details className="py-4" key={post.id}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                    <div>
                      <strong>{post.title}</strong>
                      <p className="mt-1 text-xs text-[#777]">/{post.slug}</p>
                    </div>
                    <span className="tag">{post.status} · Edit</span>
                  </summary>
                  <ActionForm
                    action={updatePost}
                    successMessage="Story changes saved."
                    className="mt-6 grid gap-5 border border-[#333] p-5"
                  >
                    <input type="hidden" name="postId" value={post.id} />
                    <div className="grid gap-5 md:grid-cols-2">
                      <Field label="Title">
                        <input
                          className="input"
                          name="title"
                          defaultValue={post.title}
                          required
                        />
                      </Field>
                      <Field label="URL slug">
                        <input
                          className="input"
                          name="slug"
                          pattern="[a-z0-9-]+"
                          defaultValue={post.slug}
                          required
                        />
                      </Field>
                    </div>
                    <Field label="Excerpt">
                      <textarea
                        className="input min-h-24"
                        name="excerpt"
                        defaultValue={post.excerpt}
                        required
                      />
                    </Field>
                    <Field label="Cover image">
                      <ImageUpload
                        name="coverMediaId"
                        removeName="removeCover"
                        purpose="post-cover"
                        uploaderId={actor.id}
                        currentUrl={
                          mediaRows.find(
                            (asset) => asset.id === post.coverMediaId,
                          )?.blobUrl ?? post.coverImageUrl
                        }
                        label="Replace cover image"
                      />
                    </Field>
                    <GalleryAttachmentFields
                      events={galleryEventRows}
                      currentIds={
                        post.galleryEventIds.length
                          ? post.galleryEventIds
                          : post.galleryEventId
                            ? [post.galleryEventId]
                            : []
                      }
                    />
                    <Field label="Article and social media embeds">
                      <textarea
                        className="input min-h-28"
                        name="embedUrls"
                        defaultValue={post.embedUrls.join("\n")}
                        placeholder="One HTTPS link per line"
                      />
                    </Field>
                    <Field label="Story">
                      <BlogEditor name="bodyHtml" initial={post.bodyHtml} />
                    </Field>
                    <div className="flex flex-wrap gap-3">
                      <select
                        className="input !w-auto"
                        name="status"
                        defaultValue={
                          post.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"
                        }
                      >
                        <option value="DRAFT">Draft</option>
                        <option value="PUBLISHED">Published</option>
                      </select>
                      <button className="button">Save changes</button>
                    </div>
                  </ActionForm>
                  <form action={deletePost} className="mt-3">
                    <input type="hidden" name="postId" value={post.id} />
                    <button className="text-xs text-red-400 hover:text-red-300">
                      Delete story permanently
                    </button>
                  </form>
                </details>
              ))}
            </div>
          </Panel>
        )}
        {canDirectory && tab === "members" && (
          <Panel title="Public team and program cards" eyebrow="Roster manager">
            <p className="mb-6 max-w-3xl text-sm leading-7 text-[#999]">
              Each page keeps an independent card. Updating a student here
              changes only the selected page and section.
            </p>
            <RosterManager
              uploaderId={actor.id}
              cards={rosterRows.map(({ card, blobUrl }) => ({
                id: card.id,
                page: card.page,
                section: card.section,
                name: card.name,
                title: card.title,
                bio: card.bio,
                photoUrl: blobUrl ?? card.photoUrl,
                sortOrder: card.sortOrder,
                published: card.published,
                archivedAt: card.archivedAt,
              }))}
            />
          </Panel>
        )}
        {canSponsors && tab === "sponsors" && (
          <Panel
            id="sponsor-manager"
            title="Sponsor manager"
            eyebrow="Sponsors"
          >
            <SponsorManager
              uploaderId={actor.id}
              sponsors={sponsorRows.map(({ sponsor, blobUrl }) => ({
                id: sponsor.id,
                name: sponsor.name,
                sponsorship: sponsor.sponsorship,
                tier: sponsor.tier,
                websiteUrl: sponsor.websiteUrl,
                logoUrl: blobUrl ?? sponsor.logoUrl,
                sortOrder: sponsor.sortOrder,
                published: sponsor.published,
              }))}
            />
          </Panel>
        )}
        {canMedia && tab === "media" && (
          <Panel title="Shared Drive media" eyebrow="Automatic publishing">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <p className="max-w-2xl text-sm leading-7 text-[#999]">
                Synchronize supported photos from the approved shared Drive
                folder. New images publish automatically after validation and
                optimization.
              </p>
              <DriveSyncForm />
            </div>
            <GalleryManager
              uploaderId={actor.id}
              events={[
                ...galleryEventRows.map((event) => ({
                  id: event.id,
                  title: event.title,
                  description: event.description,
                  eventDate: event.eventDate?.toISOString() ?? null,
                  driveFolderId: event.driveFolderId,
                  published: event.published,
                  legacyAlbum: null,
                })),
                ...[
                  ...new Set(
                    galleryRows
                      .filter((asset) => !asset.galleryEventId)
                      .map((asset) => asset.album)
                      .filter(Boolean),
                  ),
                ]
                  .filter(
                    (album) =>
                      !galleryEventRows.some(
                        (event) =>
                          event.title.toLowerCase() === album.toLowerCase(),
                      ),
                  )
                  .map((album) => ({
                    id: `legacy:${encodeURIComponent(album)}`,
                    title: album,
                    description: "Existing Drive gallery",
                    eventDate: null,
                    driveFolderId: null,
                    published: true,
                    legacyAlbum: album,
                  })),
              ]}
              assets={galleryRows.map((asset) => ({
                id: asset.id,
                blobUrl: asset.blobUrl,
                filename: asset.filename,
                mimeType: asset.mimeType,
                alt: asset.alt,
                album: asset.album,
                galleryEventId: asset.galleryEventId,
              }))}
            />
          </Panel>
        )}
        {canInquiries && tab === "inquiries" && (
          <Panel title="Inquiry inbox" eyebrow="Contact, join, and sponsors">
            <div className="divide-y divide-[#333]">
              {inquiryRows.length ? (
                inquiryRows.map((inquiry) => (
                  <article className="py-5" key={inquiry.id}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <span className="tag">{inquiry.kind}</span>
                        <h3 className="mt-3 text-lg font-bold">
                          {inquiry.name}
                        </h3>
                        <a
                          className="mt-1 block text-sm text-[#fd7803]"
                          href={`mailto:${inquiry.email}`}
                        >
                          {inquiry.email}
                        </a>
                        {inquiry.organization && (
                          <p className="mt-1 text-sm text-[#aaa]">
                            {inquiry.organization}
                          </p>
                        )}
                      </div>
                      <form action={updateInquiry} className="flex gap-2">
                        <input
                          type="hidden"
                          name="inquiryId"
                          value={inquiry.id}
                        />
                        <select
                          className="input !w-auto"
                          name="status"
                          defaultValue={inquiry.status}
                        >
                          <option>NEW</option>
                          <option>IN_PROGRESS</option>
                          <option>CLOSED</option>
                          <option>SPAM</option>
                        </select>
                        <button className="button secondary">Update</button>
                      </form>
                      <form action={deleteInquiry}>
                        <input
                          type="hidden"
                          name="inquiryId"
                          value={inquiry.id}
                        />
                        <button className="text-xs text-red-400 hover:text-red-300">
                          Delete message
                        </button>
                      </form>
                    </div>
                    <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-[#bbb]">
                      {inquiry.message}
                    </p>
                    <p className="mt-3 font-mono text-[.65rem] text-[#666]">
                      {inquiry.createdAt.toLocaleString()}
                    </p>
                  </article>
                ))
              ) : (
                <Empty>No inquiries yet.</Empty>
              )}
            </div>
          </Panel>
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
          <p className="eyebrow">Production administration</p>
          <h1 className="headline">Secure services are being connected.</h1>
          <p className="lede mt-6">
            No demo administrator exists. The real database and identity
            provider must be active before this page can open.
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
      <strong className="text-3xl text-[#fd7803]">{value}</strong>
      <p className="mt-2 font-mono text-[.65rem] uppercase tracking-wider text-[#888]">
        {label}
      </p>
    </div>
  );
}
function OverviewCard({
  value,
  title,
  detail,
  href,
}: {
  value: string;
  title: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group border border-[#343434] bg-[#101010] p-5 transition hover:-translate-y-1 hover:border-[#fd7803] hover:bg-[#17120d]"
    >
      <strong className="font-mono text-2xl text-[#fd7803]">{value}</strong>
      <h3 className="mt-4 font-bold group-hover:text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#888]">{detail}</p>
      <span className="mt-5 inline-block text-xs font-bold uppercase tracking-[.1em] text-[#fd7803]">
        Review &rarr;
      </span>
    </Link>
  );
}
function Panel({
  id,
  title,
  eyebrow,
  children,
}: {
  id?: string;
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="card mt-7 min-w-0 scroll-mt-24 p-5 sm:p-6 md:p-8">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mb-6 mt-4 text-2xl font-bold">{title}</h2>
      {children}
    </section>
  );
}
function GalleryAttachmentFields({
  events,
  currentIds = [],
}: {
  events: Array<typeof galleryEvents.$inferSelect>;
  currentIds?: string[];
}) {
  return (
    <fieldset className="grid gap-4 border border-[#333] bg-[#0d0d0d] p-5">
      <legend className="px-2 font-mono text-[.68rem] uppercase tracking-wider text-[#fd7803]">
        Photo gallery
      </legend>
      <p className="text-sm leading-6 text-[#888]">
        Attach one or more existing event galleries, or create a new event
        gallery for this story and optionally connect its public Google Drive
        folder.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Existing event gallery">
          <select
            className="input min-h-36"
            name="galleryEventIds"
            defaultValue={currentIds}
            multiple
          >
            {events.map((event) => (
              <option value={event.id} key={event.id}>
                {event.title}
              </option>
            ))}
          </select>
          <span className="text-xs leading-5 text-[#777]">
            Hold Ctrl on Windows or Command on Mac to select several galleries.
          </span>
        </Field>
        <Field label="Or create a new gallery">
          <input
            className="input"
            name="newGalleryTitle"
            placeholder="Event gallery name"
          />
        </Field>
      </div>
      <Field label="New gallery Google Drive folder (optional)">
        <input
          className="input"
          name="galleryDriveFolder"
          placeholder="https://drive.google.com/drive/folders/..."
        />
      </Field>
    </fieldset>
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
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-sm text-[#777]">{children}</p>;
}
function ProjectChecks({
  projects,
  selected = [],
}: {
  projects: Array<{ id: string; slug: string; name: string }>;
  selected?: string[];
}) {
  return (
    <fieldset>
      <legend className="mb-3 font-mono text-[.68rem] uppercase tracking-wider text-[#999]">
        Programs and projects
      </legend>
      <div className="flex flex-wrap gap-4">
        {projects.map((project) => (
          <label
            className="flex items-center gap-2 text-sm text-[#bbb]"
            key={project.id}
          >
            <input
              type="checkbox"
              name="projects"
              value={project.slug}
              defaultChecked={selected.includes(project.id)}
            />
            {project.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

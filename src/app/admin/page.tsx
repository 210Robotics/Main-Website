import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { DriveSyncForm } from "@/components/drive-sync-form";
import { desc, eq, isNull } from "drizzle-orm";
import { getDb, hasDatabase } from "@/db";
import {
  inquiries,
  hourEntries,
  mediaAssets,
  memberProjects,
  members,
  posts,
  projects,
  publicSettings,
} from "@/db/schema";
import {
  approveMember,
  assertAdmin,
  createPost,
  deleteInquiry,
  deleteMember,
  deletePost,
  suspendMember,
  updatePost,
  updatePublicMemberCount,
  updateInquiry,
  updateMemberAccess,
  updateTeamHour,
  voidTeamHour,
} from "@/app/admin/actions";
import { BlogEditor } from "@/components/blog-editor";
import { hasClerk } from "@/lib/auth";
import {
  hasPermission,
  permissionKeys,
  permissionLabels,
} from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  if (!hasClerk() || !hasDatabase()) return <SetupNotice />;
  const actor = await assertAdmin();
  const [
    memberRows,
    inquiryRows,
    postRows,
    mediaRows,
    projectRows,
    assignmentRows,
    hourRows,
    settingsRows,
  ] = await Promise.all([
    getDb().select().from(members).orderBy(desc(members.createdAt)),
    getDb()
      .select()
      .from(inquiries)
      .orderBy(desc(inquiries.createdAt))
      .limit(100),
    getDb().select().from(posts).orderBy(desc(posts.updatedAt)),
    getDb()
      .select()
      .from(mediaAssets)
      .orderBy(desc(mediaAssets.createdAt))
      .limit(50),
    getDb().select().from(projects),
    getDb().select().from(memberProjects),
    getDb()
      .select({
        hour: hourEntries,
        memberName: members.displayName,
        memberRole: members.organizationRole,
      })
      .from(hourEntries)
      .innerJoin(members, eq(hourEntries.memberId, members.id))
      .where(isNull(hourEntries.deletedAt))
      .orderBy(desc(hourEntries.workDate))
      .limit(100),
    getDb().select().from(publicSettings).limit(1),
  ]);
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
  const canAccess = hasPermission(
    actor.accessRole,
    "access.manage",
    actor.permissionOverrides,
  );
  const canEditHours = hasPermission(
    actor.accessRole,
    "activity.edit_all",
    actor.permissionOverrides,
  );
  const siteSettings = settingsRows[0];
  const pending = memberRows.filter((member) => member.status === "PENDING");
  return (
    <section className="min-h-screen bg-[#090909] grid-bg">
      <div className="shell py-10">
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            value={String(
              memberRows.filter((m) => m.status === "ACTIVE").length,
            )}
            label="Active members"
          />
          <Metric value={String(pending.length)} label="Pending approval" />
          <Metric
            value={String(inquiryRows.filter((i) => i.status === "NEW").length)}
            label="New inquiries"
          />
          <Metric
            value={String(
              postRows.filter((p) => p.status === "PUBLISHED").length,
            )}
            label="Published stories"
          />
        </div>
        {actor.accessRole === "SUPER_ADMIN" && (
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
        {canMembers && (
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
                          <option>MEMBER</option>
                          <option>OFFICER</option>
                          <option>CONTENT_ADMIN</option>
                          <option>RECORDS_ADMIN</option>
                          {actor.accessRole === "SUPER_ADMIN" && (
                            <option>FULL_ADMIN</option>
                          )}
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
                      <strong>{member.displayName}</strong>
                      <p className="mt-1 text-xs text-[#777]">{member.email}</p>
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
                        {actor.accessRole === "SUPER_ADMIN" &&
                          member.id !== actor.id && (
                            <form action={deleteMember}>
                              <input
                                type="hidden"
                                name="memberId"
                                value={member.id}
                              />
                              <button className="text-xs text-red-400 hover:text-red-300">
                                Delete account
                              </button>
                            </form>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        {canAccess && (
          <Panel title="Roles and permissions" eyebrow="Super-admin controls">
            <div className="space-y-6">
              {memberRows
                .filter(
                  (member) =>
                    member.status === "ACTIVE" &&
                    member.accessRole !== "SUPER_ADMIN",
                )
                .map((member) => (
                  <form
                    action={updateMemberAccess}
                    className="grid gap-5 border-t border-[#333] pt-6"
                    key={member.id}
                  >
                    <input type="hidden" name="memberId" value={member.id} />
                    <div>
                      <strong>{member.displayName}</strong>
                      <p className="mt-1 text-xs text-[#777]">{member.email}</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Organization title">
                        <input
                          className="input"
                          name="organizationRole"
                          defaultValue={member.organizationRole}
                          required
                        />
                      </Field>
                    </div>
                    <div className="grid gap-4 md:grid-cols-[1fr_260px]">
                      <Field label="Public biography">
                        <textarea
                          className="input min-h-24"
                          name="bio"
                          defaultValue={member.bio}
                        />
                      </Field>
                      <Field label="Access preset">
                        <select
                          className="input"
                          name="accessRole"
                          defaultValue={member.accessRole}
                        >
                          <option>MEMBER</option>
                          <option>OFFICER</option>
                          <option>CONTENT_ADMIN</option>
                          <option>RECORDS_ADMIN</option>
                          <option>FULL_ADMIN</option>
                        </select>
                      </Field>
                    </div>
                    <ProjectChecks
                      projects={projectRows}
                      selected={assignmentRows
                        .filter((row) => row.memberId === member.id)
                        .map((row) => row.projectId)}
                    />
                    <label className="flex items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        name="isPublic"
                        defaultChecked={member.isPublic}
                      />{" "}
                      Show approved profile in the public member directory
                    </label>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {permissionKeys
                        .filter(
                          (key) =>
                            actor.accessRole === "SUPER_ADMIN" ||
                            key !== "access.manage",
                        )
                        .map((key) => (
                          <div
                            className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border border-[#333] p-3 text-xs"
                            key={key}
                          >
                            <span>{permissionLabels[key]}</span>
                            <label>
                              <input
                                type="checkbox"
                                name="allow"
                                value={key}
                                defaultChecked={member.permissionOverrides.allow.includes(
                                  key,
                                )}
                              />{" "}
                              Allow
                            </label>
                            <label>
                              <input
                                type="checkbox"
                                name="deny"
                                value={key}
                                defaultChecked={member.permissionOverrides.deny.includes(
                                  key,
                                )}
                              />{" "}
                              Deny
                            </label>
                          </div>
                        ))}
                    </div>
                    <button className="button w-fit">Save access</button>
                  </form>
                ))}
            </div>
          </Panel>
        )}
        {canEditHours && (
          <Panel title="Team hour records" eyebrow="Corrections and voids">
            <div className="space-y-5">
              {hourRows.length ? (
                hourRows.map(({ hour, memberName, memberRole }) => (
                  <article
                    className="border-t border-[#333] pt-5"
                    key={hour.id}
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <strong>{memberName}</strong>
                        <p className="mt-1 text-xs text-[#777]">{memberRole}</p>
                      </div>
                      <form action={voidTeamHour}>
                        <input type="hidden" name="hourId" value={hour.id} />
                        <button className="text-xs text-red-400 hover:text-red-300">
                          Void entry
                        </button>
                      </form>
                    </div>
                    <form action={updateTeamHour} className="grid gap-4">
                      <input type="hidden" name="hourId" value={hour.id} />
                      <div className="grid gap-4 md:grid-cols-4">
                        <Field label="Date">
                          <input
                            className="input"
                            name="date"
                            type="date"
                            defaultValue={hour.workDate
                              .toISOString()
                              .slice(0, 10)}
                            required
                          />
                        </Field>
                        <Field label="Hours">
                          <input
                            className="input"
                            name="hours"
                            type="number"
                            min="0.01"
                            max="24"
                            step="0.01"
                            defaultValue={(hour.minutes / 60).toFixed(2)}
                            required
                          />
                        </Field>
                        <Field label="Project">
                          <input
                            className="input"
                            name="project"
                            defaultValue={hour.project}
                            required
                          />
                        </Field>
                        <Field label="Category">
                          <input
                            className="input"
                            name="category"
                            defaultValue={hour.category}
                            required
                          />
                        </Field>
                      </div>
                      <Field label="Description">
                        <textarea
                          className="input min-h-20"
                          name="description"
                          defaultValue={hour.description}
                          required
                        />
                      </Field>
                      <button className="button secondary w-fit">
                        Save correction
                      </button>
                    </form>
                  </article>
                ))
              ) : (
                <Empty>No hour entries have been submitted.</Empty>
              )}
            </div>
          </Panel>
        )}
        {canContent && (
          <Panel title="Write a news post" eyebrow="Blog editor">
            <form action={createPost} className="grid gap-5">
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
              <Field label="Cover image URL">
                <input
                  className="input"
                  name="coverImageUrl"
                  type="url"
                  placeholder="https://…"
                />
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
            </form>
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
                  <form
                    action={updatePost}
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
                    <Field label="Cover image URL">
                      <input
                        className="input"
                        name="coverImageUrl"
                        type="url"
                        defaultValue={post.coverImageUrl ?? ""}
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
                  </form>
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
        {canMedia && (
          <Panel title="Shared Drive media" eyebrow="Automatic publishing">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <p className="max-w-2xl text-sm leading-7 text-[#999]">
                Synchronize supported photos from the approved shared Drive
                folder. New images publish automatically after validation and
                optimization.
              </p>
              <DriveSyncForm />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {mediaRows.map((asset) => (
                <div
                  className="relative aspect-square overflow-hidden border border-[#333]"
                  key={asset.id}
                >
                  {asset.mimeType.startsWith("video/") ? (
                    <video className="h-full w-full object-cover" controls preload="metadata">
                      <source src={asset.blobUrl} type={asset.mimeType} />
                    </video>
                  ) : (
                    <Image
                      className="object-cover"
                      src={asset.blobUrl}
                      alt={asset.alt}
                      fill
                      sizes="160px"
                    />
                  )}
                </div>
              ))}
            </div>
          </Panel>
        )}
        {canInquiries && (
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
function Panel({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card mt-7 p-6 md:p-8">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mb-6 mt-4 text-2xl font-bold">{title}</h2>
      {children}
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

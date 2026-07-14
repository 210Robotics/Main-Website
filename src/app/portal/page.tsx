import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb, hasDatabase } from "@/db";
import {
  contributions,
  hourEntries,
  members as memberTable,
  timeSessions,
} from "@/db/schema";
import {
  addContribution,
  addHour,
  deleteContribution,
  deleteHour,
  updateProfile,
} from "@/app/portal/actions";
import { hasClerk, requireActiveMember } from "@/lib/auth";
import { formatHours } from "@/lib/utils";
import { TimeClock } from "@/components/time-clock";

export const metadata: Metadata = {
  title: "Member Portal",
  robots: { index: false, follow: false },
};

export default async function PortalPage() {
  if (!hasClerk() || !hasDatabase()) return <SetupNotice />;
  const member = await requireActiveMember();
  const [hours, work, activeSession, teamMembers, teamHours] =
    await Promise.all([
      getDb()
        .select()
        .from(hourEntries)
        .where(
          and(
            eq(hourEntries.memberId, member.id),
            isNull(hourEntries.deletedAt),
          ),
        )
        .orderBy(desc(hourEntries.workDate)),
      getDb()
        .select()
        .from(contributions)
        .where(
          and(
            eq(contributions.memberId, member.id),
            isNull(contributions.deletedAt),
          ),
        )
        .orderBy(desc(contributions.contributionDate)),
      getDb()
        .select()
        .from(timeSessions)
        .where(
          and(
            eq(timeSessions.memberId, member.id),
            isNull(timeSessions.clockOut),
          ),
        )
        .orderBy(desc(timeSessions.clockIn))
        .limit(1),
      getDb()
        .select({
          id: memberTable.id,
          name: memberTable.displayName,
          role: memberTable.organizationRole,
        })
        .from(memberTable)
        .where(eq(memberTable.status, "ACTIVE")),
      getDb()
        .select({
          memberId: hourEntries.memberId,
          minutes: hourEntries.minutes,
        })
        .from(hourEntries)
        .where(isNull(hourEntries.deletedAt)),
    ]);
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
          {member.accessRole !== "MEMBER" && (
            <Link className="button secondary" href="/admin">
              Open admin
            </Link>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric value={formatHours(total)} label="Hours logged" />
          <Metric value={String(work.length)} label="Contributions" />
          <Metric value={member.organizationRole} label="Organization role" />
        </div>
        <EntryCard title="Sign in / sign out" className="mt-7 clock-card">
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
        <EntryCard title="Team hours leaderboard" className="mt-7">
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
        <div className="mt-7 grid gap-6 xl:grid-cols-2">
          <EntryCard title="Manual hour entry">
            <form action={addHour} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Date">
                  <input className="input" name="date" type="date" required />
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
          <EntryCard title="Record a contribution">
            <form action={addContribution} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Date">
                  <input className="input" name="date" type="date" required />
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
        </div>
        <div className="mt-7 grid gap-6 xl:grid-cols-2">
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
        <EntryCard title="Public member profile" className="mt-7">
          <form action={updateProfile} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Display name">
                <input
                  className="input"
                  name="displayName"
                  defaultValue={member.displayName}
                  required
                />
              </Field>
              <Field label="Organization role">
                <input
                  className="input"
                  value={member.organizationRole}
                  disabled
                />
              </Field>
            </div>
            <Field label="Biography">
              <textarea
                className="input min-h-28"
                name="bio"
                defaultValue={member.bio}
              />
            </Field>
            <Field label="Photo URL">
              <input
                className="input"
                name="photoUrl"
                type="url"
                defaultValue={member.photoUrl || ""}
              />
            </Field>
            <button className="button w-fit">Update profile</button>
          </form>
        </EntryCard>
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

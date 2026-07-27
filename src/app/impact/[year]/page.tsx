import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { getDb, hasDatabase } from "@/db";
import {
  contributions,
  engineeringNotebookEntries,
  hourEntries,
  mediaAssets,
  members,
  memberTasks,
  operationsHubRecords,
  sponsors,
} from "@/db/schema";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }): Promise<Metadata> {
  const { year } = await params;
  return { title: `${year} Annual Impact Report`, description: `210 Robotics' public ${year} impact report: people, engineering, service, and team outcomes.` };
}

export default async function AnnualImpactReport({ params }: { params: Promise<{ year: string }> }) {
  const year = Number((await params).year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) notFound();
  const report = await getImpact(year);
  const previous = year - 1;
  const next = year + 1;
  return (
    <main className="min-h-screen bg-[#090909] grid-bg">
      <section className="border-b border-[#292929] bg-[radial-gradient(circle_at_80%_10%,rgba(253,120,3,.22),transparent_34%)]">
        <div className="shell py-20 md:py-28">
          <p className="eyebrow">Public annual report · {year}</p>
          <h1 className="mt-5 max-w-5xl text-5xl font-black tracking-[-.055em] md:text-7xl">Engineering impact, made visible.</h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-[#aaa]">A transparent snapshot of the people, work, documentation, partnerships, and learning that moved 210 Robotics forward.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link className="button secondary" href={`/impact/${previous}`}>{previous}</Link><Link className="button secondary" href={`/impact/${next}`}>{next}</Link><Link className="button" href="/sponsor-portal">Partner with the team</Link></div>
        </div>
      </section>
      <section className="section">
        <div className="shell">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <BigMetric value={report.members} label="Active members" />
            <BigMetric value={Math.round(report.minutes / 60).toLocaleString()} label="Documented team hours" />
            <BigMetric value={report.completedTasks} label="Completed assignments" />
            <BigMetric value={report.notebookEntries} label="Reviewed notebook entries" />
          </div>
        </div>
      </section>
      <section className="section border-y border-[#282828] bg-[#0d0d0d]">
        <div className="shell grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
          <div><p className="eyebrow">How the team grew</p><h2 className="headline">Work became shared knowledge.</h2><p className="lede mt-6">The report is generated from approved team records so the public story stays connected to actual engineering and organizational work.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Story value={report.contributions} title="Verified contributions" body="Design, code, manufacturing, outreach, leadership, and other evidence-backed work." />
            <Story value={report.media} title="Published media items" body="Photos and visual documentation that preserve the team's season and community impact." />
            <Story value={report.sponsors} title="Public partners" body="Organizations investing in student-led engineering and workforce development." />
            <Story value={report.completedTasks + report.notebookEntries} title="Closed-loop records" body="Completed actions and reviewed notebook entries that turn activity into durable learning." />
          </div>
        </div>
      </section>
      {report.custom.length > 0 && <section className="section"><div className="shell"><p className="eyebrow">Team-reported outcomes</p><h2 className="headline">Milestones that numbers alone miss.</h2><div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{report.custom.map((item) => <article className="card p-6" key={item.id}><strong className="font-mono text-3xl text-[#fd7803]">{item.value}</strong><h3 className="mt-4 text-xl font-bold">{item.title}</h3>{item.description && <p className="mt-3 text-sm leading-6 text-[#999]">{item.description}</p>}</article>)}</div></div></section>}
      <section className="section"><div className="shell card flex flex-wrap items-center justify-between gap-6 p-8 md:p-12"><div><p className="eyebrow">Build the next chapter</p><h2 className="mt-3 text-3xl font-bold">Support student-led engineering.</h2></div><div className="flex flex-wrap gap-3"><Link className="button" href="/sponsor-portal">Sponsor self-service</Link><Link className="button secondary" href="/members">Meet the team</Link></div></div></section>
    </main>
  );
}

async function getImpact(year: number) {
  if (!hasDatabase()) return { members: 0, minutes: 0, completedTasks: 0, notebookEntries: 0, contributions: 0, media: 0, sponsors: 0, custom: [] as { id: string; title: string; value: string; description: string }[] };
  const start = new Date(`${year}-01-01T00:00:00.000Z`);
  const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);
  const db = getDb();
  const [memberRows, hours, work, tasks, notebook, photos, partnerRows, customRows] = await Promise.all([
    db.select({ id: members.id }).from(members).where(eq(members.status, "ACTIVE")),
    db.select({ minutes: hourEntries.minutes }).from(hourEntries).where(and(isNull(hourEntries.deletedAt), gte(hourEntries.workDate, start), lt(hourEntries.workDate, end))),
    db.select({ id: contributions.id }).from(contributions).where(and(isNull(contributions.deletedAt), gte(contributions.contributionDate, start), lt(contributions.contributionDate, end))),
    db.select({ id: memberTasks.id }).from(memberTasks).where(and(eq(memberTasks.status, "DONE"), gte(memberTasks.completedAt, start), lt(memberTasks.completedAt, end))),
    db.select({ id: engineeringNotebookEntries.id }).from(engineeringNotebookEntries).where(and(inArray(engineeringNotebookEntries.status, ["APPROVED", "PUBLISHED"]), gte(engineeringNotebookEntries.entryDate, start), lt(engineeringNotebookEntries.entryDate, end))),
    db.select({ id: mediaAssets.id }).from(mediaAssets).where(and(eq(mediaAssets.published, true), isNull(mediaAssets.archivedAt), gte(mediaAssets.createdAt, start), lt(mediaAssets.createdAt, end))),
    db.select({ id: sponsors.id }).from(sponsors).where(eq(sponsors.published, true)),
    db.select().from(operationsHubRecords).where(and(eq(operationsHubRecords.kind, "IMPACT_METRIC"), isNull(operationsHubRecords.archivedAt))),
  ]);
  return {
    members: memberRows.length,
    minutes: hours.reduce((sum, row) => sum + row.minutes, 0),
    contributions: work.length,
    completedTasks: tasks.length,
    notebookEntries: notebook.length,
    media: photos.length,
    sponsors: partnerRows.length,
    custom: customRows.filter((item) => Number(item.data.reportYear) === year).map((item) => ({ id: item.id, title: item.title, value: `${String(item.data.metricValue || "")} ${String(item.data.metricUnit || "")}`.trim(), description: item.description })),
  };
}

function BigMetric({ value, label }: { value: string | number; label: string }) { return <article className="card p-6 md:p-8"><strong className="font-mono text-4xl text-[#fd7803]">{value}</strong><p className="mt-3 text-xs uppercase tracking-wider text-[#888]">{label}</p></article>; }
function Story({ value, title, body }: { value: number; title: string; body: string }) { return <article className="card p-6"><strong className="font-mono text-3xl text-[#fd7803]">{value}</strong><h3 className="mt-4 text-lg font-bold">{title}</h3><p className="mt-3 text-sm leading-6 text-[#888]">{body}</p></article>; }
